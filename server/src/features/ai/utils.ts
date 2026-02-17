import { projectRepo } from "@/entities/project";

type ProjectData = Awaited<ReturnType<typeof projectRepo.getProjectById>>;

export function createProjectContext(project: NonNullable<ProjectData>) {
    return `
PROJECT CONTEXT:
- Name: ${project.name}
- Format: ${project.format}
- Tone: ${project.tone}
- Genre: ${project.genre}
- Audience: ${project.audience}
- Language: ${project.language}
${project.constraints ? `
CONSTRAINTS:
- Must include: ${project.constraints.mustInclude?.join(', ') || 'None'}
- Must avoid: ${project.constraints.mustAvoid?.join(', ') || 'None'}
- Forbidden phrases: ${project.constraints.forbiddenPhrases?.join(', ') || 'None'}
` : ''}
INITIAL IDEA:
${project.initialInput?.content || 'No initial input provided'}
`.trim();
}