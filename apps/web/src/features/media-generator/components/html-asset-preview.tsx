import { useEffect, useMemo, useRef, useState } from "react"
import {
  isBooleanVariable,
  isColorVariable,
  isEnumVariable,
  isNumberVariable,
  isStringVariable,
} from "@sohizi/video-composition"
import { useMutation } from "@tanstack/react-query"
import { Code2, X } from "lucide-react"
import { toast } from "sonner"
import { updateHtmlAssetValuesMutationOptions } from "../query-mutations"
import type { CompositionVariable } from "@sohizi/video-composition"
import type { HyperframesPlayerElement } from "@/types/hyperframes-player"
import type { MediaAsset } from "../requests"
import type { HtmlAssetMetadata } from "../types"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Slider } from "@sohizi/ui/slider"
import { Switch } from "@sohizi/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import {
  applyLiveHtmlConfig,
  buildDefaultValues,
  extractVariableSchema,
  prepareHtmlDocument,
} from "@/features/video-editor/utils/html-clip"

import "@hyperframes/player"

type CompositionValues = Record<string, string | number | boolean>

function readHtmlMetadata(item: MediaAsset): HtmlAssetMetadata {
  return item.metadata ?? {}
}

function toCompositionVariables(
  metadata: HtmlAssetMetadata,
): Array<CompositionVariable> {
  return (metadata.variables ?? []) as Array<CompositionVariable>
}

function formatDuration(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds)) return null
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function valuesEqual(a: CompositionValues, b: CompositionValues) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

