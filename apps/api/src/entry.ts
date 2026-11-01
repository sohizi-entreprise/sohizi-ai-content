if (process.argv.includes("--healthcheck")) {
  const res = await fetch("http://127.0.0.1:3030/").catch(() => null)
  process.exit(res?.ok ? 0 : 1)
}

// Dynamic import ensures the SDK is initialized before application modules load,
// including in the compiled Bun executable.
await import("./sentry")
const { connectCapacityRedis } = await import("./features/capacity/redis")
await connectCapacityRedis()
await import("./index")

export {}
