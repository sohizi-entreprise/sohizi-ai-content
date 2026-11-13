import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization, emailOTP } from "better-auth/plugins"
import { db } from "@/db"
import { Resend } from "resend"
import { billingService } from "@/features/billing/service"
import { polar, webhooks } from "@polar-sh/better-auth"
import { polarCore } from "@/features/billing/polar-client"
import {
  handleOrderPaid,
  handleOrderRefunded,
  syncPolarSubscription,
} from "@/features/billing/polar"
import { prepareAccountDeletion } from "@/features/account/delete-account"
import { acceptingUsers } from "@/features/launch-gate"

const resend = new Resend(process.env.RESEND_API_KEY)
const REPLY_TO = "support@sohizi.com"

const WELCOME_CREDITS = 500n
const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL!],
  database: drizzleAdapter(db, { provider: "pg" }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await acceptingUsers())) {
            throw new APIError("FORBIDDEN", {
              message: "Sign-up is not open yet. Join the waitlist instead.",
            })
          }
          return { data: user }
        },
      },
    },
  },
  user: {
    additionalFields: {
      type: {
        type: "string",
        required: true,
        defaultValue: "user",
        input: false,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await prepareAccountDeletion(user.id)
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@sohizi.com",
        replyTo: REPLY_TO,
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password:</p><a href="${url}">Reset Password</a>`,
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@sohizi.com",
        replyTo: REPLY_TO,
        to: user.email,
        subject: "Verify your email address",
        html: `<p>Click the link below to verify your email:</p><a href="${url}">Verify Email</a>`,
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  onAPIError: {
    errorURL: process.env.FRONTEND_URL + "/auth-error",
  },
  plugins: [
    ...(polarCore && polarWebhookSecret
      ? [
          polar({
            client: polarCore,
            use: [
              webhooks({
                secret: polarWebhookSecret,
                onOrderPaid: handleOrderPaid,
                onOrderRefunded: handleOrderRefunded,
                onSubscriptionCreated: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionUpdated: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionActive: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionCanceled: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionUncanceled: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionPastDue: async (payload) =>
                  syncPolarSubscription(payload.data.id),
                onSubscriptionRevoked: async (payload) =>
                  syncPolarSubscription(payload.data.id),
              }),
            ],
          }),
        ]
      : []),
    organization({
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          try {
            await billingService.topup({
              organizationId: organization.id,
              amount: WELCOME_CREDITS,
              idempotencyKey: `org-welcome:${organization.id}`,
              metadata: { reason: "welcome_credits" },
            })
          } catch (error) {
            console.error(
              `[auth] Failed to grant welcome credits to org ${organization.id}:`,
              error,
            )
          }
        },
      },
    }),
    emailOTP({
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const subjectMap: Record<string, string> = {
          "sign-in": "Your sign-in code",
          "email-verification": "Verify your email address",
          "forget-password": "Reset your password",
          "change-email": "Confirm your new email address",
        }
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "noreply@sohizi.com",
          replyTo: REPLY_TO,
          to: email,
          subject: subjectMap[type] || "Your verification code",
          html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 16px;">Your verification code</h2>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;margin:24px 0;">${otp}</p>
            <p style="color:#666;font-size:14px;">This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>`,
        })
      },
    }),
  ],
})
