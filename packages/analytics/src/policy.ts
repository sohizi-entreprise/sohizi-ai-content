export const CONSENT_COOKIE = "sohizi_analytics_consent"
export const POLICY_VERSION = "2026-10-06"
export const SIX_MONTHS_SECONDS = 60 * 60 * 24 * 183

export type RecordedConsent = {
  policyVersion: string
  expiresAt: Date
}

export function isConsentCurrent(
  record: RecordedConsent,
  now = new Date(),
): boolean {
  return record.policyVersion === POLICY_VERSION && record.expiresAt > now
}

const SHARED_COOKIE_DOMAINS = ["sohizi.net", "sohizi.com"] as const

function resolveCookieDomain(hostname: string): string | null {
  for (const domain of SHARED_COOKIE_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return `.${domain}`
    }
  }
  return null
}

export function buildConsentCookie(id: string, hostname: string): string {
  const cookieDomain = resolveCookieDomain(hostname)
  return `${CONSENT_COOKIE}=${id}; Path=/; Max-Age=${SIX_MONTHS_SECONDS}; SameSite=Lax; HttpOnly${cookieDomain ? `; Domain=${cookieDomain}; Secure` : ""}`
}
