export function requiresMoveTargetValidation(
  currentParentId: string | null,
  nextParentId: string | null,
) {
  return currentParentId !== nextParentId
}
