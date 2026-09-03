import { z } from "zod"

export const marketListQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.uuid().optional(),
})

export const installSkillSchema = z
  .object({
    skillId: z.uuid(),
    mode: z.enum(["create", "replace", "rename"]).optional().default("create"),
    name: z.string().trim().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "rename" && !data.name) {
      ctx.addIssue({
        code: "custom",
        message: "Name is required when mode is rename",
        path: ["name"],
      })
    }
  })

export const nameAvailableQuerySchema = z.object({
  name: z.string().trim().min(1).max(50),
})

export type InstallSkillInput = z.infer<typeof installSkillSchema>
