// Dynamic import ensures the SDK is initialized before application modules load,
// including in the compiled Bun executable.
await import("./sentry")
const { connectCapacityRedis } = await import("./features/capacity/redis")
await connectCapacityRedis()
await import("./index")

export {}
