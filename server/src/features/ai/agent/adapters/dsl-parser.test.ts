import { describe, expect, test } from "bun:test";
import { DslParseError, parseDslCommand, type ParsedDslCommand } from "./dsl-parser";

function expectParsed(actual: ParsedDslCommand, expected: ParsedDslCommand): void {
    expect(actual).toEqual(expected);
}

describe("parseDslCommand", () => {
    describe("LIST", () => {
        test("minimal", () => {
            expectParsed(parseDslCommand("LIST characters"), {
                command: "LIST",
                category: "characters",
                categoryId: undefined,
                flags: undefined,
                valueArg: undefined,
            });
        });

        test("category case-insensitive", () => {
            expectParsed(parseDslCommand("LIST ScEnEs"), {
                command: "LIST",
                category: "scenes",
                categoryId: undefined,
                flags: undefined,
                valueArg: undefined,
            });
        });

        test("verb case-insensitive", () => {
            expectParsed(parseDslCommand("list shots"), {
                command: "LIST",
                category: "shots",
                categoryId: undefined,
                flags: undefined,
                valueArg: undefined,
            });
        });

        test("LIMIT", () => {
            expectParsed(parseDslCommand("LIST scenes LIMIT 5"), {
                command: "LIST",
                category: "scenes",
                categoryId: undefined,
                flags: { limit: "5" },
                valueArg: undefined,
            });
        });

        test("CURSOR with space before id", () => {
            expectParsed(parseDslCommand("LIST scenes CURSOR scene_003"), {
                command: "LIST",
                category: "scenes",
                categoryId: undefined,
                flags: { cursor: "scene_003" },
                valueArg: undefined,
            });
        });

        test("rejects legacy CURSOR:id single token", () => {
            expect(() => parseDslCommand("LIST scenes CURSOR:scene_003")).toThrow(DslParseError);
        });

        test("--COUNT", () => {
            expectParsed(parseDslCommand("LIST props --COUNT"), {
                command: "LIST",
                category: "props",
                categoryId: undefined,
                flags: { count: true },
                valueArg: undefined,
            });
        });

        test("LIMIT and CURSOR together (no --COUNT)", () => {
            expectParsed(parseDslCommand("LIST characters LIMIT 10 CURSOR char_001"), {
                command: "LIST",
                category: "characters",
                categoryId: undefined,
                flags: { limit: "10", cursor: "char_001" },
                valueArg: undefined,
            });
        });

        test("rejects LIMIT with --COUNT", () => {
            expect(() => parseDslCommand("LIST scenes LIMIT 5 --COUNT")).toThrow(DslParseError);
        });

        test("rejects missing category", () => {
            expect(() => parseDslCommand("LIST")).toThrow(DslParseError);
        });

        test("rejects unknown token", () => {
            expect(() => parseDslCommand("LIST scenes OOPS")).toThrow(DslParseError);
        });

        test("rejects invalid category", () => {
            expect(() => parseDslCommand("LIST not_a_table")).toThrow(DslParseError);
        });
    });

    describe("SCHEMA", () => {
        test("parses", () => {
            expectParsed(parseDslCommand("SCHEMA synopsis"), {
                command: "SCHEMA",
                category: "synopsis",
                categoryId: undefined,
                flags: undefined,
                valueArg: undefined,
            });
        });

        test("rejects extra tokens", () => {
            expect(() => parseDslCommand("SCHEMA scenes extra")).toThrow(DslParseError);
        });
    });

    describe("VIEW", () => {
        test("parses category:id", () => {
            expectParsed(parseDslCommand("VIEW scenes:scene_004"), {
                command: "VIEW",
                category: "scenes",
                categoryId: "scene_004",
                flags: undefined,
                valueArg: undefined,
            });
        });

        test("rejects missing colon", () => {
            expect(() => parseDslCommand("VIEW scenes")).toThrow(DslParseError);
        });

        test("rejects extra tokens", () => {
            expect(() => parseDslCommand("VIEW scenes:id more")).toThrow(DslParseError);
        });
    });

    describe("EXTRACT", () => {
        test("parses dot path", () => {
            expectParsed(parseDslCommand("EXTRACT characters:luke_skywalker personality.flaws"), {
                command: "EXTRACT",
                category: "characters",
                categoryId: "luke_skywalker",
                flags: undefined,
                valueArg: "personality.flaws",
            });
        });

        test("quoted path preserves spaces", () => {
            expectParsed(parseDslCommand('EXTRACT story_bible:doc "a.b c"'), {
                command: "EXTRACT",
                category: "story_bible",
                categoryId: "doc",
                flags: undefined,
                valueArg: "a.b c",
            });
        });

        test("rejects too few tokens", () => {
            expect(() => parseDslCommand("EXTRACT scenes:only")).toThrow(DslParseError);
        });
    });

    describe("FIND", () => {
        test("minimal with quoted phrase", () => {
            expectParsed(parseDslCommand('FIND locations "abandoned warehouse"'), {
                command: "FIND",
                category: "locations",
                categoryId: undefined,
                flags: undefined,
                valueArg: "abandoned warehouse",
            });
        });

        test("unquoted single-word phrase", () => {
            expectParsed(parseDslCommand("FIND characters Luke"), {
                command: "FIND",
                category: "characters",
                categoryId: undefined,
                flags: undefined,
                valueArg: "Luke",
            });
        });

        test("trailing LIMIT", () => {
            expectParsed(parseDslCommand('FIND scenes "opening" LIMIT 3'), {
                command: "FIND",
                category: "scenes",
                categoryId: undefined,
                flags: { limit: "3" },
                valueArg: "opening",
            });
        });

        test("trailing --COUNT only", () => {
            expectParsed(parseDslCommand('FIND props "sword" --COUNT'), {
                command: "FIND",
                category: "props",
                categoryId: undefined,
                flags: { count: true },
                valueArg: "sword",
            });
        });

        test("rejects missing search phrase", () => {
            expect(() => parseDslCommand("FIND scenes")).toThrow(DslParseError);
        });

        test("rejects LIMIT with --COUNT", () => {
            expect(() =>
                parseDslCommand('FIND locations "x" LIMIT 1 --COUNT')
            ).toThrow(DslParseError);
        });
    });

    describe("SEARCH", () => {
        test("minimal quoted query", () => {
            expectParsed(
                parseDslCommand('SEARCH scenes "the hero finally defeats the villain"'),
                {
                    command: "SEARCH",
                    category: "scenes",
                    categoryId: undefined,
                    flags: undefined,
                    valueArg: "the hero finally defeats the villain",
                }
            );
        });

        test("unquoted single-word query", () => {
            expectParsed(parseDslCommand("SEARCH synopsis tension"), {
                command: "SEARCH",
                category: "synopsis",
                categoryId: undefined,
                flags: undefined,
                valueArg: "tension",
            });
        });

        test("trailing LIMIT", () => {
            expectParsed(parseDslCommand('SEARCH project_requirements "deadline" LIMIT 10'), {
                command: "SEARCH",
                category: "project_requirements",
                categoryId: undefined,
                flags: { limit: "10" },
                valueArg: "deadline",
            });
        });

        test("rejects LIMIT with --COUNT", () => {
            expect(() =>
                parseDslCommand('SEARCH scenes "q" LIMIT 5 --COUNT')
            ).toThrow(DslParseError);
        });
    });

    describe("errors", () => {
        test("empty string", () => {
            expect(() => parseDslCommand("   ")).toThrow(DslParseError);
        });

        test("unknown verb", () => {
            expect(() => parseDslCommand("DELETE scenes")).toThrow(DslParseError);
        });

        test("pipe not allowed", () => {
            expect(() => parseDslCommand("LIST scenes | wc")).toThrow(DslParseError);
        });
    });
});
