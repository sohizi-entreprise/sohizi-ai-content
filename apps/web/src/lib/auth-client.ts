import { createAuthClient } from "better-auth/react"
import {
  emailOTPClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        type: {
          type: "string",
        },
      },
    }),
  ],
  fetchOptions: {
    credentials: "include",
  },
})

export const { signIn, signUp, useSession, organization, emailOtp } = authClient

export type UserType = "user" | "admin"
