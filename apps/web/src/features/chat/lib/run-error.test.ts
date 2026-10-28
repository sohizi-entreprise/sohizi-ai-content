import { describe, expect, it } from "vitest"
import { useChatStore } from "../store/chat-store"
import {
  BILLING_RUN_ERROR_MESSAGE,
  GENERIC_RUN_ERROR_MESSAGE,
  classifyRunError,
} from "./run-error"

describe("classifyRunError", () => {
  it("classifies insufficient credits errors as billing errors", () => {
    expect(
      classifyRunError(
        "Insufficient credits for organization org-1: requested 100, available 10",
      ),
    ).toEqual({
      kind: "billing",
      message: BILLING_RUN_ERROR_MESSAGE,
      billingPath: "/account/billing",
    })
  })

  it("masks internal and generic errors with a safe fallback message", () => {
    expect(
      classifyRunError("Database connection failed: ECONNREFUSED 127.0.0.1:5432"),
    ).toEqual({
      kind: "generic",
      message: GENERIC_RUN_ERROR_MESSAGE,
    })

    expect(classifyRunError(null)).toEqual({
      kind: "generic",
      message: GENERIC_RUN_ERROR_MESSAGE,
    })
  })

  it("tracks cancelled run IDs in the chat store so cancelled runs suppress error banners", () => {
    useChatStore.getState().reset()
    expect(useChatStore.getState().cancelledRunIds["run-1"]).toBeUndefined()

    useChatStore.getState().markRunCancelled("run-1")
    expect(useChatStore.getState().cancelledRunIds["run-1"]).toBe(true)

    useChatStore.getState().unmarkRunCancelled("run-1")
    expect(useChatStore.getState().cancelledRunIds["run-1"]).toBeUndefined()
  })
})
