import CreateProject from "./create-project"

export default function ProjectHeader() {
  return (
    <div className="flex flex-col gap-8 pt-8 font-space-grotesk">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Your current projects
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage &amp; start new adventures.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <CreateProject />
        </div>
      </div>
    </div>
  )
}
