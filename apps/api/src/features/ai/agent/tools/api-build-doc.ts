import { z } from "zod"

type SchemaDef = {
  type: string
  shape?: Record<string, z.ZodType>
  innerType?: z.ZodType
  element?: z.ZodType
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
        .join("|")
    case "literal":
      return (def.values ?? []).map(formatValue).join("|")
    case "array": {
      const itemType = def.element ?? def.innerType
      return itemType ? `${typeLabel(unwrap(itemType).schema)}[]` : "array"
    }
    case "object":
    case "record":
      return "object"
    default:
      return schema.type
  }
}

function formatField(name: string, schema: z.ZodType) {
  const field = unwrap(schema)
  const type = typeLabel(field.schema)
  const optionalMark = field.optional ? "?" : ""
  const defaultPart = field.hasDefault
    ? ` = ${formatValue(field.defaultValue)}`
    : ""

  return {
    signature: `${name}${optionalMark}: ${type}${defaultPart}`,
    description: field.description,
  }
}

function section(
  title: "params" | "body",
  schema: z.ZodType | undefined,
): string | null {
  if (!schema || schema.type !== "object") return null
  const shape = schemaDef(schema).shape ?? {}
  const entries = Object.entries(shape).map(([name, field]) =>
    formatField(name, field),
  )
  if (entries.length === 0) return null

  const hasDescriptions = entries.some((e) => e.description)
  if (!hasDescriptions && entries.length <= 4) {
    return `  ${title}: { ${entries.map((e) => e.signature).join(", ")} }`
  }

  const lines = entries.map((e) =>
    e.description
      ? `    ${e.signature} // ${e.description}`
      : `    ${e.signature}`,
  )
  return `  ${title}: {\n${lines.join("\n")}\n  }`
}

function literalValue(schema: z.ZodType | undefined): string | undefined {
  if (!schema || schema.type !== "literal") return undefined
  const value = schemaDef(schema).values?.[0]
  return value === undefined ? undefined : String(value)
}

function buildEndpointDoc(schema: z.ZodType): string {
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
  const header = summary
    ? `${method} ${endpoint} — ${summary}`
    : `${method} ${endpoint}`

  const parts = [
    header,
    section("params", shape.params),
    section("body", shape.body),
  ].filter((part): part is string => part !== null)

  return parts.join("\n")
}

export default function buildDoc(schemas: readonly z.ZodType[]): string {
  return schemas.map(buildEndpointDoc).join("\n\n")
}
