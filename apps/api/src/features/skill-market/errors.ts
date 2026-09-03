export class NameConflictError extends Error {
  readonly status = 409

  constructor(
    public readonly existingFileNodeId: string,
    message = "A skill with this name already exists in the project",
  ) {
    super(message)
    this.name = "NameConflictError"
  }

  toResponse() {
    return Response.json(
      {
        error: this.message,
        code: "NAME_CONFLICT",
        existingFileNodeId: this.existingFileNodeId,
      },
      { status: this.status },
    )
  }
}
