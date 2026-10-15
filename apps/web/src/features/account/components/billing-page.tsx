import { useCallback, useEffect, useState } from "react"
import { Button } from "@sohizi/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"
import { useSession } from "@/lib/auth-client"

type CatalogProduct = {
  id: string
  name: string
  description: string | null
  kind: "plan" | "pack"
  credits: number
  planTier: number | null
  priceAmount: number
  currency: string
}

type Summary = {
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

async function billingRequest<T>(path: string, body?: object): Promise<T> {
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

const formatCredits = (amount: string | number) =>
  Number(amount).toLocaleString()
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—"
const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    amount / 100,
  )

export function AccountBillingPage() {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId
  const [summary, setSummary] = useState<Summary | null>(null)
  const [products, setProducts] = useState<Array<CatalogProduct>>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const [nextSummary, nextCatalog] = await Promise.all([
        billingRequest<Summary>("summary"),
        billingRequest<{ products: Array<CatalogProduct> }>("catalog"),
      ])
      setSummary(nextSummary)
      setProducts(nextCatalog.products)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Billing is unavailable",
      )
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (
      !organizationId ||
      !new URLSearchParams(window.location.search).has("checkout")
    )
      return
    setNotice(
      "Payment is processing. Credits will appear after Polar confirms payment.",
    )
    void billingRequest("reconcile", {})
      .then(load)
      .catch(() => undefined)
    const timer = window.setTimeout(() => {
      void load()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [organizationId, load])

  const perform = async (key: string, path: string, body: object = {}) => {
    setPending(key)
    setError(null)
    try {
      const result = await billingRequest<{ url?: string }>(path, body)
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setNotice(
        "Change requested. The billing status will update when Polar confirms it.",
      )
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Billing request failed",
      )
    } finally {
      setPending(null)
    }
  }

  if (!organizationId)
    return (
      <p className="text-sm text-muted-foreground">
        Select an organization to manage billing.
      </p>
    )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan & billing</CardTitle>
          <CardDescription>
            Subscription and credits for this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !summary ? (
            <p className="text-sm text-muted-foreground">Loading billing…</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          {summary ? (
            <>
              <div>
                <p className="text-lg font-semibold">
                  {summary.plan?.name ?? "Free"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {summary.plan
                    ? `${summary.plan.status}${summary.plan.cancelAtPeriodEnd ? " · Ends" : " · Renews"} ${formatDate(summary.plan.periodEnd)}`
                    : "500 welcome credits when this organization was created"}
                </p>
                {summary.plan?.pendingProductId ? (
                  <p className="text-sm text-muted-foreground">
                    Plan change pending payment confirmation. New credits will
                    appear after payment succeeds.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total credits</p>
                  <p className="text-xl font-semibold">
                    {formatCredits(summary.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Included</p>
                  <p className="text-xl font-semibold">
                    {formatCredits(summary.includedBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(summary.includedExpiresAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchased</p>
                  <p className="text-xl font-semibold">
                    {formatCredits(summary.purchasedBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(summary.purchasedExpiresAt)}
                  </p>
                </div>
              </div>
              {summary.canManage ? (
                <div className="flex flex-wrap gap-2">
                  {summary.plan?.cancelAtPeriodEnd ? (
                    <Button
                      variant="outline"
                      disabled={!!pending}
                      onClick={() => void perform("resume", "resume")}
                    >
                      Resume subscription
                    </Button>
                  ) : summary.plan ? (
                    <Button
                      variant="outline"
                      disabled={!!pending}
                      onClick={() => void perform("cancel", "cancel")}
                    >
                      Cancel at period end
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={!!pending || !summary.plan}
                    onClick={() => void perform("portal", "portal")}
                  >
                    Payment details & receipts
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ask an organization owner or admin to manage purchases.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Monthly plans</h2>
        <p className="text-sm text-muted-foreground">
          Upgrades charge the full new plan price, add its full credits to your
          remaining included credits, and start a new monthly billing period
          after payment. Downgrades take effect at the next renewal.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {products
            .filter((product) => product.kind === "plan")
            .map((product) => {
              const currentTier = products.find(
                (candidate) => candidate.id === summary?.plan?.id,
              )?.planTier
              const isUpgrade =
                summary?.plan &&
                currentTier != null &&
                product.planTier != null &&
                product.planTier > currentTier
              const isDowngrade =
                summary?.plan &&
                currentTier != null &&
                product.planTier != null &&
                product.planTier < currentTier
              return (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-semibold">
                      {formatPrice(product.priceAmount, product.currency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    </p>
                    <p className="text-sm">
                      {formatCredits(product.credits)} credits each month
                    </p>
                    {isUpgrade ? (
                      <p className="text-sm text-muted-foreground">
                        The full new plan price is billed now. Add{" "}
                        {formatCredits(product.credits)} credits and reset
                        renewal after payment. Polar calculates the final total.
                      </p>
                    ) : isDowngrade ? (
                      <p className="text-sm text-muted-foreground">
                        Starts at your next renewal.
                      </p>
                    ) : null}
                    {summary?.canManage ? (
                      <Button
                        disabled={
                          !!pending ||
                          !!summary.plan?.pendingProductId ||
                          summary.plan?.id === product.id ||
                          (!!summary.plan && currentTier === product.planTier)
                        }
                        onClick={() =>
                          void perform(
                            product.id,
                            summary.plan ? "change-plan" : "checkout",
                            summary.plan
                              ? { productId: product.id }
                              : { productId: product.id, kind: "plan" },
                          )
                        }
                      >
                        {summary.plan?.id === product.id
                          ? "Current plan"
                          : summary.plan
                            ? isUpgrade
                              ? "Upgrade now"
                              : isDowngrade
                                ? "Schedule downgrade"
                                : "Change plan"
                            : "Subscribe"}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Extra credits</h2>
        <p className="text-sm text-muted-foreground">
          Credit packs are available with a paid plan. Each purchase extends all
          purchased credits to 12 months from that purchase.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {products
            .filter((product) => product.kind === "pack")
            .map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle>
                    {formatCredits(product.credits)} credits
                  </CardTitle>
                  <CardDescription>{product.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-semibold">
                    {formatPrice(product.priceAmount, product.currency)}
                  </p>
                  {summary?.canManage ? (
                    <Button
                      disabled={!!pending || !summary.plan}
                      onClick={() =>
                        void perform(product.id, "checkout", {
                          productId: product.id,
                          kind: "pack",
                        })
                      }
                    >
                      Buy credits
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
        </div>
      </section>
    </div>
  )
}
