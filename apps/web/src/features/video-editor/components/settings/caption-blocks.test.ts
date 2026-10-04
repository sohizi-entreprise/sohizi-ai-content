import { describe, expect, it } from "vitest"
import {
  formatCaptionTimestamp,
  groupCaptionBlocks,
} from "./caption-blocks"
import type { ServerCaption } from "../../store/types"

function word(
  text: string,
  start: number,
  end: number,
): ServerCaption {
  return { word: text, start, end }
}

describe("groupCaptionBlocks", () => {
  it("returns nothing when there are no words", () => {
    expect(groupCaptionBlocks([])).toEqual([])
  })

  it("separates words that have no leading space", () => {
    expect(
      groupCaptionBlocks([
        word("distinguished", 18.28, 18.8),
        word("guests", 18.8, 19.2),
        word("ladies", 19.2, 19.6),
        word("and", 19.6, 19.8),
        word("gentlemen", 19.8, 21.92),
      ]),
    ).toEqual([
      {
        start: 18.28,
        end: 21.92,
        text: "distinguished guests ladies and gentlemen",
      },
    ])
  })

  it("keeps a short phrase in one block", () => {
    expect(
      groupCaptionBlocks([
        word(" DR", 0, 0.3),
        word(" Congo", 0.3, 0.7),
        word(" just", 0.7, 1.1),
      ]),
    ).toEqual([{ start: 0, end: 1.1, text: "DR Congo just" }])
  })

  it("starts a new block after a sentence", () => {
    expect(
      groupCaptionBlocks([
        word(" Hello", 0, 0.4),
        word(" there.", 0.4, 0.9),
        word(" Next", 1.0, 1.4),
      ]),
    ).toEqual([
      { start: 0, end: 0.9, text: "Hello there." },
      { start: 1, end: 1.4, text: "Next" },
    ])
  })

  it("starts a new block after a pause", () => {
    expect(
      groupCaptionBlocks([
        word(" Wait", 0, 0.4),
        word(" now", 1.3, 1.7),
      ]),
    ).toEqual([
      { start: 0, end: 0.4, text: "Wait" },
      { start: 1.3, end: 1.7, text: "now" },
    ])
  })
})

describe("formatCaptionTimestamp", () => {
  it("formats seconds as minutes, seconds, and hundredths", () => {
    expect(formatCaptionTimestamp(0)).toBe("00:00.00")
    expect(formatCaptionTimestamp(4.12)).toBe("00:04.12")
    expect(formatCaptionTimestamp(65.2)).toBe("01:05.20")
  })
})
