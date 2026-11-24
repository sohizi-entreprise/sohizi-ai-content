import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@sohizi/ui/button"
import { Card, CardContent } from "@sohizi/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { Spinner } from "@sohizi/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sohizi/ui/tabs"
import { Check, ChevronDown, ExternalLink, Wallet } from "lucide-react"
import {
  BillingCreditsSummary,
  billingRequest,
  formatCredits,
} from "./billing-summary"
import type { BillingSummary } from "./billing-summary"
import type {
  ModelPreferenceCostParameter,
  ModelPreferenceEstimate,
  ModelPreferenceModelOption,
  ModelPreferenceParameters,
  ProjectModelPreference,
} from "@/features/projects/type"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import {
  getProjectModelPreferencesQueryOptions,
  updateProjectModelPreferenceMutationOptions,
} from "@/features/projects/query-mutation"
import { estimateProjectModelPreference } from "@/features/projects/request"
import { useSession } from "@/lib/auth-client"

export function formatEstimateText(estimate: ModelPreferenceEstimate | null) {
  if (!estimate) return null
  if (estimate.kind === "range") {
    return `${formatCredits(estimate.minCredits)} - ${formatCredits(estimate.maxCredits)} ${estimate.unitLabel}`
  }
  return `${formatCredits(estimate.credits)} ${estimate.unitLabel}`
}

function areParametersEqual(
  left: ModelPreferenceParameters,
  right: ModelPreferenceParameters,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => String(left[key]) === String(right[key]))
}

