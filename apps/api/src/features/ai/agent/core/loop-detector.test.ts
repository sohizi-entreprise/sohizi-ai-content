import { describe, expect, it } from "bun:test"
import {
  formatLoopStopNote,
  formatLoopWarningNote,
  LoopDetector,
  stableStringify,
} from "./loop-detector"
import { PROVIDE_STATUS_UPDATE_TOOL_NAME } from "../tools/progress-update"

describe("LoopDetector", () => {
  it("canonicalizes JSON keys so differently ordered objects produce identical signatures", () => {
    expect(
      stableStringify({
        method: "GET",
        endpoint: "/files/read",
        params: { b: 2, a: 1 },
      }),
    ).toBe(
      stableStringify({
        endpoint: "/files/read",
        params: { a: 1, b: 2 },
        method: "GET",
      }),
    )
  })

  it("detects exact call + result repetition (nudge at 3x, stop at 5x) regardless of key order", () => {
    const detector = new LoopDetector()

    detector.recordStep(1, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/read",
          method: "GET",
          params: { filePath: "/storyboard.md", a: 1, b: 2 },
        },
        success: true,
        output: "# Storyboard content",
      },
    ])
    expect(detector.evaluate(1)).toEqual({ action: "none" })

    detector.recordStep(2, [
      {
        toolName: "fileSystemAPI",
        input: {
          method: "GET",
          params: { b: 2, a: 1, filePath: "/storyboard.md" },
          endpoint: "/files/read",
        },
        success: true,
        output: "# Storyboard content",
      },
    ])
    expect(detector.evaluate(2)).toEqual({ action: "none" })

    detector.recordStep(3, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/read",
          method: "GET",
          params: { filePath: "/storyboard.md", a: 1, b: 2 },
        },
        success: true,
        output: "# Storyboard content",
      },
    ])
    const verdict3 = detector.evaluate(3)
    expect(verdict3.action).toBe("nudge")
    if (verdict3.action !== "none") {
      expect(verdict3.kind).toBe("exact_repeat")
      expect(verdict3.count).toBe(3)
      const note = formatLoopWarningNote(verdict3)
      expect(note).toContain('<loop_warning kind="exact_repeat">')
    }

    // Step 4: continues repeating -> suppressed immediate duplicate nudge before hard threshold
    detector.recordStep(4, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/read",
          method: "GET",
          params: { filePath: "/storyboard.md", a: 1, b: 2 },
        },
        success: true,
        output: "# Storyboard content",
      },
    ])
    expect(detector.evaluate(4)).toEqual({ action: "none" })

    // Step 5: reaches hard stop threshold (5x)
    detector.recordStep(5, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/read",
          method: "GET",
          params: { filePath: "/storyboard.md", a: 1, b: 2 },
        },
        success: true,
        output: "# Storyboard content",
      },
    ])
    const verdict5 = detector.evaluate(5)
    expect(verdict5.action).toBe("stop")
    if (verdict5.action !== "none") {
      expect(verdict5.kind).toBe("exact_repeat")
      expect(verdict5.count).toBe(5)
      const stopNote = formatLoopStopNote(verdict5)
      expect(stopNote).toContain('<loop_stop kind="exact_repeat">')
      expect(stopNote).toContain("Tool calls are disabled for this final turn.")
    }
  })

  it("detects consecutive error streaks on the same endpoint and resets when a call succeeds", () => {
    const detector = new LoopDetector()

    for (let step = 1; step <= 2; step++) {
      detector.recordStep(step, [
        {
          toolName: "fileSystemAPI",
          input: {
            endpoint: "/files/patch",
            method: "PATCH",
            body: {
              filePath: "/script.md",
              oldText: `attempt-${step}`,
              newText: "updated",
            },
          },
          success: false,
          output: "oldText not found in file",
        },
      ])
      expect(detector.evaluate(step)).toEqual({ action: "none" })
    }

    // 3rd consecutive failure on /files/patch with different input -> triggers error_streak nudge
    detector.recordStep(3, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/patch",
          method: "PATCH",
          body: {
            filePath: "/script.md",
            oldText: "attempt-3",
            newText: "updated",
          },
        },
        success: false,
        output: "oldText not found in file",
      },
    ])
    const verdict3 = detector.evaluate(3)
    expect(verdict3.action).toBe("nudge")
    if (verdict3.action !== "none") {
      expect(verdict3.kind).toBe("error_streak")
      expect(verdict3.endpoint).toBe("/files/patch")
      expect(formatLoopWarningNote(verdict3)).toContain("strategy: \"overwrite\"")
    }

    // Step 4: agent succeeds on /files/patch -> streak resets
    detector.recordStep(4, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/patch",
          method: "PATCH",
          body: {
            filePath: "/script.md",
            oldText: "real-line",
            newText: "updated",
          },
        },
        success: true,
        output: "Patched successfully",
      },
    ])
    expect(detector.evaluate(4)).toEqual({ action: "none" })

    // Step 5: a single new failure after reset does not trigger nudge
    detector.recordStep(5, [
      {
        toolName: "fileSystemAPI",
        input: {
          endpoint: "/files/patch",
          method: "PATCH",
          body: {
            filePath: "/script.md",
            oldText: "another-miss",
            newText: "updated",
          },
        },
        success: false,
        output: "oldText not found in file",
      },
    ])
    expect(detector.evaluate(5)).toEqual({ action: "none" })
  })

  it("does not trigger false positives on legitimate batch write operations", () => {
    const detector = new LoopDetector()

    for (let step = 1; step <= 12; step++) {
      detector.recordStep(step, [
        {
          toolName: "videoEditorAPI",
          input: {
            endpoint: "/video-editor/clips/add",
            method: "POST",
            body: {
              trackId: "track-1",
              type: "text",
              startFrame: (step - 1) * 30,
              endFrame: step * 30,
              properties: { text: `Scene ${step}` },
            },
          },
          success: true,
          output: JSON.stringify({ clipId: `clip-${step}` }),
        },
      ])
      expect(detector.evaluate(step)).toEqual({ action: "none" })
    }
  })

  it("does not trigger false positives on legitimate read exploration across distinct files", () => {
    const detector = new LoopDetector()

    for (let step = 1; step <= 12; step++) {
      detector.recordStep(step, [
        {
          toolName: "fileSystemAPI",
          input: {
            endpoint: "/files/read",
            method: "GET",
            params: { filePath: `/scenes/scene-${step}.md` },
          },
          success: true,
          output: `Content of scene ${step}`,
        },
      ])
      expect(detector.evaluate(step)).toEqual({ action: "none" })
    }
  })

  it("nudges toward POST /media/jobs/wait when polling GET /media/jobs/status repeatedly on the same jobId", () => {
    const detector = new LoopDetector()

    for (let step = 1; step <= 2; step++) {
      detector.recordStep(step, [
        {
          toolName: "mediaOperationsAPI",
          input: {
            endpoint: "/media/jobs/status",
            method: "GET",
            params: { jobId: "job-123" },
          },
          success: true,
          output: JSON.stringify({ status: "running" }),
        },
      ])
      expect(detector.evaluate(step)).toEqual({ action: "none" })
    }

    detector.recordStep(3, [
      {
        toolName: "mediaOperationsAPI",
        input: {
          endpoint: "/media/jobs/status",
          method: "GET",
          params: { jobId: "job-123" },
        },
        success: true,
        output: JSON.stringify({ status: "running" }),
      },
    ])
    const verdict = detector.evaluate(3)
    expect(verdict.action).toBe("nudge")
    if (verdict.action !== "none") {
      expect(verdict.kind).toBe("job_poll_loop")
      expect(formatLoopWarningNote(verdict)).toContain("POST /media/jobs/wait")
    }
  })

  it("detects A-B period-2 oscillation and escalates from nudge to stop", () => {
    const detector = new LoopDetector()

    const stepA = (step: number) =>
      detector.recordStep(step, [
        {
          toolName: "videoEditorAPI",
          input: {
            endpoint: "/video-editor/overview",
            method: "GET",
            params: { filePath: "/main.ve" },
          },
          success: true,
          output: `{"tracks":1,"step":${step}}`,
        },
      ])

    const stepB = (step: number) =>
      detector.recordStep(step, [
        {
          toolName: "videoEditorAPI",
          input: {
            endpoint: "/video-editor/clips/list",
            method: "GET",
            params: { filePath: "/main.ve" },
          },
          success: true,
          output: `{"clips":[],"step":${step}}`,
        },
      ])

    stepA(1)
    expect(detector.evaluate(1)).toEqual({ action: "none" })
    stepB(2)
    expect(detector.evaluate(2)).toEqual({ action: "none" })
    stepA(3)
    expect(detector.evaluate(3)).toEqual({ action: "none" })
    stepB(4)

    const verdict4 = detector.evaluate(4)
    expect(verdict4.action).toBe("nudge")
    if (verdict4.action !== "none") {
      expect(verdict4.kind).toBe("oscillation")
    }

    stepA(5)
    expect(detector.evaluate(5)).toEqual({ action: "none" })
    stepB(6)

    const verdict6 = detector.evaluate(6)
    expect(verdict6.action).toBe("stop")
    if (verdict6.action !== "none") {
      expect(verdict6.kind).toBe("oscillation")
    }
  })

  it("detects meta-only stall when agent only emits status updates across consecutive steps", () => {
    const detector = new LoopDetector()

    for (let step = 1; step <= 3; step++) {
      detector.recordStep(step, [
        {
          toolName: PROVIDE_STATUS_UPDATE_TOOL_NAME,
          input: { message: `Still thinking (${step})...` },
          success: true,
          output: "ok",
        },
      ])
      expect(detector.evaluate(step)).toEqual({ action: "none" })
    }

    detector.recordStep(4, [
      {
        toolName: PROVIDE_STATUS_UPDATE_TOOL_NAME,
        input: { message: "Still thinking (4)..." },
        success: true,
        output: "ok",
      },
    ])
    const verdict4 = detector.evaluate(4)
    expect(verdict4.action).toBe("nudge")
    if (verdict4.action !== "none") {
      expect(verdict4.kind).toBe("no_progress_stall")
    }
  })
})
