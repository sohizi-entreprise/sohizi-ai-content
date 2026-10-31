import type { CapacityTask } from "./types"

export type AccountLimits = {
  rpm?: number
  burst?: number
  maxConcurrency: number
  probeTtlMs: number
  cooldownMs: number
}

export type RemotionAccountConfig = {
  region: string
  functionName: string
  serveUrl: string
  memorySizeInMb?: number
  diskSizeInMb?: number
}

export type ProviderAccount = {
  id: string
  limits: AccountLimits
  credentialEnv?: string
  credentialFallbackEnv?: string
  credential?: () => string | undefined
  remotion?: RemotionAccountConfig | (() => RemotionAccountConfig | undefined)
}

export type ProviderDefinition = {
  name: string
  adapter: string
  tasks: CapacityTask[]
  strategy: "priority" | "spread"
  accounts: ProviderAccount[]
}

export type ResolvedAccount = {
  id: string
  providerName: string
  adapter: string
  credential: string
  limits: AccountLimits
  strategy: "priority" | "spread"
  remotion?: RemotionAccountConfig
}

const DEFAULT_CIRCUIT = { probeTtlMs: 30_000, cooldownMs: 15_000 }

function envValue(name: string | undefined): string | undefined {
  if (!name) return undefined
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function remotionConfig(): RemotionAccountConfig | undefined {
  const functionName = envValue("REMOTION_FUNCTION_NAME")
  const serveUrl = envValue("REMOTION_SERVE_URL")
  if (!functionName || !serveUrl) return undefined
  const memory = Number(process.env.REMOTION_FUNCTION_MEMORY_MB)
  const disk = Number(process.env.REMOTION_FUNCTION_DISK_MB)
  return {
    region: envValue("REMOTION_AWS_REGION") ?? "us-east-1",
    functionName,
    serveUrl,
    memorySizeInMb: Number.isFinite(memory) && memory > 0 ? memory : undefined,
    diskSizeInMb: Number.isFinite(disk) && disk > 0 ? disk : undefined,
  }
}

function account(
  id: string,
  limits: AccountLimits,
  extra: Omit<ProviderAccount, "id" | "limits"> = {},
): ProviderAccount {
  return { id, limits, ...extra }
}

const BUILTIN_PROVIDERS: ProviderDefinition[] = [
  {
    name: "tavily",
    adapter: "tavily",
    tasks: ["web.search", "web.extract"],
    strategy: "priority",
    accounts: [
      account(
        "tavily:primary",
        { ...DEFAULT_CIRCUIT, rpm: 60, burst: 60, maxConcurrency: 10 },
        {
          credentialEnv: "TAVILY_API_KEY",
          credentialFallbackEnv: "TRAVELY_API_KEY",
        },
      ),
    ],
  },
  {
    name: "wavespeed",
    adapter: "wavespeed",
    tasks: ["media"],
    strategy: "priority",
    accounts: [
      account(
        "wavespeed:primary",
        { ...DEFAULT_CIRCUIT, rpm: 60, burst: 60, maxConcurrency: 10 },
        { credentialEnv: "WAVESPEED_API_KEY" },
      ),
    ],
  },
  {
    name: "openrouter",
    adapter: "openrouter",
    tasks: ["llm"],
    strategy: "priority",
    accounts: [
      account(
        "openrouter:primary",
        { ...DEFAULT_CIRCUIT, maxConcurrency: 100 },
        { credentialEnv: "OPENROUTER_API_KEY" },
      ),
    ],
  },
  {
    name: "vercel-gateway",
    adapter: "vercel-gateway",
    tasks: ["llm"],
    strategy: "priority",
    accounts: [
      account(
        "vercel-gateway:primary",
        { ...DEFAULT_CIRCUIT, maxConcurrency: 100 },
        { credentialEnv: "VERCEL_GATEWAY_API_KEY" },
      ),
    ],
  },
  {
    name: "remotion",
    adapter: "remotion",
    tasks: ["video.export"],
    strategy: "spread",
    accounts: [
      account(
        "remotion:primary",
        { ...DEFAULT_CIRCUIT, maxConcurrency: 2 },
        { remotion: remotionConfig },
      ),
    ],
  },
  {
    name: "cloudflare-browser",
    adapter: "youtube-screenshot",
    tasks: ["youtube.screenshot"],
    strategy: "priority",
    accounts: [
      account(
        "cloudflare-browser:primary",
        {
          ...DEFAULT_CIRCUIT,
          maxConcurrency: Number(process.env.YOUTUBE_SCREENSHOT_MAX_TABS ?? 10),
        },
        { credentialEnv: "CLOUDFLARE_WORKER_TOKEN" },
      ),
    ],
  },
]

const providers = new Map<string, ProviderDefinition>(
  BUILTIN_PROVIDERS.map((provider) => [provider.name, provider]),
)

export function validateRegistry(
  definitions: ProviderDefinition[] = [...providers.values()],
): void {
  const ids = new Set<string>()
  for (const provider of definitions) {
    if (!provider.name || !provider.adapter) {
      throw new Error("Capacity provider is missing a name or adapter")
    }
    if (provider.accounts.length === 0) {
      throw new Error(`Capacity provider ${provider.name} has no accounts`)
    }
    for (const entry of provider.accounts) {
      if (!entry.id || entry.id.includes(" ")) {
        throw new Error(`Invalid capacity account id for ${provider.name}`)
      }
      if (ids.has(entry.id)) {
        throw new Error(`Duplicate capacity account id ${entry.id}`)
      }
      ids.add(entry.id)
      if (
        !Number.isInteger(entry.limits.maxConcurrency) ||
        entry.limits.maxConcurrency < 1
      ) {
        throw new Error(`Invalid maxConcurrency for ${entry.id}`)
      }
      if (
        entry.limits.rpm != null &&
        (!Number.isFinite(entry.limits.rpm) || entry.limits.rpm < 0)
      ) {
        throw new Error(`Invalid rpm for ${entry.id}`)
      }
    }
  }
}

validateRegistry()

export function registerProvider(definition: ProviderDefinition): void {
  validateRegistry([definition])
  providers.set(definition.name, definition)
}

export function unregisterProvider(name: string): void {
  if (BUILTIN_PROVIDERS.some((provider) => provider.name === name)) return
  providers.delete(name)
}

export function getProvider(name: string): ProviderDefinition | undefined {
  return providers.get(name)
}

export function listProvidersForTask(task: CapacityTask): ProviderDefinition[] {
  return [...providers.values()].filter((provider) =>
    provider.tasks.includes(task),
  )
}

export function accountPoolId(accountId: string): string {
  return `account:${accountId}`
}

function resolveRemotion(
  account: ProviderAccount,
): RemotionAccountConfig | undefined {
  if (!account.remotion) return undefined
  return typeof account.remotion === "function"
    ? account.remotion()
    : account.remotion
}

export function resolveAccount(accountId: string): ResolvedAccount | undefined {
  for (const provider of providers.values()) {
    const account = provider.accounts.find((entry) => entry.id === accountId)
    if (!account) continue
    const resolved = resolveProviderAccount(provider, account)
    return resolved
  }
  return undefined
}

export function resolveProviderAccount(
  provider: ProviderDefinition,
  account: ProviderAccount,
): ResolvedAccount | undefined {
  const remotion = resolveRemotion(account)
  if (provider.adapter === "remotion") {
    if (!remotion?.functionName || !remotion.serveUrl || !remotion.region) {
      return undefined
    }
    return {
      id: account.id,
      providerName: provider.name,
      adapter: provider.adapter,
      credential: "",
      limits: account.limits,
      strategy: provider.strategy,
      remotion,
    }
  }
  const credential =
    account.credential?.() ??
    envValue(account.credentialEnv) ??
    envValue(account.credentialFallbackEnv)
  if (!credential) return undefined
  return {
    id: account.id,
    providerName: provider.name,
    adapter: provider.adapter,
    credential,
    limits: account.limits,
    strategy: provider.strategy,
    remotion,
  }
}

export function resolveProviderAccounts(
  providerName: string,
): ResolvedAccount[] {
  const provider = providers.get(providerName)
  if (!provider) return []
  return provider.accounts.flatMap((account) => {
    const resolved = resolveProviderAccount(provider, account)
    return resolved ? [resolved] : []
  })
}

export const TASK_POLICIES: Partial<
  Record<
    "media" | "video.export" | "youtube.screenshot",
    { userConcurrency: number }
  >
> = {
  media: { userConcurrency: 5 },
  "video.export": { userConcurrency: 2 },
  "youtube.screenshot": { userConcurrency: 1 },
}

export function userTaskKey(
  task: string,
): "media" | "video.export" | "youtube.screenshot" | undefined {
  if (task === "media" || task.startsWith("media:")) return "media"
  if (task === "video.export") return "video.export"
  if (task === "youtube.screenshot") return "youtube.screenshot"
  return undefined
}

export function userConcurrencyFor(task: string): number | undefined {
  const key = userTaskKey(task)
  return key ? TASK_POLICIES[key]?.userConcurrency : undefined
}
