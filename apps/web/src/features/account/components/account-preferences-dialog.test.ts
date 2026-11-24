import { describe, expect, it } from "vitest"
import { formatEstimateText } from "./account-preferences-dialog"
import { formatCredits, formatDate } from "./billing-summary"
import {
  ACCOUNT_PREFERENCES_TAB_ID,
  useEditorStore,
} from "@/features/editor/stores/editor-store"

describe("account-preferences-dialog helpers", () => {
  it("formats fixed and range model preference estimates", () => {
    expect(formatEstimateText(null)).toBeNull()
    expect(
      formatEstimateText({
        kind: "fixed",
        credits: 9,
        unitLabel: "credits",
      }),
    ).toBe("9 credits")
    expect(
      formatEstimateText({
        kind: "range",
        minCredits: 307,
        maxCredits: 1150,
        unitLabel: "credits (depending on duration)",
      }),
    ).toBe("307 - 1,150 credits (depending on duration)")
  })

  it("formats billing credits and dates", () => {
    expect(formatCredits("12500")).toBe("12,500")
    expect(formatDate(null)).toBe("—")
  })

  it("opens and re-focuses the account preferences editor tab without duplicating it", () => {
    useEditorStore.getState().closeAllTabs()
    useEditorStore.getState().openAccountPreferencesTab()

    expect(useEditorStore.getState().activeTabId).toBe(
      ACCOUNT_PREFERENCES_TAB_ID,
    )
    expect(useEditorStore.getState().openTabs).toHaveLength(1)
    expect(useEditorStore.getState().openTabs[0]?.name).toBe(
      "Preferences & Billing",
    )

    useEditorStore.getState().openAccountPreferencesTab()
    expect(useEditorStore.getState().openTabs).toHaveLength(1)
  })
})
