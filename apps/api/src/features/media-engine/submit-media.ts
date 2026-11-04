import { NonRetriableError } from "inngest"
import { getGenerationRequest } from "@/features/generation-request/repo"
import { classifyMediaError } from "@/features/capacity/classify"
import { rateLimitRetryAfterMs } from "@/features/capacity/retry-after"
import {
  releaseCapacityLease,
  renewCapacityLease,
  tryAcquireCapacity,
} from "@/features/capacity/router"
import { resolveAccount } from "@/features/capacity/registry"
import { releaseUserSlot, renewUserSlot } from "@/features/capacity/user-gate"
import type { LeaseHandle } from "@/features/capacity/types"
import { createProvider } from "./providers/factory"
import { mapVendorPayload } from "./providers/utils"
import type { SubmitPayload } from "./providers/type"
import * as repo from "./repo"

export type MediaSticky = {
  accountId: string
  adapter: string
  vendorName: string
  apiName: string
  providerRequestId: string
  providerCostUsd?: number
  lease: LeaseHandle
}

const MAX_FAILOVER_ACCOUNTS = 4

function stickyFrom(row: {
  capacityAccountId: string | null
  capacityLease: LeaseHandle | null
  providerRequestId: string | null
  request: Record<string, unknown> | null
}): MediaSticky | null {
  const routing = row.request?.routing as
    | {
        apiName?: string
        vendorName?: string
        providerCostUsd?: number
      }
    | undefined
  const account = row.capacityAccountId
    ? resolveAccount(row.capacityAccountId)
    : undefined
  if (
    !row.providerRequestId ||
    !row.capacityLease ||
    !account ||
    !routing?.apiName
  ) {
    return null
  }
  return {
    accountId: account.id,
    adapter: account.adapter,
    vendorName: account.providerName,
    apiName: routing.apiName,
    providerRequestId: row.providerRequestId,
    ...(typeof routing.providerCostUsd === "number"
      ? { providerCostUsd: routing.providerCostUsd }
      : {}),
    lease: row.capacityLease,
  }
}

