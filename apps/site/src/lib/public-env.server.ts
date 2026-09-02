import type { PublicEnv } from "./public-env"

export function readPublicEnvFromNitro(): PublicEnv {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error("APP_URL is not set")
  }

  return { appUrl }
}
