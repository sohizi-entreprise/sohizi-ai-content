import { describe, expect, test } from "bun:test"
import { mediaOverheadRate } from "./catalog-cost"
import {
  AUDIO_OVERHEAD_RATE,
  IMAGE_OVERHEAD_RATE,
  VIDEO_OVERHEAD_RATE,
} from "@/features/billing/constants"
import { providerCostToCredits } from "./generators/cost-utils"

describe("mediaOverheadRate", () => {
  test("uses the video rate for video jobs", () => {
    expect(mediaOverheadRate("video")).toBe(VIDEO_OVERHEAD_RATE)
  })

  test("uses the audio rate for audio jobs", () => {
    expect(mediaOverheadRate("audio")).toBe(AUDIO_OVERHEAD_RATE)
  })

  test("uses the image rate for stills", () => {
    expect(mediaOverheadRate("image")).toBe(IMAGE_OVERHEAD_RATE)
  })
})

describe("catalog media credit conversion", () => {
  test("converts a flat image rate into reserved credits", () => {
    expect(
      Number(
        providerCostToCredits(0.03, {
          overheadRate: mediaOverheadRate("image"),
          overbookingFactor: 1,
        }),
      ),
    ).toBe(13)
  })
})
