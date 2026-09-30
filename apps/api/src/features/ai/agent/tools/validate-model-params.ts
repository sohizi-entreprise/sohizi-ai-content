export type ModelParameterSchema = {
  key: string
  type: string
  required: boolean
  options: string[]
  constraints?: {
    min?: number | null
    max?: number | null
    step?: number | null
  } | null
}

export function validateInput(
  schema: ModelParameterSchema[],
  inputParameters: Record<string, unknown>,
) {
  const errors: string[] = []

  for (const parameter of schema) {
    const value = inputParameters[parameter.key]
    const constraint = parameter.constraints ?? {}

    if (isOmitted(value)) {
      if (parameter.required) {
        errors.push(
          `This field '${parameter.key}' is required. Please provide a value for this field.`,
        )
      }
      continue
    }

    if (parameter.type === "number") {
      const numberValue = parseNumberValue(value)
      if (numberValue === null) {
        errors.push(`This field '${parameter.key}' must be a number.`)
        continue
      }
      if (constraint.min != null && numberValue < constraint.min) {
        errors.push(
          `This field '${parameter.key}' must be at least ${constraint.min}.`,
        )
      }
      if (constraint.max != null && numberValue > constraint.max) {
        errors.push(
          `This field '${parameter.key}' must be at most ${constraint.max}.`,
        )
      }
      if (constraint.step != null && constraint.step > 0) {
        const base = constraint.min ?? 0
        const steps = (numberValue - base) / constraint.step
        if (
          !Number.isFinite(steps) ||
          Math.abs(steps - Math.round(steps)) > 1e-8
        ) {
          errors.push(
            `This field '${parameter.key}' must be a multiple of ${constraint.step}.`,
          )
        }
      }
      continue
    }

    if (parameter.type === "boolean") {
      if (typeof value !== "boolean") {
        errors.push(`This field '${parameter.key}' must be a boolean.`)
      }
      continue
    }

    if (parameter.type === "string") {
      if (typeof value !== "string") {
        errors.push(`This field '${parameter.key}' must be a string.`)
        continue
      }
      if (parameter.options.length > 0 && !parameter.options.includes(value)) {
        errors.push(
          `This field '${parameter.key}' must be one of: ${parameter.options.join(", ")}.`,
        )
      }
      continue
    }

    if (
      parameter.type === "array<string>" ||
      parameter.type === "array<number>"
    ) {
      const parsed = parseArrayValue(value)
      if (!parsed) {
        errors.push(`This field '${parameter.key}' must be an array.`)
        continue
      }
      if (parameter.required && parsed.length === 0) {
        errors.push(
          `This field '${parameter.key}' is required. Please provide a value for this field.`,
        )
      }
      if (constraint.min != null && parsed.length < constraint.min) {
        errors.push(
          `This field '${parameter.key}' must contain at least ${constraint.min} item${constraint.min === 1 ? "" : "s"}.`,
        )
      }
      if (constraint.max != null && parsed.length > constraint.max) {
        errors.push(
          `This field '${parameter.key}' must contain at most ${constraint.max} item${constraint.max === 1 ? "" : "s"}.`,
        )
      }
      if (parameter.type === "array<string>") {
        if (parsed.some((item) => typeof item !== "string")) {
          errors.push(
            `This field '${parameter.key}' must be an array of strings.`,
          )
        } else if (parameter.options.length > 0) {
          const allowed = new Set(parameter.options)
          const hasInvalid = parsed.some(
            (item) => typeof item === "string" && !allowed.has(item),
          )
          if (hasInvalid) {
            errors.push(
              `This field '${parameter.key}' contains invalid values. Allowed: ${parameter.options.join(", ")}.`,
            )
          }
        }
      } else if (parsed.some((item) => parseNumberValue(item) === null)) {
        errors.push(
          `This field '${parameter.key}' must be an array of numbers.`,
        )
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false as const, errorMsg: errors.join(" ") }
  }
  return { isValid: true as const, errorMsg: null }
}

function isOmitted(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (
      !trimmed ||
      !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)
    ) {
      return null
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseArrayValue(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== "string") return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
