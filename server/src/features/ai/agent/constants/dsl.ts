
export const availableCategories = {
    scenes: {
        description:
            "Catalog of scene documents (LIST returns many IDs). Each item is one scene; the full document body is **Fountain** screenplay text, not JSON. Use SCHEMA/VIEW for structure and text; EXTRACT dot-paths apply only to structured fields if present.",
    },
    characters: {
        description:
            "Catalog of character records (LIST returns many IDs). Each item is **one JSON object** (name, bio, traits, arcs, etc.).",
    },
    shots: {
        description:
            "Catalog of shots (LIST returns many IDs). Each item is **one JSON object** (scene link, slugline, camera/action notes).",
    },
    locations: {
        description:
            "Catalog of locations (LIST returns many IDs). Each item is **one JSON object** (name, geography, look, story use).",
    },
    props: {
        description:
            "Catalog of props (LIST returns many IDs). Each item is **one JSON object** (name, description, how it appears in the story).",
    },
    synopsis: {
        description:
            "Synopsis records for the project (often a small set of IDs). Each document is **one JSON object** (e.g. logline, summary, tags)—not Fountain.",
    },
    story_bible: {
        description:
            "World bible material (often **one primary JSON document** per project, sometimes versioned). Structured sections for tone, rules, lore—not Fountain.",
    },
    project_requirements: {
        description:
            "Catalog of requirement rows (LIST returns many IDs). Each item is **one JSON object** (constraint, priority, owner, status, etc.).",
    },
} as const;

export const availableCategoryKeys = Object.keys(availableCategories) as (keyof typeof availableCategories)[];

export type DslParseContract = {
    /** Trailing shell token(s) after category/flags (e.g. search phrase, JSON path). */
    trailingValue: "none" | "required";
    /** Category token must include `:id`. */
    requireCategoryId?: boolean;
};

export const dslCommands = {
    LIST: {
        name: "LIST",
        syntax: "LIST <category> [LIMIT <n>] [CURSOR <category_id>] [--COUNT]",
        description: "Returns an ordered list of available IDs and minimal metadata in a category.",
        example:
            "Example1: LIST characters\nExample2: LIST scenes LIMIT 5 CURSOR scene_003 (Returns at most 5 scenes starting from scene_003)",
        supportedFlags: ["LIMIT", "CURSOR", "--COUNT"],
        parseContract: { trailingValue: "none" } satisfies DslParseContract,
    },
    SCHEMA: {
        name: "SCHEMA",
        syntax: "SCHEMA <category>",
        description:
            "Use this BEFORE creating or EXTRACTing content. Returns the expected shape: **JSON** fields for all categories except **scenes** (Fountain body).",
        example: "Example: SCHEMA characters (JSON field layout). SCHEMA scenes (Fountain-oriented layout if applicable).",
        parseContract: { trailingValue: "none" } satisfies DslParseContract,
    },
    VIEW: {
        name: "VIEW",
        syntax: "VIEW <category>:<category_id>",
        description: "Returns the complete document for a specific category item.",
        example: "Example: VIEW scenes:scene_004 (Fountain). VIEW characters:luke_skywalker (JSON).",
        parseContract: { trailingValue: "none", requireCategoryId: true } satisfies DslParseContract,
    },
    EXTRACT: {
        name: "EXTRACT",
        syntax: "EXTRACT <category>:<category_id> <json.path>",
        description:
            "Returns one value from a **JSON** path (dot notation). For **scenes**, paths only apply where structured JSON exists alongside Fountain—use SCHEMA first.",
        example: "Example: EXTRACT characters:luke_skywalker personality.flaws",
        parseContract: { trailingValue: "required", requireCategoryId: true } satisfies DslParseContract,
    },
    FIND: {
        name: "FIND",
        syntax: 'FIND <category> "<exact_keyword>" [LIMIT <n>] [--COUNT]',
        description:
            "Exact keyword search. Use when you know the precise phrase.",
        example: 'Example: FIND locations "abandoned warehouse"',
        supportedFlags: ["LIMIT", "--COUNT"],
        parseContract: { trailingValue: "required" } satisfies DslParseContract,
    },
    SEARCH: {
        name: "SEARCH",
        syntax: 'SEARCH <category> "<semantic_query>" [LIMIT <n>] [--COUNT]',
        description: "Semantic search by meaning when exact keywords are unreliable.",
        example: 'Example: SEARCH scenes "the hero finally defeats the villain"',
        supportedFlags: ["LIMIT", "--COUNT"],
        parseContract: { trailingValue: "required" } satisfies DslParseContract,
    },
} as const;

export const dslFlags = {
    LIMIT: {
        description: "Optional. The number of results to return. If not provided, all results will be returned.",
        label: "limit",
        type: "number",
    },
    CURSOR: {
        description: "Optional. The ID of the item from which to start the list.",
        label: "cursor",
        type: "string",
    },
    "--COUNT": {
        description:
            "Optional. Returns ONLY the total number of items in the category/search instead of the list.",
        label: "count",
        type: "boolean",
    },
} as const;

/** Pairs of parsed flag labels that must not be active together (driven by `dslFlags`). */
export const dslParsedFlagConflicts = [
    [dslFlags.LIMIT.label, dslFlags["--COUNT"].label],
] as const satisfies readonly (readonly [
    (typeof dslFlags)[keyof typeof dslFlags]["label"],
    (typeof dslFlags)[keyof typeof dslFlags]["label"],
])[];
