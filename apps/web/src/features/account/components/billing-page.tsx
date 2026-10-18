import { useCallback, useEffect, useState } from "react"
import { Button } from "@sohizi/ui/button"
import { Badge } from "@sohizi/ui/badge"
import { Card, CardContent } from "@sohizi/ui/card"
import { CheckCircle2, CircleHelp, Wallet } from "lucide-react"
import { Slider } from "@sohizi/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { IconCoins } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"

const CREDIT_STEP = 50
const CREDIT_SLIDER_MAX = 50_000

type CatalogProduct = {
  id: string
  name: string
  description: string | null
  kind: "plan" | "pack"
  credits: number | null
  planTier: number | null
  priceAmount: number | null
  currency: string | null
  unitAmount: number | null
  minimumUnits: number | null
  maximumUnits: number | null
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
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)

function packSliderBounds(product: CatalogProduct) {
  const minimum = product.minimumUnits ?? 1
  const min = Math.ceil(minimum / CREDIT_STEP) * CREDIT_STEP
  const cap = Math.min(
    CREDIT_SLIDER_MAX,
    product.maximumUnits ?? CREDIT_SLIDER_MAX,
  )
  return { min, max: Math.max(min, cap) }
}

function PaygPackCard({
  product,
  pending,
  canBuy,
  onBuy,
}: {
  product: CatalogProduct
  pending: boolean
  canBuy: boolean
  onBuy: (units: number) => void
}) {
  const { min, max } = packSliderBounds(product)
  const [units, setUnits] = useState(min)
  const currency = product.currency ?? "usd"
  const unitAmount = product.unitAmount ?? 0
  const selected = Math.min(max, Math.max(min, units))

  return (
    <Card className="border-none bg-white/5! transition-colors">
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-1.5 font-semibold tracking-tight text-primary">
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Purchased credits expire{" "}
            <span className="font-medium text-foreground">12 months</span> after
            this purchase.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              {formatCredits(selected)} credits
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatPrice(selected * unitAmount, currency)}
            </p>
          </div>
          <Slider
            min={min}
            max={max}
            step={CREDIT_STEP}
            value={[selected]}
            disabled={pending || !canBuy}
            onValueChange={([next]) => {
              setUnits(next)
            }}
            className="**:data-[slot=slider-track]:bg-background"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCredits(min)}</span>
            <span>{formatCredits(max)}</span>
          </div>
        </div>
        {canBuy ? (
          <Button
            className="w-full cursor-pointer rounded-full transition-transform duration-200 hover:scale-102 font-semibold"
            disabled={pending}
            onClick={() => onBuy(selected)}
          >
            <IconCoins className="size-4" />
            Buy credits
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AccountBillingPage() {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId
  const [summary, setSummary] = useState<Summary | null>(null)
  const [products, setProducts] = useState<Array<CatalogProduct>>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [downgradeProduct, setDowngradeProduct] =
    useState<CatalogProduct | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

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
      "Payment successful. Your credits are being updated and may take a few seconds to appear.",
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
        "Your change was submitted successfully. Your billing details may take a few seconds to update.",
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
      <Card className="overflow-hidden bg-white/5! border-none">
        <CardContent className="space-y-6">
          {loading && !summary ? (
            <p className="text-sm text-muted-foreground">Loading billing…</p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-foreground/80"
            >
              {notice}
            </p>
          ) : null}
          {summary ? (
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
                          summary.plan.cancelAtPeriodEnd
                            ? "outline"
                            : "secondary"
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
                      Plan change pending payment confirmation. New credits will
                      appear after payment succeeds.
                    </p>
                  ) : null}
                </div>
                {summary.canManage ? (
                  <Button
                    variant="outline"
                    disabled={!!pending || !summary.plan}
                    onClick={() => void perform("portal", "portal")}
                    className="cursor-pointer rounded-full border-white/20! transition-transform duration-200 hover:scale-105"
                  >
                    <Wallet className="size-4" />
                    View payment details
                  </Button>
                ) : null}
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
                        Credits included with your monthly plan. Unused credits
                        expire at the end of each billing period.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatCredits(summary.includedBalance)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires {formatDate(summary.includedExpiresAt)}
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
                        Credits bought separately from your plan. They remain
                        available until the expiration date shown below.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatCredits(summary.purchasedBalance)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires {formatDate(summary.purchasedExpiresAt)}
                  </p>
                </div>
              </div>

              {!summary.canManage ? (
                <p className="border-t border-white/10 pt-5 text-sm text-muted-foreground">
                  Ask an organization owner or admin to manage purchases.
                </p>
              ) : summary.plan ? (
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-5">
                  {summary.plan.cancelAtPeriodEnd ? (
                    <Button
                      disabled={!!pending}
                      onClick={() => void perform("resume", "resume")}
                      className="cursor-pointer rounded-full transition-transform duration-200 hover:scale-105"
                    >
                      Resume subscription
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={!!pending}
                      onClick={() => setCancelDialogOpen(true)}
                      className="cursor-pointer rounded-full border-white/20! transition-transform duration-200 hover:scale-105"
                    >
                      Cancel at period end
                    </Button>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Monthly plans</h2>
        <p className="text-sm text-muted-foreground">
          Upgrades charge the full new plan price, add its full credits to your
          remaining included credits, and start a new monthly billing period
          after payment. Downgrades take effect at the next renewal.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {products
            .filter(
              (product) =>
                product.kind === "plan" &&
                product.priceAmount != null &&
                product.currency != null &&
                product.credits != null,
            )
            .sort(
              (a, b) =>
                (a.planTier ?? Number.MAX_SAFE_INTEGER) -
                (b.planTier ?? Number.MAX_SAFE_INTEGER),
            )
            .map((product) => {
              const currentTier = products.find(
                (candidate) => candidate.id === summary?.plan?.id,
              )?.planTier
              const isCurrent = summary?.plan?.id === product.id
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
                <Card
                  key={product.id}
                  className={cn(
                    "relative transition-colors border border-white/10!",
                    isCurrent ? "bg-white/5!" : "bg-primary/10",
                  )}
                >
                  {isCurrent ? (
                    <Badge className="absolute right-4 top-4 gap-1 rounded-full">
                      <CheckCircle2 className="size-3" />
                      Current
                    </Badge>
                  ) : null}
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold tracking-tight">
                        {product.name}
                      </h3>
                      {product.description ? (
                        <p className="text-sm text-muted-foreground">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight">
                        {formatPrice(product.priceAmount!, product.currency!)}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        / month
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <IconCoins className="size-4" />
                      {formatCredits(product.credits!)} credits each month
                    </p>
                    {isUpgrade ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        The full new plan price is billed now. Add{" "}
                        {formatCredits(product.credits!)} credits and reset
                        renewal after payment. Your final total is calculated at
                        checkout.
                      </p>
                    ) : isDowngrade ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Starts at your next renewal.
                      </p>
                    ) : null}
                    {summary?.canManage ? (
                      <Button
                        className={cn(
                          "w-full cursor-pointer rounded-full transition-transform duration-200 hover:scale-105",
                          isCurrent && "border-white/20!",
                        )}
                        variant={isCurrent ? "outline" : "default"}
                        disabled={
                          !!pending ||
                          !!summary.plan?.pendingProductId ||
                          isCurrent ||
                          (!!summary.plan && currentTier === product.planTier)
                        }
                        onClick={() => {
                          if (isDowngrade) {
                            setDowngradeProduct(product)
                            return
                          }
                          void perform(
                            product.id,
                            summary.plan ? "change-plan" : "checkout",
                            summary.plan
                              ? { productId: product.id }
                              : { productId: product.id, kind: "plan" },
                          )
                        }}
                      >
                        {isCurrent
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Extra credits</h2>
        <p className="text-sm text-muted-foreground">
          Credit packs are{" "}
          <span className="text-foreground font-medium">
            available with a paid plan
          </span>
          . Each purchase extends all purchased credits to 12 months from that
          purchase.
        </p>
        <div>
          {products
            .filter(
              (product) =>
                product.kind === "pack" &&
                product.unitAmount != null &&
                product.currency != null,
            )
            .map((product) => (
              <PaygPackCard
                key={product.id}
                product={product}
                pending={!!pending || !summary?.plan}
                canBuy={!!summary?.canManage}
                onBuy={(units) =>
                  void perform(product.id, "checkout", {
                    productId: product.id,
                    kind: "pack",
                    units,
                  })
                }
              />
            ))}
        </div>
      </section>

      <Dialog
        open={!!downgradeProduct}
        onOpenChange={(open) => {
          if (!open) setDowngradeProduct(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm plan downgrade</DialogTitle>
            <DialogDescription>
              Switch to {downgradeProduct?.name} on{" "}
              {formatDate(summary?.plan?.periodEnd ?? null)}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Until renewal</p>
              <p className="text-muted-foreground">
                Your current plan and credits stay the same. Nothing is charged
                today.
              </p>
            </div>
            <div>
              <p className="font-medium">At renewal</p>
              <p className="text-muted-foreground">
                Unused included credits expire. You’ll be charged{" "}
                {downgradeProduct?.priceAmount != null &&
                downgradeProduct.currency
                  ? formatPrice(
                      downgradeProduct.priceAmount,
                      downgradeProduct.currency,
                    )
                  : "the new plan price"}{" "}
                and receive{" "}
                {downgradeProduct?.credits != null
                  ? formatCredits(downgradeProduct.credits)
                  : "the new plan’s"}{" "}
                credits.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDowngradeProduct(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!downgradeProduct) return
                const productId = downgradeProduct.id
                setDowngradeProduct(null)
                void perform(productId, "change-plan", { productId })
              }}
            >
              Confirm downgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              Your plan will end on{" "}
              {formatDate(summary?.plan?.periodEnd ?? null)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Until then</p>
              <p className="text-muted-foreground">
                Your plan and credits stay available. There is no refund for the
                current period. You can undo this cancellation any time before
                the plan ends.
              </p>
            </div>
            <div>
              <p className="font-medium">When the plan ends</p>
              <p className="text-muted-foreground">
                You won’t be charged again. Unused included credits expire;
                purchased credits keep their current expiration date.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep plan
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setCancelDialogOpen(false)
                void perform("cancel", "cancel")
              }}
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
