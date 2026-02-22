

export class SystemPromptBuilder {
    private systemPrompt: string;

    constructor() {
        this.systemPrompt = '';
    }

    public addIdentity(identity: string) {
        this.systemPrompt += `\n<identity>${identity}</identity>`;
        return this;
    }

    public addMemoryContext(memoryContext: string, description?: string) {
        this.systemPrompt += `\n<memory_context>${description ? `${description}\n---\n${memoryContext}` : memoryContext}</memory_context>`;
        return this;
    }

    public addEnvironmentContext(environmentContext: string) {
        this.systemPrompt += `\n<environment_context>${environmentContext}</environment_context>`;
        return this;
    }

    public addPolicyContext(policyContext: string) {
        this.systemPrompt += `\n<policy_context>${policyContext}</policy_context>`;
        return this;
    }

    public addWorkingContext(workingContext: string, description?: string) {
        this.systemPrompt += `\n<working_context>${description ? `${description}\n---\n${workingContext}` : workingContext}</working_context>`;
        return this;
    }

    public addOutputFormat(outputFormat: string, description?: string) {
        this.systemPrompt += `\n<output_format>${description ? `${description}\n---\n${outputFormat}` : outputFormat}</output_format>`;
        return this;
    }

    public addSkills(skills: string | string[]) {
        if (Array.isArray(skills)) {
            this.systemPrompt += `\n<skill_sets>${skills.join('\n---\n')}</skill_sets>`;
        } else {
            this.systemPrompt += `\n<skill_sets>${skills}</skill_sets>`;
        }
        return this;
    }

    public build() {
        return this.systemPrompt
    }
}


