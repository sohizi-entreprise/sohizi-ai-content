import { z } from "zod"

export const apiGenericApiSchema = z.object({
  endpoint: z.string(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  params: z.record(z.string(), z.any()).optional(),
  body: z.record(z.string(), z.any()).optional(),
})
