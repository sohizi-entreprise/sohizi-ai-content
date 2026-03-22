import { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { DotsLoader, TextShimmer } from "@/components/ui/loaders";

type Props = {
  className?: ClassValue;
  children: React.ReactNode;
}
export default function OverLayStreamingProgress({className, children}: Props) {
  return (
    <div className={cn('fixed inset-0 bg-black/50 flex items-center justify-center z-5', className)}>
        <div className='bg-white p-4 rounded-md space-y-4 min-w-md'>
          <div className="flex items-center gap-2 text-black">
            <TextShimmer text="Generating" />
            <DotsLoader />

          </div>

          <div className="w-full h-px bg-muted-foreground/10"/>
          
          {children}
        </div>
    </div>
  )
}


