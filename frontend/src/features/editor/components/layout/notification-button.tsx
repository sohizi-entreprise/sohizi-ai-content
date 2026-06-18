import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { IconBell, IconX } from '@tabler/icons-react';
import { useNotificationManager } from '@/features/notifications/hooks/use-notification-manager';
import { useNotificationStore } from '../../stores/notification-store';
import { useShallow } from 'zustand/shallow';
import { GenerationRequestNotification } from '@/features/notifications/requests';

export default function NotificationButton() {
    const { projectId } = useParams({ from: '/dashboard/projects/$projectId' })
    const [open, setOpen] = useState(false)
    useNotificationManager(projectId)

    const notifications = useNotificationStore(useShallow((state) => state.notifications))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
            <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Notifications"
            >
            <IconBell className="size-4" />
            </Button>
        </SheetTrigger>
        <SheetContent side="right" showCloseButton={false} className="w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>Pending Requests</SheetTitle>
            <SheetDescription className="sr-only">
              View your pending requests
            </SheetDescription>
          </SheetHeader>
  
          <div className="p-4 overflow-y-auto overscroll-y-none">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
          <SheetClose asChild>
            <Button size="icon" className="size-8 rounded-full absolute top-4 -left-10" aria-label="Close">
              <IconX className="size-4" />
            </Button>
          </SheetClose>
        </SheetContent>
    </Sheet>
  )
}


function NotificationItem({ notification }: { notification: GenerationRequestNotification }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium">{notification.type}</div>
      <div className="text-sm text-muted-foreground">{notification.status}</div>
    </div>
  )
}

