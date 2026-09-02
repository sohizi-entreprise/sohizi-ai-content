import { getPublicEnv } from "./public-env"

export function appUrl(path = "/"): string {
  const base = getPublicEnv().appUrl.replace(/\/$/, "")
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}

export function isAppPath(href: string): boolean {
  return href === "/sign-in" || href === "/sign-up"
}
