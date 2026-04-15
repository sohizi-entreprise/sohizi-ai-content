import { z } from "zod";
import { ParsedDslCommand } from "./dsl-parser";
import { availableCategories, availableCategoryKeys, dslCommands } from "../constants/dsl";

type CommandAdaptor = {
    [key in keyof typeof dslCommands]: {
        executor: (data: ParsedDslCommand) => Promise<unknown>;
    }
}

const listSchema = z.object({
    category: z.enum(availableCategoryKeys),
    flags: z.object({
        limit: z.coerce.number().optional(),
        count: z.boolean().default(false),
        cursor: z.string().optional(),
    }).optional()
})

const schemaSchema = z.object({
    category: z.enum(availableCategoryKeys),
})

const viewSchema = z.object({
    category: z.enum(availableCategoryKeys),
    categoryId: z.string(),
})

const extractSchema = z.object({
    category: z.enum(availableCategoryKeys),
    categoryId: z.string(),
    valueArg: z.string(),
})

const findSchema = z.object({
    category: z.enum(availableCategoryKeys),
    valueArg: z.string(),
    flags: z.object({
        limit: z.coerce.number().optional(),
        count: z.boolean().default(false),
    }).optional()
})

const searchSchema = z.object({
    category: z.enum(availableCategoryKeys),
    valueArg: z.string(),
    flags: z.object({
        limit: z.coerce.number().optional(),
        count: z.boolean().default(false),
    }).optional()
})


export const dslCommandsAdapter: CommandAdaptor = {
    LIST: {
        executor: async (data) => {
            const validated = validateData(data, listSchema);
        }
    },
    SCHEMA: {
        executor: async (data) => {
            const validated = validateData(data, schemaSchema);

        }
    },
    VIEW: {
        executor: async (data) => {
            const validated = validateData(data, viewSchema);

        }
    },
    EXTRACT: {
        executor: async (data) => {
            const validated = validateData(data, extractSchema);

        }
    },
    FIND: {
        executor: async (data) => {
            const validated = validateData(data, findSchema);

        }
    },
    SEARCH: {
        executor: async (data) => {
            const validated = validateData(data, searchSchema);

        }
    },
};

function validateData<T>(data: ParsedDslCommand, schema: z.ZodSchema<T>) {
    const parsed = schema.safeParse(data);
    if(!parsed.success){
        throw new Error(`DSL validation failed: ${parsed.error.message}`);
    }
    return parsed.data;
}
