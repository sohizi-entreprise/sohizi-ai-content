import { describe, expect, test } from "bun:test"
import { POLICY_VERSION, buildConsentCookie, isConsentCurrent } from "./policy"

describe("shared analytics consent", () => {
  test("uses one secure cookie across the marketing and product subdomains", () => {
    for (const host of ["www.sohizi.net", "app.sohizi.net"]) {
      const cookie = buildConsentCookie("consent-id", host)
      expect(cookie).toContain("Domain=.sohizi.net")
      expect(cookie).toContain("SameSite=Lax")
      expect(cookie).toContain("HttpOnly")
      expect(cookie).toContain("Secure")
    }
    for (const host of ["www.sohizi.com", "app.sohizi.com"]) {
      const cookie = buildConsentCookie("consent-id", host)
      expect(cookie).toContain("Domain=.sohizi.com")
      expect(cookie).toContain("SameSite=Lax")
      expect(cookie).toContain("HttpOnly")
      expect(cookie).toContain("Secure")
    }
    expect(buildConsentCookie("consent-id", "localhost")).not.toContain(
      "Domain=",
    )
  })

  test("expires decisions and invalidates an older policy version", () => {
    const now = new Date("2026-10-06T12:00:00Z")
    expect(
      isConsentCurrent(
        { policyVersion: POLICY_VERSION, expiresAt: new Date("2026-10-07") },
        now,
      ),
    ).toBe(true)
    expect(
      isConsentCurrent({ policyVersion: POLICY_VERSION, expiresAt: now }, now),
    ).toBe(false)
    expect(
      isConsentCurrent(
        { policyVersion: "old", expiresAt: new Date("2026-10-07") },
        now,
      ),
    ).toBe(false)
  })
})
