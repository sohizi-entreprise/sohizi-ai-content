import { describe, expect, it } from "bun:test"
import { functions } from "@/lib/inngest"
import { sweepExpiredArtifacts } from "./artifact-expiration"

describe("context artifact expiration", () => {
  it("registers an hourly sweep", () => {
    expect(functions).toContain(sweepExpiredArtifacts)
    expect(sweepExpiredArtifacts.opts).toMatchObject({
      id: "context-artifact-expiration-sweep",
      triggers: [{ cron: "0 * * * *" }],
      concurrency: { limit: 1 },
      retries: 3,
    })
  })
})
