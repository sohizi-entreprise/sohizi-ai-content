import { parse, type ParseEntry } from "shell-quote";
import { availableCategories, dslCommands, dslFlags, dslParsedFlagConflicts } from "../constants/dsl";

/*
The general shape of the DSL is:
<command> <category[:id]> [LIMIT <n>] [CURSOR <category_id>] [--COUNT]

category - categoryId? - flags {limit: number, cursor: string, count: boolean} - valueArgs?
*/

type DslCommand = typeof dslCommands[keyof typeof dslCommands] 
& {
    supportedFlags?: string[];
}

type Category = keyof typeof availableCategories;

const availableCategoryKeys = Object.keys(availableCategories);
const availableCommandKeys = Object.keys(dslCommands);
const CATEGORY_SET = new Set<string>(availableCategoryKeys);
const COMMAND_SET = new Set<string>(availableCommandKeys);

export type ParsedDslCommand = {
    command: keyof typeof dslCommands;
    category: Category;
    categoryId?: string;
    flags?: Partial<Record<(typeof dslFlags)[keyof typeof dslFlags]["label"], string | boolean>>;
    valueArg?: string;
}

export class DslParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DslParseError";
    }
}

export class DslParser{
    private tokens: string[];
    private readonly command: string;
    private currentIndex: number;
    private seen: Set<string>;
    private currentCommand: DslCommand | null;
    private previousToken: string | null;
    private currentToken: string | null;
    private result: ParsedDslCommand | null;
    private done: boolean

    constructor(command: string){
        this.tokens = [];
        this.command = command;
        this.currentIndex = -1;
        this.seen = new Set<string>();
        this.currentCommand = null;
        this.previousToken = null;
        this.currentToken = null;
        this.result = null;
        this.done = false;
    }

    parse(){
        const valueArgs: string[] = [];
        this.tokenizeCommand();

        while(!this.done){
            // Get the token
            this.advance();
            if(!this.currentToken){
                break
            }
            if(this.isCommand(this.currentToken)){
               this.handleCommand(this.currentToken);
               continue;
            }

            if(this.isCategory(this.currentToken)){
                this.handleCategory(this.currentToken);
                continue;
            }

            if(this.isSingletonFlag(this.currentToken)){
                this.checkifFlagAllowedInCommand(this.currentToken);
                this.checkDuplicates(this.currentToken, "flag");
                this.saveFlag(this.currentToken, true);
                continue;
            }

            if(this.isFlag(this.currentToken)){
                this.checkifFlagAllowedInCommand(this.currentToken);
                this.checkDuplicates(this.currentToken, "flag");
                const flagKey = this.currentToken;
                this.advance();
                const flagValue = this.currentToken;
                this.validateFlagValue(flagValue, flagKey);
                this.saveFlag(flagKey, flagValue);
                continue;
            }

            valueArgs.push(this.currentToken);
        }
        if(valueArgs.length > 1){
            throw new DslParseError(`DSL parsing error: Expected only one value argument for command "${this.currentCommand?.name}". Got ${valueArgs.length}: ${valueArgs.join(", ")}`);
        }

        if(!this.result){
            throw new DslParseError("Invalid DSL syntax: Missing either a command or category.");
        }
        this.result.valueArg = valueArgs[0];
        this.validateParsedCommand();
        return this.result;
    }

    private advance() {
        this.previousToken = this.tokens[this.currentIndex] ?? null;
        this.currentIndex++;
        this.currentToken = this.tokens[this.currentIndex] ?? null;
        this.done = this.currentIndex >= this.tokens.length;
    }

    private isCommand(token: string): boolean {
        return COMMAND_SET.has(token.toUpperCase() as keyof typeof dslCommands);
    }

    private handleCommand(token: string): void {
        // It should be the first token
        if(this.currentIndex !== 0){
            throw new DslParseError(`Command "${token}" should be the first token`);
        }
        this.checkDuplicates(token, "command");
        this.currentCommand = dslCommands[token.toUpperCase() as keyof typeof dslCommands] as DslCommand;
    }

    private isCategory(token: string): boolean {
        const category = token.split(":")[0]?.toLowerCase() as Category;
        return CATEGORY_SET.has(category);
    }

