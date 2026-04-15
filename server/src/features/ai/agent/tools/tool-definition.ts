import { z, toJSONSchema } from "zod";
import { AgenticToolChunk, streamEvents, ToolCall, ToolResultComplete } from "../utils/llm-response";
import { AgentChunk, Agent, AgentState } from "../core/agent";
import { Session } from "../core/session";

export type ToolResult = {
    success: boolean;
    output: string;
    metadata?: Record<string, unknown>;
}

type AgenticToolResult = AgentChunk | AgenticToolChunk;

interface BaseToolDefinition<T extends z.ZodSchema> {
    name: string;
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>, options: {session: Session, state: AgentState}) => Promise<ToolResult> | AsyncGenerator<AgenticToolResult, void, unknown>;
}

export class BaseTool<T extends z.ZodSchema>{
    public readonly params: BaseToolDefinition<T>;
    constructor(params: BaseToolDefinition<T>){
        this.params = params;
    }

    get schema(): string{
        return "TBD"
    }

    async* execute(toolCall: ToolCall, session: Session, state: AgentState): AsyncGenerator<ToolResultComplete | AgentChunk, void, unknown>{
        try {
            const args = this.validateInput(toolCall.input);
            const isGenerator = this.params.execute.constructor.name === "AsyncGeneratorFunction";
            const result = await this.params.execute(args, {session, state});
            if(isGenerator){
                for await (const chunk of result as AsyncGenerator<AgenticToolResult, void, unknown>){
                    if(chunk.type === streamEvents.toolResultComplete){
                        yield {
                            type: streamEvents.toolResultComplete,
                            toolName: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            success: chunk.success,
                            output: chunk.output,
                            usage: chunk.usage,
                        };
                    }else{
                        yield chunk;
                    }
                }
                yield* (result as AsyncGenerator<AgentChunk, void, unknown>);
            } else {
                const event = this.buildEvent(toolCall, result as ToolResult);
                yield event;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const event = this.buildEvent(toolCall, {
                success: false,
                output: errorMsg,
            });
            yield event;
        }
    }

    private validateInput(input: string): z.core.output<T>{
        try {
            const parsed = JSON.parse(input);
            const validated = this.params.inputSchema.safeParse(parsed);
            if(!validated.success){
                throw new Error(`Your input is invalid: ${validated.error.message}. The expected input is:\n ${JSON.stringify(toJSONSchema(this.params.inputSchema))}.`);
            }
            return validated.data;
            
        } catch (error) {
            throw new Error(`Your provided input is not a valid JSON object`)
            
        }
    }

    private buildEvent(toolCall: ToolCall, result: ToolResult): ToolResultComplete{
        return {
            type: streamEvents.toolResultComplete,
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            success: result.success,
            output: result.output,
            usage: {
                input: 0,
                output: 0,
                reasoning: 0,
                cached: 0,
                total: 0
            },
            metadata: result.metadata,
        }
    }
}


export const buildBaseTool = <T extends z.ZodSchema>(params: BaseToolDefinition<T>): BaseTool<T> => {
    return new BaseTool(params);
}

export const buildAgentTool = <T extends z.ZodSchema>(params: BaseToolDefinition<T>): BaseTool<T> => {
    const execute = async function*(args: z.infer<T>){
        // const agent = new Agent();
        // yield* agent.runLoop(userPrompt, new AbortController().signal, 25);
        // const {modelId: _, ...usage} = agent.state.usage!
        // yield {
        //     type: streamEvents.toolResultComplete,
        //     success: agent.state.finishReason === "stop",
        //     output: agent.lastAgentText ?? '',
        //     usage,
        // }

    }
    return new BaseTool({...params, execute});
}

/*
loadSkill
readOutline [screenplay, entities, etc...]
viewComponent [scene, entity, etc...]
viewProjectRequirements
searchScreenplay
read schema
todoWrite

rewritecomponent [synopsis, story_bible, scene, entity, etc...]
createEntity [character, location, prop]
insertScene [scene]
deleteProjectComponent [scene, entity, etc...]
editContent [synopsis, story_bible, scene, entity, etc...]
delegateTask [task]

===
loadskill
todoWrite
assignTask
validateOutput — Check an entity against its schema [We can also do it ourself]
dataExplorer [LIST, SHEMA, VIEW, EXTRACT, FIND, SEARCH]
- Categories: scenes, characters, locations, props, synopsis, story_bible, project_requirements
- LIST <category> [LIMIT <n>] [OFFSET <n>]  -> string[] (list of IDs)
- VIEW <category>:<id> -> JSONschema
- SCHEMA <category>  -> ...
- EXTRACT <category>:<id> <field | json path>
- FIND <category> IN <field | ALL> "<exact_keyword>" [LIMIT <n>]
- SEARCH <category> "<semantic_query>"
- COUNT <category>                    → number
- COUNT <category> IN <field> "<kw>"  → number
- SUMMARIZE <category> <id> (Or maybe let's make it a tool?)


FIND   → exact match  — use when you know the precise word/phrase (e.g. a character name, a location slug)
SEARCH → semantic     — use when you know the meaning but not the exact wording
Prefer FIND  for: IDs, names, slugs, enum values
Prefer SEARCH for: events, emotions, plot beats, abstract concepts

---
LIST <category>
Example: LIST characters
SCHEMA <category>
Example: SCHEMA scenes (Returns the expected JSON structure for this category)
VIEW <category>:<category_id>
Example: VIEW scenes:scene_04 (Returns the full document)
EXTRACT <category>:<category_id> <field | json.path>
Example: EXTRACT characters:luke_skywalker personality.flaws (Use dot-notation for nested JSON paths)
FIND <category> IN <field | ALL> "<exact_keyword>"
Example: FIND locations IN description "abandoned warehouse" (Always use quotes around the keyword)
SEARCH <category> "<semantic_query>"
Example: SEARCH scenes "the hero finally defeats the villain" (Performs an AI vector search based on meaning)

---
<field>     → top-level key             e.g.  tone
<jsonpath>  → dot-notation nested key   e.g.  arc.phase_2.goal

Writing a new component from scratch
{
"category": "scenes | characters | shot | locations | props | synopsis | story_bible",
"outputFormat": "json | text | fountain"
"output": ""
}

Editing an existing component
{
"category": "scenes | characters | shot | locations | props | synopsis | story_bible | project_requirements",
"targetId": "id",
"outputFormat": "json | text | fountain"
"output": ""
}

Patching
- scene ()
  {
    "category": "scenes",
    "targetId": "id",
    "initialText": <The text you want to replace, make sure the selected chunk is unique to avoid replacing the same text multiple times>
    "replaceBy": <The new text to replace the target with>
  }
- text
  {
    "category": "scenes | characters | shot | locations | props | synopsis | story_bible | project_requirements",
    "targetId": "id",
    "outputFormat": "text",
    "output": "text"
  }
*/