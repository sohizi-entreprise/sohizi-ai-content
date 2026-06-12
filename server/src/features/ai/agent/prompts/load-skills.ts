import { Skill } from "@/db/schema"

export const loadSkillsPrompt = (skills: Skill[]) => {

    return `
### SKILLS

Skills are modular prompt/knowledge units that teach you how to perform specific tasks.
You can load a skill based on its ID using the read command of the \`exploreFile\` tool.

#### Here is the list of skills you can load:

${skills.map((skill, index) => `${index + 1}. ${skill.name} [ID: ${skill.id}] : ${skill.description}`).join('\n')}
    `.trim()

}