import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { apiFileSystemSchema } from "./api-file-system/schema"
import { apiMediaOperationsSchema } from "./api-media-operations/schema"
import { apiVideoEditorSchema } from "./api-video-editor/schema"
import { apiWebSchema } from "./api-web/schema"
import buildDoc from "./api-build-doc"
import { failure, success } from "./utils"

const apiSchemas = {
  mediaOperationsAPI: apiMediaOperationsSchema,
  videoEditorAPI: apiVideoEditorSchema,
  webAPI: apiWebSchema,
  fileSystemAPI: apiFileSystemSchema,
} as const

const apiNames = [...Object.keys(apiSchemas)] as (keyof typeof apiSchemas)[]

const getDoc = (api: keyof typeof apiSchemas) => {
  const schema = apiSchemas[api]
  return schema
    .map(
      (schema) =>
        `<documentation api="${api}">${buildDoc(schema)}</documentation>`,
    )
    .join("\n\n")
}

export const apiDocReadTool = buildBaseTool({
  name: "apiDocRead",
  description: `Returns the endpoint contract (method, body, and parameters) for one API tool. Call this before ${apiNames.join(", ")} when you need that contract.`,
  inputSchema: z.object({
    api: z.enum(apiNames),
  }),
  execute: async (input, _options) => {
    const doc = getDoc(input.api)
    if (!doc.trim()) {
      return failure(`No documentation found for API: ${input.api}`)
    }
    return success(doc)
  },
})
