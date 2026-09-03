/** Stub of the `cloudflare:workflows` module for Node-based tests. */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NonRetryableError"
  }
}
