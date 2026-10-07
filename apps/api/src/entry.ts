// Dynamic import ensures the SDK is initialized before application modules load,
// including in the compiled Bun executable.
await import("./sentry")
await import("./index")

export {}
