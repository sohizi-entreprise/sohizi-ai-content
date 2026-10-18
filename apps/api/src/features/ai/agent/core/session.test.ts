import { describe, expect, it } from "bun:test"
import { Session } from "./session"

function session() {
  return new Session({
    sessionId: "session",
    userId: "user",
    organizationId: "organization",
    projectId: "project",
    runId: "run",
  })
}

describe("Session.withFileEdit", () => {
  it("runs concurrent edits to the same file in call order across sessions", async () => {
    const current = session()
    const events: Array<string> = []
    let releaseFirst!: () => void
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = current.withFileEdit("file", async () => {
      events.push("first start")
      await firstCanFinish
      events.push("first end")
    })
    const second = session().withFileEdit("file", async () => {
      events.push("second start")
      events.push("second end")
    })

    await Promise.resolve()
    expect(events).toEqual(["first start"])
    releaseFirst()
    await Promise.all([first, second])
    expect(events).toEqual([
      "first start",
      "first end",
      "second start",
      "second end",
    ])
  })

  it("releases the file after an edit fails", async () => {
    const current = session()
    await expect(
      current.withFileEdit("file", async () => {
        throw new Error("failed")
      }),
    ).rejects.toThrow("failed")
    expect(await current.withFileEdit("file", async () => "next")).toBe("next")
  })
})
