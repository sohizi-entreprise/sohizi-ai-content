import { FILE_FORMATS, FILE_TYPES } from "@/features/file-system/constants"
import { isAllowedFileKind } from "@/features/file-system/file-kind"
import { z } from "zod"

const listFilesSchema = z
  .object({
    endpoint: z.literal("/files/list"),
    method: z.literal("GET"),
    params: z.object({
      filePath: z.string(),
    }),
  })
  .describe("List children of a directory.")

const existsFileSchema = z
  .object({
    endpoint: z.literal("/files/exists"),
    method: z.literal("GET"),
    params: z.object({
      filePath: z.string(),
    }),
  })
  .describe("check if a file or directory exists. Returns a boolean value.")

const readFileSchema = z
  .object({
    endpoint: z.literal("/files/read"),
    method: z.literal("GET"),
    params: z.object({
      filePath: z.string(),
    }),
  })
  .describe("Read the content of a file.")

const describeFileSchema = z
  .object({
    endpoint: z.literal("/files/describe"),
    method: z.literal("GET"),
    params: z.object({
      filePath: z.string(),
    }),
  })
  .describe(
    "Get the type, format, and other metadata of a file. Or the number of direct children of a directory.",
  )

const findFilesSchema = z
  .object({
    endpoint: z.literal("/files/find"),
    method: z.literal("GET"),
    params: z
      .object({
        type: z.enum(FILE_TYPES).optional(),
        format: z.enum(FILE_FORMATS).optional(),
        name: z.string().optional(),
        limit: z.number().int().optional().default(15),
      })
      .superRefine((data, ctx) => {
        if (
          !data.name?.trim() &&
          data.type === undefined &&
          data.format === undefined
        ) {
          ctx.addIssue({
            code: "custom",
            message: "At least one of name, type, or format is required",
            path: ["name"],
          })
        }

        if (
          data.type !== undefined &&
          data.format !== undefined &&
          !isAllowedFileKind(data.type, data.format)
        ) {
          ctx.addIssue({
            code: "custom",
            message: `format "${data.format}" is not allowed for type "${data.type}"`,
            path: ["format"],
          })
        }
      }),
  })
  .describe("Find files or directories by name, type, or format.")

const searchFilesSchema = z
  .object({
    endpoint: z.literal("/files/search"),
    method: z.literal("GET"),
    params: z.object({
      query: z
        .string()
        .describe(
          "Search expression using the PostgreSQL websearch_to_tsquery syntax",
        ),
    }),
  })
  .describe("Perform keyword search accross the whole project directory tree.")

const fileSyntaxSchema = z.object({
  endpoint: z.literal("/files/syntax"),
  method: z.literal("GET"),
  params: z
    .object({
      fileType: z.enum(["skill", "storyboard"]),
    })
    .describe(
      "Check the expected markdown syntax before editing certain file types.",
    ),
})

const createFileSchema = z
  .object({
    endpoint: z.literal("/files/create"),
    method: z.literal("POST"),
    body: z
      .object({
        type: z.enum(FILE_TYPES),
        format: z.enum(FILE_FORMATS),
        parentDirectoryPath: z.string(),
        name: z.string(),
        dir: z
          .boolean()
          .default(false)
          .describe("Whether to create a directory or a file"),
        anchorFilePath: z
          .string()
          .optional()
          .describe(
            "Absolute file path to anchor the new file to. Only required if insertMode is after or before",
          ),
        insertMode: z.enum(["end", "start", "after", "before"]),
      })
      .superRefine((data, ctx) => {
        if (
          (data.insertMode === "after" || data.insertMode === "before") &&
          !data.anchorFilePath
        ) {
          ctx.addIssue({
            code: "custom",
            message: `anchorFilePath is required when insertMode is ${data.insertMode}`,
            path: ["anchorFilePath"],
          })
        }

        if (
          !data.dir &&
          (data.type === "image" ||
            data.type === "video" ||
            data.type === "audio")
        ) {
          ctx.addIssue({
            code: "custom",
            message: `Cannot create empty "${data.type}" files via /files/create. Generate media using mediaOperationsAPI (/media/assets/generate) and save it to a file using /media/assets/save instead.`,
            path: ["type"],
          })
        }

        if (!data.dir && !isAllowedFileKind(data.type, data.format)) {
          ctx.addIssue({
            code: "custom",
            message: `format "${data.format}" is not allowed for type "${data.type}"`,
            path: ["format"],
          })
        }
      }),
  })
  .describe("Create a new file or directory.")

const writeFileSchema = z
  .object({
    endpoint: z.literal("/files/write"),
    method: z.literal("POST"),
    body: z.object({
      filePath: z.string(),
      content: z.string(),
      strategy: z.enum(["overwrite", "append"]),
    }),
  })
  .describe("Write to a file.")

const patchFileSchema = z
  .object({
    endpoint: z.literal("/files/patch"),
    method: z.literal("PATCH"),
    body: z.object({
      filePath: z.string(),
      oldText: z
        .string()
        .describe(
          "Exact existing text to replace. It should uniquely identify one location if replaceAll is false.",
        ),
      newText: z.string(),
      replaceAll: z.boolean().default(false),
    }),
  })
  .describe("Update the content of file")

const deleteFileSchema = z
  .object({
    endpoint: z.literal("/files/delete"),
    method: z.literal("DELETE"),
    params: z.object({
      filePath: z.string(),
    }),
  })
  .describe("Delete a file or directory.")

const moveFileSchema = z
  .object({
    endpoint: z.literal("/files/move"),
    method: z.literal("POST"),
    body: z
      .object({
        filePath: z.string(),
        newParentPath: z.string(),
        newName: z.string(),
        insertMode: z.enum(["end", "start", "after", "before"]),
        anchorFilePath: z
          .string()
          .optional()
          .describe(
            "Absolute file path to anchor the new file to. Only required if insertMode is after or before",
          ),
      })
      .superRefine((data, ctx) => {
        if (
          (data.insertMode === "after" || data.insertMode === "before") &&
          !data.anchorFilePath
        ) {
          ctx.addIssue({
            code: "custom",
            message: `anchorFilePath is required when insertMode is ${data.insertMode}`,
            path: ["anchorFilePath"],
          })
        }
      }),
  })
  .describe("Move a file or directory to a new location.")

const copyFileSchema = z
  .object({
    endpoint: z.literal("/files/copy"),
    method: z.literal("POST"),
    body: z
      .object({
        fromFilePath: z.string(),
        toFilePath: z.string(),
      })
      .superRefine((data, ctx) => {
        if (data.fromFilePath === data.toFilePath) {
          ctx.addIssue({
            code: "custom",
            message: "toFilePath must be different from fromFilePath",
            path: ["toFilePath"],
          })
        }
      }),
  })
  .describe("Copy a file or directory to a new location.")

const renameFileSchema = z
  .object({
    endpoint: z.literal("/files/rename"),
    method: z.literal("PUT"),
    body: z.object({
      filePath: z.string(),
      newName: z.string(),
    }),
  })
  .describe("Rename a file or directory.")

export const apiFileSystemSchema = [
  listFilesSchema,
  existsFileSchema,
  readFileSchema,
  describeFileSchema,
  findFilesSchema,
  searchFilesSchema,
  fileSyntaxSchema,
  createFileSchema,
  writeFileSchema,
  patchFileSchema,
  deleteFileSchema,
  moveFileSchema,
  copyFileSchema,
  renameFileSchema,
]

export type ApiFileSystemRequest = z.infer<(typeof apiFileSystemSchema)[number]>