    private handleCategory(token: string): void {
        // The previous token should be a command
        if(!this.previousToken || !this.currentCommand){
            throw new DslParseError(`Category "${token}" should be after a command`);
        }
        const splitList = token.split(":");
        if(splitList.length > 2){
            throw new DslParseError(`Invalid category "${token}". Expected a single colon separated category and id`);
        }
        const [category, categoryId] = splitList

        if(categoryId?.trim() === ""){
            throw new DslParseError(`Category ID can not be empty after the category: COMMAND <category>:<id> `);
        }

        // We create the result here because category and command are the 2 minimum required fields
        this.result = {
            command: this.currentCommand.name,
            category: category.toLowerCase() as Category,
            categoryId,
            flags: undefined,
            valueArg: undefined,
        }
    }

    private isSingletonFlag(token: string): boolean {
        return this.isFlag(token) && token.startsWith("--");
    }

    private isFlag(token: string): boolean {
        return dslFlags[token as keyof typeof dslFlags] !== undefined;
    }

    private saveFlag(flagName: string, flagValue: string | boolean) {
        if(!this.result){
            throw new DslParseError("DSL parsing error: Flags should be used after a command and category");
        }
        const flag = dslFlags[flagName as keyof typeof dslFlags];
        if(!flag){
            throw new DslParseError(`Unknown flag "${flagName}"`);
        }
        this.result.flags = {
            ...(this.result.flags || {}),
            [flag.label]: flagValue,
        };
    }

    private checkifFlagAllowedInCommand(token: string) {
        if(!this.currentCommand?.supportedFlags?.includes(token)){
            throw new DslParseError(`Flag "${token}" is not supported by the "${this.currentCommand?.name}" command`);
        }
    }

    private validateFlagValue(token: string | undefined, flagName: string) {
        if(!token){
            throw new DslParseError(`A value is required after the flag "${flagName}"`);
        }
        // It shouldn't be a command, category or flag
        if(this.isCommand(token) || this.isCategory(token) || this.isFlag(token)){
            throw new DslParseError(`The value "${token}" after the flag "${flagName}" should not be a command, category or flag`);
        }
    }

    private checkDuplicates(token: string, type: "command" | "flag"): void {
        if(this.seen.has(token)){
            throw new DslParseError(`You have duplicated ${type} "${token}"`);
        }
        this.seen.add(token);
    }

    private tokenizeCommand(){
        const trimmed = this.command.trim();
        if (!trimmed) {
            throw new DslParseError("Empty command");
        }
    
        const entries: ParseEntry[] = parse(trimmed);
        const tokens: string[] = [];
    
        for (const entry of entries) {
            if (typeof entry === "string") {
                tokens.push(entry);
            } else if ("comment" in entry) {
                continue;
            } else {
                throw new DslParseError(
                    "Unsupported shell syntax in command (pipes, redirects, or operators are not allowed)"
                );
            }
        }
    
        if (tokens.length === 0) {
            throw new DslParseError("Empty command after parsing");
        }
    
        this.tokens = tokens;
    }

    private validateParsedCommand(): void {
        if (!this.result) {
            return;
        }
        const { command, categoryId, valueArg, flags } = this.result;
        const contract = dslCommands[command].parseContract;

        for (const pair of dslParsedFlagConflicts) {
            const [a, b] = pair;
            if (this.isParsedFlagLabelActive(flags, a) && this.isParsedFlagLabelActive(flags, b)) {
                throw new DslParseError("Cannot combine incompatible options.");
            }
        }

        if ("requireCategoryId" in contract && contract.requireCategoryId && !categoryId) {
            throw new DslParseError("This command requires a category item id (category:id).");
        }
        if (contract.trailingValue === "required" && valueArg === undefined) {
            throw new DslParseError("This command requires an additional argument after the category.");
        }
        if (contract.trailingValue === "none" && valueArg !== undefined) {
            throw new DslParseError(`Unexpected text after arguments: "${valueArg}".`);
        }
    }

    private isParsedFlagLabelActive(
        flags: ParsedDslCommand["flags"],
        label: (typeof dslFlags)[keyof typeof dslFlags]["label"]
    ): boolean {
        const v = flags?.[label];
        if (v === undefined || v === false || v === "") {
            return false;
        }
        const spec = Object.values(dslFlags).find((f) => f.label === label);
        if (spec?.type === "boolean") {
            return v === true;
        }
        return true;
    }
}

export function parseDslCommand(command: string): ParsedDslCommand {
    return new DslParser(command).parse();
}
