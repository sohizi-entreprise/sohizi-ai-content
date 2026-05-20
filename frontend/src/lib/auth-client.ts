import { createAuthClient } from "better-auth/react"
import { organizationClient, emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  plugins: [organizationClient(), emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
})

export const { signIn, signUp, signOut, useSession, organization, emailOtp } = authClient
