import { createPolar, createPolarCore } from "@polar-sh/sdk/2026-10"

const accessToken = process.env.POLAR_ACCESS_TOKEN
const environment =
  process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox"

export const polar = accessToken
  ? createPolar({ accessToken, environment })
  : null

export const polarCore = accessToken
  ? createPolarCore({ accessToken, environment })
  : null

export function requirePolar() {
  if (!polar) throw new Error("Polar billing is not configured")
  return polar
}
