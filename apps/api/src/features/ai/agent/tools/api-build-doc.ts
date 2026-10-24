import { z } from "zod"

type SchemaDef = {
  type: string
  shape?: Record<string, z.ZodType>
  innerType?: z.ZodType
  entries?: Record<string, unknown>
  values?: readonly unknown[]
  defaultValue?: unknown
}

type FieldInfo = {
  optional: boolean
  defaultValue?: unknown
  hasDefault: boolean
  description?: string
  schema: z.ZodType
}

function schemaDef(schema: z.ZodType): SchemaDef {
  return schema.def as SchemaDef
}

function unwrap(schema: z.ZodType): FieldInfo {
  let current = schema
  let optional = false
  let hasDefault = false
  let defaultValue: unknown
  let description = schema.description

  while (
    current.type === "optional" ||
    current.type === "nullable" ||
    current.type === "default"
  ) {
    const def = schemaDef(current)
    description = description ?? current.description
    if (current.type === "optional" || current.type === "nullable") {
      optional = true
    }
    if (current.type === "default") {
      optional = true
      hasDefault = true
      const value = def.defaultValue
      defaultValue = typeof value === "function" ? value() : value
    }
    if (!def.innerType) break
    current = def.innerType
  }

  return {
    optional,
    hasDefault,
    defaultValue,
    description: description ?? current.description,
    schema: current,
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value)
  return String(value)
}

function typeLabel(schema: z.ZodType): string {
  const def = schemaDef(schema)

  switch (schema.type) {
    case "string":
      return "string"
    case "number": {
      const format =
        "format" in schema
          ? (schema as { format?: string | null }).format
          : null
      return format === "safeint" || format === "int32" ? "int" : "number"
    }
    case "boolean":
      return "boolean"
    case "enum":
      return Object.values(def.entries ?? {})
        .map(formatValue)
        .join(" | ")
    case "literal":
      return (def.values ?? []).map(formatValue).join(" | ")
    case "array":
      return def.innerType
        ? `${typeLabel(unwrap(def.innerType).schema)}[]`
        : "array"
    case "object":
    case "record":
      return "object"
    default:
      return schema.type
  }
}

function fieldLine(name: string, schema: z.ZodType): string {
  const field = unwrap(schema)
  const type = typeLabel(field.schema)
  const details = field.hasDefault
    ? `${type}, default=${formatValue(field.defaultValue)}`
    : type
  const description = field.description ? `: ${field.description}` : ""
  const optionalMark = field.optional ? "?" : ""

  return `  - \`${name}${optionalMark}\` (${details})${description}`
}

function section(
  title: "Params" | "Body",
  schema: z.ZodType | undefined,
): string[] {
  if (!schema || schema.type !== "object") return []
  const shape = schemaDef(schema).shape ?? {}
  const lines = Object.entries(shape).map(([name, field]) =>
    fieldLine(name, field),
  )
  if (lines.length === 0) return []
  return [`- **${title}:**`, ...lines]
}

function literalValue(schema: z.ZodType | undefined): string | undefined {
  if (!schema || schema.type !== "literal") return undefined
  const value = schemaDef(schema).values?.[0]
  return value === undefined ? undefined : String(value)
}

export default function buildDoc(schema: z.ZodType): string {
  if (schema.type !== "object") {
    throw new Error("Expected an object schema with endpoint and method")
  }

  const shape = schemaDef(schema).shape ?? {}
  const method = literalValue(shape.method)
  const endpoint = literalValue(shape.endpoint)
  if (!method || !endpoint) {
    throw new Error("Schema must include literal method and endpoint fields")
  }

  const summary =
    schema.description ?? shape.params?.description ?? shape.body?.description
  const lines = [`### \`${method} ${endpoint}\``]
  if (summary) lines.push(summary)
  lines.push(...section("Params", shape.params))
  lines.push(...section("Body", shape.body))

  return lines.join("\n")
}
