import "./disable-ai-sdk-warnings"
import "dotenv/config"
import { registerTelemetry } from "ai"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"

let spanProcessor: LangfuseSpanProcessor | null = null

export function isLangfuseEnabled(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  )
}

function startInstrumentation() {
  if (!isLangfuseEnabled()) {
    return
  }

  if (!process.env.LANGFUSE_BASE_URL) {
    process.env.LANGFUSE_BASE_URL = "https://cloud.langfuse.com"
  }
  if (!process.env.LANGFUSE_TRACING_ENVIRONMENT) {
    process.env.LANGFUSE_TRACING_ENVIRONMENT =
      process.env.NODE_ENV || "development"
  }

  spanProcessor = new LangfuseSpanProcessor()
  const provider = new NodeTracerProvider({
    spanProcessors: [spanProcessor],
  })
  provider.register()
  registerTelemetry(new LangfuseVercelAiSdkIntegration())
}

startInstrumentation()

export async function forceFlushTracing(): Promise<void> {
  await spanProcessor?.forceFlush()
}

process.once("beforeExit", () => {
  void forceFlushTracing()
})
