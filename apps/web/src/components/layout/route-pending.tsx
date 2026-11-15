export function RoutePending({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
