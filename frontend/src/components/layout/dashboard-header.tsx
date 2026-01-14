type Props = {
    rightSide?: React.ReactNode
    leftSide?: React.ReactNode
}

export default function DashboardHeader({ rightSide, leftSide }: Props) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/8 bg-black/60 backdrop-blur-xl">
        <div className="flex h-header items-center justify-between px-4">
            <div>
                {leftSide}
            </div>

            <div className="flex items-center gap-2">
             {rightSide}
            </div>
        </div>
    </header>
  )
}
