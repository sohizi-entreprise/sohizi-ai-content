import { Badge } from "@sohizi/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import { CircleHelp } from "lucide-react"
import type { ReactNode } from "react"

export type BillingSummary = {
  organizationId: string
  canManage: boolean
  plan: null | {
    id: string | null
    name: string | null
    status: string
    allowance: string | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
    pendingProductId: string | null
  }
  balance: string
  includedBalance: string
  purchasedBalance: string
  includedExpiresAt: string | null
  purchasedExpiresAt: string | null
}

export async function billingRequest<T>(
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch(`/api/billing/${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string
      error?: string
    } | null
    throw new Error(error?.message ?? error?.error ?? "Billing request failed")
  }
  return response.json() as Promise<T>
}

const MONTH_NAMES = [
  "Jan.",
  "Feb.",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const

export const formatCredits = (amount: string | number) =>
  Number(amount).toLocaleString()

export const formatDate = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function BillingCreditsSummary({
  summary,
  action,
}: {
  summary: BillingSummary
  action?: ReactNode
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current plan
          </p>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {summary.plan?.name ?? "Free"}
            </h2>
            {summary.plan ? (
              <Badge
                variant={
                  summary.plan.cancelAtPeriodEnd ? "outline" : "secondary"
                }
                className="capitalize border border-white/10! bg-card"
              >
                {summary.plan.status}
              </Badge>
            ) : null}
          </div>
          {summary.plan ? (
            <p className="text-sm text-muted-foreground">
              {summary.plan.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
              {formatDate(summary.plan.periodEnd)}
            </p>
          ) : null}
          {summary.plan?.pendingProductId ? (
            <p className="text-sm text-muted-foreground">
              Plan change pending payment confirmation. New credits will appear
              after payment succeeds.
            </p>
          ) : null}
        </div>
        {action}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
          <p className="text-sm text-foreground">Total credits</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {formatCredits(summary.balance)}
          </p>
        </div>
        <div className="rounded-xl bg-card/80 p-4 border border-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Included</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About included credits"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Credits included with your monthly plan. Unused credits expire
                at the end of each billing period.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-2xl font-semibold">
            {formatCredits(summary.includedBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Renews on {formatDate(summary.includedExpiresAt)}
          </p>
        </div>
        <div className="rounded-xl bg-card/80 p-4 border border-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Purchased</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About purchased credits"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Credits bought separately from your plan. They remain available
                until the expiration date shown below.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-2xl font-semibold">
            {formatCredits(summary.purchasedBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expires on {formatDate(summary.purchasedExpiresAt)}
          </p>
        </div>
      </div>
    </>
  )
}
