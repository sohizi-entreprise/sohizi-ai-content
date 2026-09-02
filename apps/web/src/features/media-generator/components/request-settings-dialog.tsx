import { flattenRequestSettings } from "../lib/request-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sohizi/ui/table"

type RequestSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: Record<string, unknown> | null
}

export function RequestSettingsDialog({
  open,
  onOpenChange,
  request,
}: RequestSettingsDialogProps) {
  const rows = flattenRequestSettings(request)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="md:max-w-2xl"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Request settings</DialogTitle>
          <DialogDescription>
            Settings used when this generation was created.
          </DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No settings were stored for this request.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-xl border **:data-[slot=table-container]:overflow-visible">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key} className="text-muted-foreground">
                    <TableCell className="whitespace-normal">
                      {row.key}
                    </TableCell>
                    <TableCell className="whitespace-normal break-all">
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
