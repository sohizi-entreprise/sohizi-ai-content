import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { availableCategories, dslCommands, dslFlags } from "../constants/dsl";
import { DslParseError, parseDslCommand } from "../adapters/dsl-parser";

type DslCommand = {
    syntax: string;
    description: string;
    example: string;
    supportedFlags?: readonly string[];
}

const dataExplorerInputSchema = z.object({
    command: z.string().describe('The DSL command to execute. Not comments, markdown or anything else. Just the command.'),
})

export const dataExplorerTool = buildBaseTool({
    name: "dataExplorer",
    description: getDescription(),
    inputSchema: dataExplorerInputSchema,
    execute: async(input) => {
        try {
            const operation = parseDslCommand(input.command);
            return {
                success: true,
                output: '',
            }
        } catch (error) {
            if(error instanceof DslParseError){
                return {
                    success: false,
                    output: `[Invalid DSL command]: ${error.message}.`,
                }
            }
            return {
                success: false,
                output: 'An unknown error occurred',
            }
            
        }
    },
})

function getDescription() {
    return `
Use this tool to navigate and retrieve production data. It uses a custom DSL (Domain Specific Language). You MUST strictly use one of the commands below.

### SUPPORTED COMMANDS:
${Object.values(dslCommands).map((cmd, index) => formatCommand(cmd, index)).join("\n")}

### SUPPORTED FLAGS (Can be used in any order):
${Object.entries(dslFlags).map(([flag, desc], index) => `${index + 1}. **${flag}**: ${desc.description}`).join("\n")}

### SUPPORTED CATEGORIES:
${Object.entries(availableCategories).map(([key, value]) => `- **${key}**: ${value.description}`).join("\n")}

### RULES & BEST PRACTICES:
- ALWAYS use quotes around your search queries for FIND and SEARCH.
- Use SEARCH when you know the meaning but not the exact wording. Use FIND when you know the precise word/phrase.
- Use the --COUNT flag to understand the size of the data before loading it into your context window.
- NEVER combine --COUNT and LIMIT in the same command. Use --COUNT by itself to get the total number of items.
- Before using EXTRACT, use SCHEMA to verify that the category uses a JSON format and to find the correct keys. EXTRACT will fail on raw text/Fountain documents.
`
}

function formatCommand(cmd: DslCommand, index: number): string {
    return `
${index + 1}. **${cmd.syntax}**: 
- ${cmd.description}
- ${cmd.example}
- Supported flags: ${cmd.supportedFlags?.join(", ")}`

}