function PreferenceRow({
  projectId,
  preference,
}: {
  projectId: string
  preference: ProjectModelPreference
}) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [modelId, setModelId] = useState(preference.modelId)
  const [parameters, setParameters] = useState<ModelPreferenceParameters>(
    preference.parameters,
  )
  const [costParameters, setCostParameters] = useState<
    Array<ModelPreferenceCostParameter>
  >(preference.costParameters)
  const [estimate, setEstimate] = useState<ModelPreferenceEstimate | null>(
    preference.estimate,
  )
  const [estimating, setEstimating] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setModelId(preference.modelId)
    setParameters(preference.parameters)
    setCostParameters(preference.costParameters)
    setEstimate(preference.estimate)
  }, [
    preference.costParameters,
    preference.estimate,
    preference.modelId,
    preference.parameters,
  ])

  const updateMutation = useMutation(
    updateProjectModelPreferenceMutationOptions(projectId),
  )

  const selectedModel = useMemo(
    () =>
      preference.models.find((item) => item.id === modelId) ?? {
        id: modelId,
        name: modelId,
        provider: modelId.split("/").at(0) ?? "openai",
      },
    [modelId, preference.models],
  )

  const groupedModels = useMemo(() => {
    const map = new Map<string, Array<ModelPreferenceModelOption>>()
    for (const item of preference.models) {
      const list = map.get(item.provider) ?? []
      list.push(item)
      map.set(item.provider, list)
    }
    return map
  }, [preference.models])

  const refreshEstimate = useCallback(
    async (nextModelId: string, nextParameters: ModelPreferenceParameters) => {
      setEstimating(true)
      try {
        const result = await estimateProjectModelPreference(projectId, {
          key: preference.key,
          modelId: nextModelId,
          parameters: nextParameters,
        })
        setParameters(result.parameters)
        setCostParameters(result.costParameters)
        setEstimate(result.estimate)
      } finally {
        setEstimating(false)
      }
    },
    [preference.key, projectId],
  )

  const handleSelectModel = (next: ModelPreferenceModelOption) => {
    setSelectorOpen(false)
    setJustSaved(false)
    setModelId(next.id)
    void refreshEstimate(next.id, parameters)
  }

  const handleChangeParameter = (key: string, value: string) => {
    setJustSaved(false)
    const nextParams = { ...parameters, [key]: value }
    setParameters(nextParams)
    void refreshEstimate(modelId, nextParams)
  }

  const isDirty =
    modelId !== preference.modelId ||
    !areParametersEqual(parameters, preference.parameters)

  const handleSave = async () => {
    const saved = await updateMutation.mutateAsync({
      key: preference.key,
      modelId,
      parameters,
    })
    setModelId(saved.modelId)
    setParameters(saved.parameters)
    setCostParameters(saved.costParameters)
    setEstimate(saved.estimate)
    setJustSaved(true)
  }

  const estimateText = formatEstimateText(estimate)

  return (
    <div
      data-testid={`preference-row-${preference.key}`}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/3 px-4 py-3 lg:flex-nowrap"
    >
      <div className="w-full shrink-0 lg:w-64">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {preference.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {preference.description}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <ModelSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
          <ModelSelectorTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${preference.label} model`}
              className="h-8 gap-2 border-white/10! bg-background/60 px-2.5 text-xs font-normal dark:border-white/10!"
            >
              <ModelSelectorLogo provider={selectedModel.provider} />
              <span className="max-w-44 truncate">{selectedModel.name}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </ModelSelectorTrigger>
          <ModelSelectorContent
            title={`Select ${preference.label} model`}
            className="max-w-sm border-white/10! outline-none!"
          >
            <ModelSelectorInput placeholder="Search models..." />
            <ModelSelectorList>
              <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
              {Array.from(groupedModels.entries()).map(([provider, items]) => (
                <ModelSelectorGroup
                  key={provider}
                  heading={provider.toUpperCase()}
                >
                  {items.map((item) => (
                    <ModelSelectorItem
                      key={item.id}
                      value={`${item.name} ${item.provider} ${item.id}`}
                      onSelect={() => handleSelectModel(item)}
                      className="flex items-center gap-2"
                    >
                      <ModelSelectorLogo provider={item.provider} />
                      <ModelSelectorName>{item.name}</ModelSelectorName>
                      {item.id === modelId ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              ))}
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>

        {costParameters.map((param) => {
          const rawValue = (
            parameters as Record<string, string | number | undefined>
          )[param.key]
          const currentValue = String(
            rawValue ?? param.defaultValue ?? param.options.at(0)?.value ?? "",
          )
          return (
            <Select
              key={param.key}
              value={currentValue}
              onValueChange={(value) => handleChangeParameter(param.key, value)}
            >
              <SelectTrigger
                size="sm"
                aria-label={`${preference.label} ${param.label}`}
                className="h-8 min-w-24 border-white/10 bg-background/60 px-2.5 text-xs"
              >
                <span className="text-muted-foreground">{param.label}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {param.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        })}
      </div>

      <div className="ml-auto flex shrink-0 items-center justify-end gap-3">
        {preference.key !== "leading-agent" ? (
          <div
            role="status"
            aria-live="polite"
            className="text-right text-xs font-medium text-muted-foreground"
          >
            {estimating ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3 animate-spin" />
                Estimating...
              </span>
            ) : (
              <span>{estimateText ?? "—"}</span>
            )}
          </div>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant={isDirty ? "default" : "outline"}
          disabled={!isDirty || updateMutation.isPending || estimating}
          onClick={() => void handleSave()}
          className="h-8 min-w-16 px-3 text-xs"
        >
          {updateMutation.isPending ? (
            <Spinner className="size-3.5 animate-spin" />
          ) : justSaved && !isDirty ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" />
              Saved
            </span>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  )
}

export function AccountPreferencesTabView({
  projectId,
}: {
  projectId: string
}) {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId

  const { data: preferences = [], isLoading: preferencesLoading } = useQuery({
    ...getProjectModelPreferencesQueryOptions(projectId),
    enabled: Boolean(projectId),
  })

  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null,
  )
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const loadBillingSummary = useCallback(async () => {
    if (!organizationId) return
    setBillingLoading(true)
    try {
      const nextSummary = await billingRequest<BillingSummary>("summary")
      setBillingSummary(nextSummary)
      setBillingError(null)
    } catch (cause) {
      setBillingError(
        cause instanceof Error ? cause.message : "Billing is unavailable",
      )
    } finally {
      setBillingLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (organizationId) {
      void loadBillingSummary()
    }
  }, [organizationId, loadBillingSummary])

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Project preferences & billing
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Choose the preferred models Kobi uses across this project. Kobi
              follows these defaults whenever they fit, and may switch to
              another model if a task needs a better-suited option, the default
              is unavailable, or you ask for a specific model.
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link to="/account/profile">
              Account settings
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="preferences" className="flex flex-col gap-6">
          <TabsList className="flex h-12 w-full items-center justify-start gap-8 rounded-xl bg-background sticky top-4 z-10 px-6 py-0">
            <TabsTrigger
              value="preferences"
              className="relative h-full flex-none cursor-pointer rounded-none border-none bg-transparent! px-1 py-0 text-sm font-medium text-muted-foreground shadow-none! transition-colors hover:text-foreground data-[state=active]:border-transparent! data-[state=active]:bg-transparent! data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none! dark:data-[state=active]:bg-transparent! dark:data-[state=active]:text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:rounded-t-full after:bg-transparent after:transition-colors data-[state=active]:after:bg-primary"
            >
              Preferences
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="relative h-full flex-none cursor-pointer rounded-none border-none bg-transparent! px-1 py-0 text-sm font-medium text-muted-foreground shadow-none! transition-colors hover:text-foreground data-[state=active]:border-transparent! data-[state=active]:bg-transparent! data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none! dark:data-[state=active]:bg-transparent! dark:data-[state=active]:text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:rounded-t-full after:bg-transparent after:transition-colors data-[state=active]:after:bg-primary"
            >
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-2.5">
            {preferencesLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Spinner className="mr-2 size-4 animate-spin" />
                Loading model preferences...
              </div>
            ) : (
              <div className="space-y-2.5">
                {preferences.map((preference) => (
                  <PreferenceRow
                    key={preference.key}
                    projectId={projectId}
                    preference={preference}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="billing">
            {!organizationId ? (
              <p className="text-sm text-muted-foreground">
                Select an organization to view billing credits.
              </p>
            ) : (
              <Card className="overflow-hidden border-none bg-white/5!">
                <CardContent className="space-y-6">
                  {billingLoading && !billingSummary ? (
                    <p className="text-sm text-muted-foreground">
                      Loading billing...
                    </p>
                  ) : null}
                  {billingError ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {billingError}
                    </p>
                  ) : null}
                  {billingSummary ? (
                    <BillingCreditsSummary
                      summary={billingSummary}
                      action={
                        <Button
                          asChild
                          variant="outline"
                          className="cursor-pointer rounded-full border-white/20!"
                        >
                          <Link to="/account/billing">
                            <Wallet className="size-4" />
                            Manage billing
                          </Link>
                        </Button>
                      }
                    />
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
