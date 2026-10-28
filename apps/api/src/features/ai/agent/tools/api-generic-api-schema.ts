import { z } from "zod"

export const apiGenericApiSchema = z.object({
  endpoint: z.string().describe("The target API endpoint path."),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .describe("The HTTP method for the endpoint."),
  params: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Query parameters for GET or DELETE endpoints. Do not nest `body` inside `params`.",
    ),
  body: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Top-level request body for POST, PUT, or PATCH endpoints. Pass as a sibling of `endpoint` and `method`, not inside `params`.",
    ),
})

export type ParseApiToolResult<T> =
  { ok: true; data: T } | { ok: false; error: string }

type EndpointSchemaDef = {
  shape?: Record<string, z.ZodType>
  values?: readonly unknown[]
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getLiteralString(schema: z.ZodType | undefined): string | undefined {
  if (!schema || schema.type !== "literal") return undefined
  const def = schema.def as EndpointSchemaDef
  const val = def.values?.[0]
  return val === undefined ? undefined : String(val)
}

function formatZodIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
      return `${path}${issue.message}`
    })
    .join("; ")
}

export function parseApiToolRequest<const Schemas extends readonly z.ZodType[]>(
  input: unknown,
  schemas: Schemas,
): ParseApiToolResult<z.infer<Schemas[number]>> {
  const rawEndpoint = isPlainRecord(input) ? String(input.endpoint ?? "") : ""

  const validEndpoints: string[] = []
  let matchedByEndpoint: z.ZodType | undefined

  for (const schema of schemas) {
    const shape = (schema.def as EndpointSchemaDef).shape
    const endpoint = getLiteralString(shape?.endpoint)
    if (endpoint) {
      validEndpoints.push(endpoint)
      if (endpoint === rawEndpoint) {
        matchedByEndpoint = schema
      }
    }
  }

  if (!matchedByEndpoint) {
    const available =
      validEndpoints.length > 0
        ? ` Valid endpoints: ${validEndpoints.join(", ")}`
        : ""
    return {
      ok: false,
      error: `Unknown or invalid endpoint "${rawEndpoint}".${available}`,
    }
  }

  const parsed = matchedByEndpoint.safeParse(input)

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data as z.infer<Schemas[number]>,
    }
  }

  const shape = (matchedByEndpoint.def as EndpointSchemaDef).shape
  const expectedMethod = getLiteralString(shape?.method) ?? ""
  const label = expectedMethod
    ? `${expectedMethod} ${rawEndpoint}`
    : rawEndpoint
  return {
    ok: false,
    error: `Invalid request for ${label} — ${formatZodIssues(parsed.error.issues)}`,
  }
}
