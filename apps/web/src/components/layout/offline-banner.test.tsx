// @vitest-environment jsdom
import { createElement } from "react"
import { onlineManager } from "@tanstack/react-query"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OFFLINE_TOAST_ID, OfflineBanner } from "./offline-banner"

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastMocks.error,
    dismiss: toastMocks.dismiss,
  },
}))

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    })
    onlineManager.setOnline(true)
  })

  afterEach(() => {
    cleanup()
    onlineManager.setOnline(true)
  })

  it("shows a top-center toast when going offline and dismisses it when back online", () => {
    render(createElement(OfflineBanner))

    expect(toastMocks.error).not.toHaveBeenCalled()

    act(() => {
      onlineManager.setOnline(false)
    })

    expect(toastMocks.error).toHaveBeenCalledTimes(1)
    expect(toastMocks.error).toHaveBeenCalledWith(
      "No internet connection",
      expect.objectContaining({
        id: OFFLINE_TOAST_ID,
        position: "top-center",
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      }),
    )

    toastMocks.dismiss.mockClear()

    act(() => {
      onlineManager.setOnline(true)
    })

    expect(toastMocks.dismiss).toHaveBeenCalledWith(OFFLINE_TOAST_ID)
  })

  it("syncs with navigator.onLine if already offline on mount", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    })

    render(createElement(OfflineBanner))

    expect(toastMocks.error).toHaveBeenCalledWith(
      "No internet connection",
      expect.objectContaining({
        id: OFFLINE_TOAST_ID,
        position: "top-center",
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      }),
    )
  })
})
