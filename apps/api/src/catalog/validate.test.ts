import { describe, expect, it } from "bun:test"
import { validateCatalog, validateTrackedModels } from "./validate"
import { withInheritedFileType } from "./load"
import type {
  Catalog,
  CatalogModel,
  CatalogParameter,
  CatalogVendor,
} from "./load"

const parameter = (
  overrides: Partial<CatalogParameter> & Pick<CatalogParameter, "id" | "key">,
): CatalogParameter => ({
  label: overrides.key,
  type: "string",
  options: [],
  ...overrides,
})

const model = (
  overrides: Partial<CatalogModel> & Pick<CatalogModel, "id">,
): CatalogModel => ({
  name: overrides.id,
  provider: "test",
  contextWindow: null,
  pricing: null,
  categories: ["text-to-image"],
  parameters: [],
  sourceFile: "memory",
  ...overrides,
})

const vendor = (
  overrides: Partial<CatalogVendor> & Pick<CatalogVendor, "id">,
): CatalogVendor => ({
  name: overrides.id,
  adapter: "wavespeed",
  kind: "media",
  models: [],
  parametersMapping: {},
  modelParameterOverrides: {},
  sourceFile: "memory",
  ...overrides,
})

const catalog = (overrides: Partial<Catalog> = {}): Catalog => ({
  categories: [{ id: "text-to-image", name: "text-to-image", description: "" }],
  parameters: [],
  models: [],
  vendors: [],
  presets: [],
  commands: [],
  ...overrides,
})

describe("validateCatalog", () => {
  it("rejects duplicate parameter ids", () => {
    const errors = validateCatalog(
      catalog({
        parameters: [
          parameter({ id: "parameter_prompt", key: "prompt" }),
          parameter({ id: "parameter_prompt", key: "prompt_copy" }),
        ],
      }),
    )

    expect(
      errors.some((error) =>
        error.includes('duplicate parameter id "parameter_prompt"'),
      ),
    ).toBe(true)
  })

  it("rejects duplicate option ids", () => {
    const errors = validateCatalog(
      catalog({
        parameters: [
          parameter({
            id: "parameter_quality",
            key: "quality",
            options: [{ id: "option_quality_low", value: "low", label: "Low" }],
          }),
          parameter({
            id: "parameter_resolution",
            key: "resolution",
            options: [{ id: "option_quality_low", value: "1k", label: "1K" }],
          }),
        ],
      }),
    )

    expect(
      errors.some((error) =>
        error.includes('duplicate option id "option_quality_low"'),
      ),
    ).toBe(true)
  })

  it("rejects a vendor without an adapter", () => {
    const errors = validateCatalog(
      catalog({
        models: [model({ id: "x-ai/grok-imagine-image-v2.0/text-to-image" })],
        vendors: [
          vendor({
            id: "vendor_wavespeed",
            adapter: "",
            models: [
              {
                id: "x-ai/grok-imagine-image-v2.0/text-to-image",
                apiName: "x-ai/grok-imagine-image-v2.0/text-to-image",
              },
            ],
          }),
        ],
      }),
    )

    expect(
      errors.some((error) => error.includes("is missing an adapter")),
    ).toBe(true)
  })

  it("rejects a model that references an unknown parameter", () => {
    const errors = validateCatalog(
      catalog({
        parameters: [parameter({ id: "parameter_prompt", key: "prompt" })],
        models: [
          model({
            id: "x-ai/grok-imagine-image-v2.0/text-to-image",
            parameters: [{ id: "parameter_missing", required: true }],
          }),
        ],
        vendors: [
          vendor({
            id: "vendor_wavespeed",
            models: [
              {
                id: "x-ai/grok-imagine-image-v2.0/text-to-image",
                apiName: "x-ai/grok-imagine-image-v2.0/text-to-image",
              },
            ],
          }),
        ],
      }),
    )

    expect(
      errors.some((error) =>
        error.includes('references unknown parameter "parameter_missing"'),
      ),
    ).toBe(true)
  })

  it("validates default preferences against model categories and price keys", () => {
    const errors = validateCatalog(
      catalog({
        models: [
          model({
            id: "x-ai/grok-imagine-image-v2.0/text-to-image",
            categories: ["text-to-image"],
            pricing: {
              unit: "parameter_table",
              rate: [
                {
                  when: { quality: "medium", resolution: "1k" },
                  usd: 0.06,
                },
              ],
            },
          }),
        ],
        vendors: [
          vendor({
            id: "vendor_wavespeed",
            models: [
              {
                id: "x-ai/grok-imagine-image-v2.0/text-to-image",
                apiName: "x-ai/grok-imagine-image-v2.0/text-to-image",
              },
            ],
          }),
        ],
        preferences: [
          {
            key: "text-to-image",
            label: "Image",
            description: "Still image",
            category: "text-to-image",
            modelId: "x-ai/grok-imagine-image-v2.0/text-to-image",
            parameters: { quality: "medium", bogus: "1" },
          },
        ],
      }),
    )

    expect(
      errors.some((error) =>
        error.includes('parameter "bogus" is not a price key'),
      ),
    ).toBe(true)
    expect(
      errors.some((error) =>
        error.includes('missing price parameter "resolution"'),
      ),
    ).toBe(true)
  })
})

describe("validateTrackedModels", () => {
  it("rejects a tracked model that is not in the catalog", () => {
    const errors = validateTrackedModels(
      catalog({
        models: [model({ id: "openai/gpt-6-luna" })],
      }),
      {
        explorer: "openai/gpt-6-luna",
        summarizer: "google/gemini-2.5-flash-lite",
      },
    )

    expect(errors).toEqual([
      'modelsTracker.summarizer references unregistered model "google/gemini-2.5-flash-lite"',
    ])
  })

  it("accepts tracked models that are registered", () => {
    const errors = validateTrackedModels(
      catalog({
        models: [
          model({ id: "openai/gpt-6-luna" }),
          model({ id: "google/gemini-2.5-flash-lite" }),
        ],
      }),
      {
        explorer: "openai/gpt-6-luna",
        summarizer: "google/gemini-2.5-flash-lite",
      },
    )

    expect(errors).toEqual([])
  })
})

describe("withInheritedFileType", () => {
  it("copies the parameter file type when a binding omits it", () => {
    expect(withInheritedFileType({ max: 10 }, "video")).toEqual({
      max: 10,
      fileType: "video",
    })
  })

  it("keeps an explicit binding file type", () => {
    expect(
      withInheritedFileType({ max: 10, fileType: "audio" }, "video"),
    ).toEqual({
      max: 10,
      fileType: "audio",
    })
  })

  it("returns null when there is no constraint and no file type", () => {
    expect(withInheritedFileType(null, null)).toBeNull()
  })
})
