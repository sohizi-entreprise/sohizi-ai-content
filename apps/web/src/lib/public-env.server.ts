import type { PublicEnv } from "./public-env"

export function readPublicEnvFromNitro(): PublicEnv {
  const siteUrl = process.env.SITE_URL
  const mediaCdnUrl = process.env.MEDIA_CDN_URL

  if (!siteUrl) {
    throw new Error("SITE_URL is not set")
  }
  if (!mediaCdnUrl) {
    throw new Error("MEDIA_CDN_URL is not set")
  }

  return { siteUrl, mediaCdnUrl }
}
