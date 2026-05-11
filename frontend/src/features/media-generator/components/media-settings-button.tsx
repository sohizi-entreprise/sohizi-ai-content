import { useState } from 'react'
import { MediaSettingsDialog } from './media-settings-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconSettingsSpark } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type MediaSettingsButtonProps = {
  className?: string
}

export function MediaSettingsButton({ className }: MediaSettingsButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className={cn("h-6 rounded-full px-3 text-sm text-zinc-200 hover:bg-white/10 hover:text-white", className)}
          >
            <IconSettingsSpark className="size-4" />
            Media
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Customize your media generation settings</p>
        </TooltipContent>
      </Tooltip>
      <MediaSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