export function RenderHtml({ item }: { item: MediaAsset }) {
  const metadata = readHtmlMetadata(item)
  const durationLabel = formatDuration(metadata.duration)

  return (
    <Dialog>
      <DialogTrigger className="size-full">
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/40 px-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-background/80">
            <Code2 className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-full truncate text-sm font-medium text-foreground">
            {item.name.replace(/\.html$/i, "")}
          </div>
          {durationLabel ? (
            <span className="rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">
              {durationLabel}
            </span>
          ) : null}
        </div>
      </DialogTrigger>
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden bg-surface/30 p-4 backdrop-blur-sm sm:max-w-5xl md:max-w-6xl"
        showCloseButton={false}
      >
        <HtmlPreviewDialogBody item={item} metadata={metadata} />
        <DialogClose asChild>
          <Button
            size="icon"
            className="absolute -top-4 -right-4 rounded-full border bg-surface backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-surface"
          >
            <X className="size-4 text-foreground" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function HtmlPreviewDialogBody({
  item,
  metadata,
}: {
  item: MediaAsset
  metadata: HtmlAssetMetadata
}) {
  const playerRef = useRef<HyperframesPlayerElement | null>(null)
  const metadataVariables = useMemo(
    () => toCompositionVariables(metadata),
    [metadata],
  )
  const savedValuesFromMetadata = metadata.values ?? {}
  const [rawHtml, setRawHtml] = useState<string | null>(null)
  const [variables, setVariables] =
    useState<Array<CompositionVariable>>(metadataVariables)
  const [values, setValues] = useState<CompositionValues>(() => ({
    ...buildDefaultValues(metadataVariables),
    ...savedValuesFromMetadata,
  }))
  const [savedValues, setSavedValues] = useState<CompositionValues>(() => ({
    ...buildDefaultValues(metadataVariables),
    ...savedValuesFromMetadata,
  }))
  const [playerSrc, setPlayerSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingHtml, setIsLoadingHtml] = useState(true)

  const { mutateAsync: saveValues, isPending: isSaving } = useMutation(
    updateHtmlAssetValuesMutationOptions(item.projectId, item.id),
  )

  const isDirty = !valuesEqual(values, savedValues)

  // 1) Fetch HTML once; recover variables from the document (metadata may be empty).
  // Do not re-fetch when metadata.values change after save — that would reload the player.
  useEffect(() => {
    let cancelled = false

    setIsLoadingHtml(true)
    setError(null)
    setRawHtml(null)
    setPlayerSrc(null)

    fetch(item.url)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load HTML composition")
        return response.text()
      })
      .then((html) => {
        if (cancelled) return
        const fromHtml = extractVariableSchema(html)
        const nextVariables = fromHtml.length > 0 ? fromHtml : metadataVariables
        const nextValues: CompositionValues = {}
        for (const variable of nextVariables) {
          nextValues[variable.id] =
            savedValuesFromMetadata[variable.id] ?? variable.default
        }
        setVariables(nextVariables)
        setValues(nextValues)
        setSavedValues(nextValues)
        setRawHtml(html)
        setIsLoadingHtml(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load HTML composition",
        )
        setIsLoadingHtml(false)
      })

    return () => {
      cancelled = true
    }
    // only reload when the HTML source URL changes (not after saving values)
  }, [item.url])

  // 2) Build the player document once when source HTML is ready (not on every edit).
  useEffect(() => {
    if (!rawHtml) return

    const prepared = prepareHtmlDocument(rawHtml, variables, values)
    const objectUrl = URL.createObjectURL(
      new Blob([prepared], { type: "text/html" }),
    )
    setPlayerSrc(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
    // Only recreate the blob when the source HTML changes.
    // values/variables are applied live below
  }, [rawHtml])

  // 3) Push edits into the live iframe — no src reload, no playback reset.
  useEffect(() => {
    if (!playerSrc) return

    const player = playerRef.current
    if (!player) return

    const apply = () => {
      applyLiveHtmlConfig(
        player.iframeElement.contentDocument,
        variables,
        values,
      )
    }

    apply()
    player.addEventListener("ready", apply)
    player.iframeElement.addEventListener("load", apply)
    return () => {
      player.removeEventListener("ready", apply)
      player.iframeElement.removeEventListener("load", apply)
    }
  }, [playerSrc, variables, values])

  const handleSave = async () => {
    try {
      await saveValues(values)
      setSavedValues(values)
      toast.success("Composition values saved")
    } catch {
      toast.error("Failed to save composition values")
    }
  }

  const width = metadata.width ?? 1920
  const height = metadata.height ?? 1080
  const hasVariables = variables.length > 0

  return (
    <div
      className={
        hasVariables
          ? "grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_16rem] gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_18rem] md:grid-rows-1"
          : "grid min-h-0 flex-1 grid-cols-1 overflow-hidden"
      }
    >
      <div className="relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-black">
        {error ? (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-destructive">
            {error}
          </div>
        ) : isLoadingHtml || !playerSrc ? (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Loading composition…
          </div>
        ) : (
          <hyperframes-player
            ref={playerRef}
            src={playerSrc}
            controls
            width={width}
            height={height}
            className="absolute inset-0 block size-full"
          />
        )}
      </div>

      {hasVariables ? (
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/90 p-3">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <div className="text-sm font-medium text-foreground">
              Dynamic fields
            </div>
            <Button
              size="sm"
              disabled={!isDirty || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {variables.map((variable) => (
              <VariableField
                key={variable.id}
                variable={variable}
                value={values[variable.id] ?? variable.default}
                onChange={(next) =>
                  setValues((current) => ({ ...current, [variable.id]: next }))
                }
              />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  )
}

function VariableField({
  variable,
  value,
  onChange,
}: {
  variable: CompositionVariable
  value: string | number | boolean
  onChange: (value: string | number | boolean) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{variable.label}</Label>
      {isStringVariable(variable) ? (
        <Input
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {isColorVariable(variable) ? (
        <Input
          type="color"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 cursor-pointer p-1"
        />
      ) : null}
      {isNumberVariable(variable) ? (
        <Slider
          min={variable.min ?? 0}
          max={variable.max ?? 100}
          step={variable.step ?? 0.01}
          value={[Number(value)]}
          onValueChange={([next]) => onChange(next)}
        />
      ) : null}
      {isBooleanVariable(variable) ? (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      ) : null}
      {isEnumVariable(variable) ? (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {variable.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
