import { describe, expect, test } from "bun:test"
import { APICallError } from "ai"
import {
  classifyLlmError,
  classifyMediaError,
  classifyRenderError,
  classifyWebError,
} from "./classify"
import { MediaSubmissionUnknownError } from "@/features/media-engine/providers/type"
import { TavilyHttpError, TavilyRequestError } from "@/lib/tavily-client"

describe("capacity error actions", () => {
  test("LLM status codes map to route, client, and account actions", () => {
    expect(
      classifyLlmError(
        new APICallError({
          message: "missing",
          url: "https://example.com",
          requestBodyValues: {},
          statusCode: 404,
          isRetryable: false,
        }),
      ),
    ).toBe("route_failure")
    expect(
      classifyLlmError(
        new APICallError({
          message: "bad",
          url: "https://example.com",
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        }),
      ),
    ).toBe("client_failure")
    expect(
      classifyLlmError(
        new APICallError({
          message: "limited",
          url: "https://example.com",
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        }),
      ),
    ).toBe("account_failure")
  })

  test("an ambiguous media submit is not a failover", () => {
    expect(
      classifyMediaError(new MediaSubmissionUnknownError("timed out")),
    ).toBe("submission_unknown")
  })

  test("web transport failures are account failures and 404 is a route failure", () => {
    expect(classifyWebError(new TavilyRequestError("network"))).toBe(
      "account_failure",
    )
    expect(classifyWebError(new TavilyHttpError(404, "missing"))).toBe(
      "route_failure",
    )
  })

  test("render ambiguity is distinct from a definite rejection", () => {
    expect(classifyRenderError(new Error("timeout"))).toBe("submission_unknown")
    expect(classifyRenderError(new Error("bad request"))).toBe("client_failure")
  })
})
