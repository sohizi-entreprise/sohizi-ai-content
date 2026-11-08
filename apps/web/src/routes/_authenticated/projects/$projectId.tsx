import { useLayoutEffect } from "react"
import { Outlet, createFileRoute, useParams } from "@tanstack/react-router"
import { AppHeader } from "@/components/layout/app-header"
import { AppNavBar } from "@/components/layout/app-nav-bar"
import { useChatStore } from "@/features/chat/store/chat-store"
import { useEditorStore } from "@/features/editor/stores/editor-store"

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: RouteComponent,
})

function RouteComponent() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId",
  })

  useLayoutEffect(() => {
    useEditorStore.getState().closeAllTabs()
    const chatState = useChatStore.getState()
    if (chatState.activeConversation?.projectId !== projectId) {
      chatState.init(projectId)
    }
  }, [projectId])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background pr-2">
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppNavBar />
        <Outlet />
      </div>
    </div>
  )
}
