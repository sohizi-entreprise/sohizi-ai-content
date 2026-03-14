export function TextSkeleton(){
    return (
        <div className="space-y-3">
            <div className="h-2 bg-slate-500/10 rounded-full w-1/3" />
            <div className="h-2 bg-slate-500/10 rounded-full w-full" />
            <div className="h-2 bg-slate-500/8 rounded-full w-[90%]"/>
            <div className="h-2 bg-slate-500/6 rounded-full w-[90%] mx-auto" />
            <div className="h-2 bg-slate-500/4 rounded-full w-full" />
            <div className="h-2 bg-slate-500/3 rounded-full w-[85%]" />
            <div className="h-2 bg-slate-500/2 rounded-full w-[92%]" />
        </div>
    )
}