export async function submitMediaWithCapacity(input: {
  requestId: string
  modelId: string
  payload: SubmitPayload
  leaseTtlMs: number
}): Promise<MediaSticky> {
  const excludedAccounts: string[] = []
  const excludedProviders: string[] = []
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_FAILOVER_ACCOUNTS; attempt++) {
    const row = await getGenerationRequest(input.requestId)
    if (!row) throw new NonRetriableError("Generation request not found")
    if (row.cancelRequestedAt) {
      throw new NonRetriableError("Generation was cancelled")
    }
    const existing = stickyFrom(row)
    if (existing) return existing
    if (
      row.submitState === "submitting" ||
      row.submitState === "submission_unknown"
    ) {
      await repo.markMediaSubmissionUnknown(input.requestId)
      throw new NonRetriableError(
        "Provider submission state is ambiguous and was not retried",
      )
    }

    let accountId = row.capacityAccountId
    let lease = row.capacityLease
    let apiName =
      (row.request?.routing as { apiName?: string } | undefined)?.apiName ?? ""
    if (row.submitState !== "selected" || !accountId || !lease || !apiName) {
      const acquired = await tryAcquireCapacity({
        task: `media:${input.modelId}`,
        holderId: input.requestId,
        leaseTtlMs: input.leaseTtlMs,
        excludeAccountIds: excludedAccounts,
        excludeProviders: excludedProviders,
      })
      if (!acquired.ok) {
        if (acquired.reason === "no_route") {
          if (lastError instanceof Error) throw lastError
          throw new NonRetriableError(`No media route for ${input.modelId}`)
        }
        throw new Error(
          acquired.reason === "saturated"
            ? "Media capacity is saturated"
            : "Capacity ledger is unavailable",
        )
      }
      accountId = acquired.selection.account.id
      lease = acquired.selection.lease
      apiName = acquired.selection.binding.apiName
      const saved = await repo.saveMediaSelection(input.requestId, {
        accountId,
        lease,
        apiName,
      })
      if (!saved) continue
    }

    const claimed = await repo.claimMediaSubmit(input.requestId)
    if (!claimed) continue
    const account = resolveAccount(accountId)
    if (!account || !lease) {
      throw new NonRetriableError(
        "Selected media account is no longer configured",
      )
    }

    try {
      const provider = createProvider(account.adapter, account.credential)
      const mapped = await mapVendorPayload(
        account.providerName,
        input.modelId,
        input.payload,
      )
      const submitted = await provider.submitRequest(apiName, mapped)
      let providerCostUsd: number | undefined
      try {
        const estimate = await provider.estimateRequestPrice(apiName, mapped)
        if (
          estimate.ok &&
          typeof estimate.priceUSD === "number" &&
          Number.isFinite(estimate.priceUSD)
        ) {
          providerCostUsd = estimate.priceUSD
        }
      } catch {
        // Vendor cost estimation is optional and must not fail a submitted job.
      }
      await repo.patchRequestRouting(input.requestId, {
        vendorName: account.providerName,
        apiName,
        providerRequestId: submitted.requestId,
        ...(providerCostUsd !== undefined ? { providerCostUsd } : {}),
      })
      return {
        accountId: account.id,
        adapter: account.adapter,
        vendorName: account.providerName,
        apiName,
        providerRequestId: submitted.requestId,
        ...(providerCostUsd !== undefined ? { providerCostUsd } : {}),
        lease,
      }
    } catch (error) {
      lastError = error
      const action = classifyMediaError(error)
      if (action === "submission_unknown") {
        await repo.markMediaSubmissionUnknown(input.requestId)
        throw new NonRetriableError(
          "Provider submission may have been sent and was not retried",
          { cause: error instanceof Error ? error : undefined },
        )
      }
      const outcome =
        action === "account_failure"
          ? "rate_limited"
          : action === "not_sent"
            ? "not_sent"
            : "completed"
      await releaseCapacityLease(lease, outcome, {
        retryAfterMs:
          action === "account_failure"
            ? rateLimitRetryAfterMs(error)
            : undefined,
        cooldownMs: account.limits.cooldownMs,
        burst: account.limits.burst ?? account.limits.rpm ?? 0,
      })
      await repo.clearMediaSelection(input.requestId)
      if (action === "account_failure" || action === "not_sent") {
        excludedAccounts.push(account.id)
        continue
      }
      if (action === "route_failure") {
        excludedProviders.push(account.providerName)
        continue
      }
      throw new NonRetriableError(
        error instanceof Error ? error.message : "Media submit failed",
        { cause: error instanceof Error ? error : undefined },
      )
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new NonRetriableError(`No media account accepted ${input.modelId}`)
}

export async function pollMediaRequest(requestId: string) {
  const row = await getGenerationRequest(requestId)
  if (!row?.providerRequestId || !row.capacityAccountId) {
    throw new NonRetriableError("Media job has no provider request")
  }
  const account = resolveAccount(row.capacityAccountId)
  if (!account)
    throw new NonRetriableError("Media account is no longer configured")
  const provider = createProvider(account.adapter, account.credential)
  return provider.getRequestData(row.providerRequestId)
}

export async function renewMediaLeases(requestId: string, leaseTtlMs: number) {
  const row = await getGenerationRequest(requestId)
  if (!row) return
  if (row.userLease) await renewUserSlot(row.userLease, leaseTtlMs)
  if (row.capacityLease && row.submitState !== "submission_unknown") {
    const account = row.capacityAccountId
      ? resolveAccount(row.capacityAccountId)
      : undefined
    const renewed = await renewCapacityLease(
      row.capacityLease,
      leaseTtlMs,
      account?.limits.probeTtlMs,
    )
    if (!renewed.ok && renewed.reason === "unavailable") {
      throw new Error("Capacity lease renew failed")
    }
  }
}

export async function releaseMediaLeases(
  requestId: string,
  options: { releaseAccount?: boolean } = {},
) {
  const row = await getGenerationRequest(requestId)
  if (!row) return
  await releaseUserSlot(row.userLease)
  const releaseAccount =
    options.releaseAccount ?? row.submitState !== "submission_unknown"
  if (row.capacityLease && releaseAccount) {
    const account = row.capacityAccountId
      ? resolveAccount(row.capacityAccountId)
      : undefined
    await releaseCapacityLease(row.capacityLease, "completed", {
      burst: account?.limits.burst ?? account?.limits.rpm ?? 0,
      cooldownMs: account?.limits.cooldownMs,
    })
  }
}
