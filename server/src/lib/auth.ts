import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization, emailOTP } from "better-auth/plugins"
import { db } from "@/db"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL!],
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@sohizi.com",
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password:</p><a href="${url}">Reset Password</a>`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@sohizi.com",
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
    errorURL: (process.env.FRONTEND_URL) + "/auth-error",
  },
  plugins: [
    organization(),
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
