import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { CreateOrganizationForm } from "./create-organization-form"

export function OrgSetupModal({
  open,
  onOpenChange,
  onCreated,
  showCloseButton = false,
  title = "Name Your Organization",
  description = "This is your workspace where you'll create and manage projects.",
  submitLabel,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  onCreated: () => void | Promise<void>
  showCloseButton?: boolean
  title?: string
  description?: string
  submitLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm
          onCreated={onCreated}
          submitLabel={submitLabel}
        />
      </DialogContent>
    </Dialog>
  )
}
