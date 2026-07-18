import { createAuthClient } from "better-auth/react"
import { organizationClient, emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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

export const { signIn, signUp, signOut, useSession, organization, emailOtp } = authClient

export type UserType = "user" | "admin"
