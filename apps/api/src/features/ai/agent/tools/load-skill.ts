import { buildBaseTool } from "./tool-definition"
import { z } from "zod"
import { failure, success } from "./utils"

const loadSkillSchema = z.object({
  name: z.string().describe("The name of the skill to load."),
})

export const loadSkillTool = buildBaseTool({
  name: "loadSkill",
  description: "Call this tool to load a skill into your context.",
  inputSchema: loadSkillSchema,
  execute: async (input, { session }) => {
    const skillInstructions = await session.resolveSkill(input.name)
    if (!skillInstructions) {
      return failure(`Skill "${input.name}" not found.`)
    }
    return success(skillInstructions)
  },
})
