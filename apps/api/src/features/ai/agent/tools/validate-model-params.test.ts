import { describe, expect, it } from "bun:test"
import {
  validateInput,
  type ModelParameterSchema,
} from "./validate-model-params"

function param(
  overrides: Partial<ModelParameterSchema> & Pick<ModelParameterSchema, "key">,
): ModelParameterSchema {
  return {
    type: "string",
    required: false,
    options: [],
    constraints: null,
    ...overrides,
  }
}

describe("validateInput", () => {
  it("requires omitted required fields", () => {
    expect(
      validateInput([param({ key: "prompt", required: true })], {}),
    ).toEqual({
      isValid: false,
      errorMsg:
        "This field 'prompt' is required. Please provide a value for this field.",
    })
  })

  it("accepts valid numbers and rejects out-of-range values", () => {
    const schema = [
      param({
        key: "duration",
        type: "number",
        required: true,
        constraints: { min: 1, max: 10, step: 1 },
      }),
    ]

    expect(validateInput(schema, { duration: 4 })).toEqual({
      isValid: true,
      errorMsg: null,
    })
    expect(validateInput(schema, { duration: 0 }).isValid).toBe(false)
    expect(validateInput(schema, { duration: 1.5 }).errorMsg).toContain(
      "multiple of 1",
    )
  })

  it("validates string enums, booleans, and arrays", () => {
    const schema = [
      param({ key: "size", type: "string", options: ["1K", "2K"] }),
      param({ key: "enhance", type: "boolean" }),
      param({
        key: "tags",
        type: "array<string>",
        required: true,
        constraints: { min: 1, max: 2 },
        options: ["a", "b"],
      }),
    ]

    expect(
      validateInput(schema, {
        size: "1K",
        enhance: true,
        tags: ["a"],
      }),
    ).toEqual({ isValid: true, errorMsg: null })

    const invalid = validateInput(schema, {
      size: "4K",
      enhance: "yes",
      tags: ["c"],
    })
    expect(invalid.isValid).toBe(false)
    expect(invalid.errorMsg).toContain("must be one of: 1K, 2K")
    expect(invalid.errorMsg).toContain("must be a boolean")
    expect(invalid.errorMsg).toContain("contains invalid values")
  })
})
