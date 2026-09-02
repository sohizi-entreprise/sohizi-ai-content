import { getPublicEnv } from "./public-env"

export function siteUrl(path = "/"): string {
  const base = getPublicEnv().siteUrl.replace(/\/$/, "")
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}
