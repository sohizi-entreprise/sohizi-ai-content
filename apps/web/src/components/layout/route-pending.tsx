export function RoutePending({
  label = "Initializing your project",
}: {
  label?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img src="/loading-search.svg" alt="" className="h-auto w-72" />
        <div
          className="relative h-1 w-48 overflow-hidden rounded-full bg-primary/20"
          role="progressbar"
          aria-busy="true"
          aria-label={label}
        >
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-primary motion-safe:animate-[route-pending-bar_1.4s_ease-in-out_infinite]" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <style>{`
        @keyframes route-pending-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
