/**
 * Structural mirror of `@hyperframes/core`'s composition variable model.
 *
 * The renderer bundle must not depend on `@hyperframes/core`: its entry point
 * pulls in compiler modules that assume Node built-ins. These declarations are
 * structurally identical, so values produced by `@hyperframes/core` remain
 * assignable in the editor.
 */

export type CompositionVariableType =
  "string" | "number" | "color" | "boolean" | "enum"

export interface CompositionVariableBase {
  id: string
  type: CompositionVariableType
  label: string
  description?: string
}

export interface StringVariable extends CompositionVariableBase {
  type: "string"
  default: string
  placeholder?: string
  maxLength?: number
}

export interface NumberVariable extends CompositionVariableBase {
  type: "number"
  default: number
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface ColorVariable extends CompositionVariableBase {
  type: "color"
  default: string
}

export interface BooleanVariable extends CompositionVariableBase {
  type: "boolean"
  default: boolean
}

export interface EnumVariable extends CompositionVariableBase {
  type: "enum"
  default: string
  options: Array<{ value: string; label: string }>
}

export type CompositionVariable =
  | StringVariable
  | NumberVariable
  | ColorVariable
  | BooleanVariable
  | EnumVariable

export type CompositionVariableValue = string | number | boolean

export function isStringVariable(v: CompositionVariable): v is StringVariable {
  return v.type === "string"
}

export function isNumberVariable(v: CompositionVariable): v is NumberVariable {
  return v.type === "number"
}

export function isColorVariable(v: CompositionVariable): v is ColorVariable {
  return v.type === "color"
}

export function isBooleanVariable(
  v: CompositionVariable,
): v is BooleanVariable {
  return v.type === "boolean"
}

export function isEnumVariable(v: CompositionVariable): v is EnumVariable {
  return v.type === "enum"
}
