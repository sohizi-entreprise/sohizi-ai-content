import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { CharacterCount } from "@tiptap/extension-character-count"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "@tiptap/markdown"
import { useParams } from "@tanstack/react-router"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { MAX_CHARACTER_COUNT } from "../../constants"
import { useAutoSave } from "../../hooks/use-autosave"
import { usePendingMarkdownChanges } from "../../hooks/use-pending-markdown-changes"
import { attachStoryboardToChat } from "../../bridge/attach-storyboard-to-chat"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import {
  StoryboardProvider,
  aspectRatioToCss,
  collectSequenceShots,
  ensureStoryboardFrontMatter,
  findSceneIdOfShot,
  generateStoryboardId,
  getSceneSummaries,
  getShotData,
  getShotIds,
  getStoryboardSettings,
  insertShot,
  moveScene,
  moveShot,
  sceneAttachLabel,
  sceneToNode,
  settingsToNode,
  shotAttachLabel,
  storyboardEditorExtensions,
  updateShot,
  updateStoryboardSettings,
  DEFAULT_STORYBOARD_SETTINGS,
} from "../../extensions/storyboard"
import { EditorTopChrome } from "./editor-top-chrome"
import { MarkdownDiffChangesPanel } from "./markdown-diff-changes-panel"
import { MarkdownPendingChangesBar } from "./markdown-pending-changes-bar"
import { StoryboardScenePanel } from "./storyboard-scene-panel"
import { StoryboardSequenceDialog } from "./storyboard-sequence-dialog"
import { StoryboardSettingsSheet } from "./storyboard-settings-sheet"
import { StoryboardShotSheet } from "./storyboard-shot-sheet"
import { StoryboardToolbar } from "./storyboard-toolbar"
import "./storyboard.css"
import type { SettingsFormValues } from "./storyboard-settings-sheet"
import type { ShotFormValues } from "./storyboard-shot-sheet"
import type { DragEndEvent } from "@dnd-kit/core"
import type { EditorTab } from "../../types"
import type { Editor, JSONContent } from "@tiptap/react"

const editorExtensions = [
  StarterKit.configure({
    document: false,
    heading: false,
    horizontalRule: false,
    link: false,
  }),
  ...storyboardEditorExtensions,
  Placeholder.configure({
    // Descend into the scene node and show hints even when unfocused so the
    // empty title/description fields explain what to fill in.
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: ({ node }) => {
      switch (node.type.name) {
        case "sceneTitle":
          return "Name this scene…"
        case "sceneAction":
          return "Describe what happens in this scene…"
        case "sceneEnvironment":
          return "Location and time of day"
        case "sceneLighting":
          return "Lighting"
        default:
          return ""
      }
    },
  }),
  CharacterCount.configure({
    limit: MAX_CHARACTER_COUNT,
  }),
  Markdown.configure({
    markedOptions: {
      gfm: true,
    },
  }),
]

interface StoryboardEditorViewProps {
  tab: EditorTab
  initialContent?: string
}

type ShotSheetState =
  { mode: "edit"; shotId: string } | { mode: "create"; sceneId: string }

export function StoryboardEditorView({
  tab,
  initialContent,
}: StoryboardEditorViewProps) {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/editor",
  })
  const baseMarkdown = initialContent || ""
  const initialEditorContent = useMemo(
    () => toStoryboardContent(baseMarkdown),
    [baseMarkdown],
  )

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const appliedDiffRef = useRef(false)
  const isApplyingVisualDiffRef = useRef(false)
  const [shotSheet, setShotSheet] = useState<ShotSheetState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sequenceOpen, setSequenceOpen] = useState(false)
  const [, setTick] = useState(0)

  const autosave = useAutoSave({
    duration: 2000,
    projectId,
    fileId: tab.id,
    onSaveComplete: () => {
      appliedDiffRef.current = false
    },
  })

  const setEditor = useEditorInputBridge((state) => state.setEditor)
  const clearEditor = useEditorInputBridge((state) => state.clearEditor)

  const editor = useEditor({
    immediatelyRender: true,
    extensions: editorExtensions,
    content: initialEditorContent.content,
    contentType: initialEditorContent.contentType,
    editorProps: {
      attributes: {
        class: "tiptap-editor-content storyboard-tiptap focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (isApplyingVisualDiffRef.current) return
      autosave({
        content: updatedEditor.getMarkdown(),
        diffApplied: appliedDiffRef.current,
      })
      setTick((tick) => tick + 1)
    },
    onCreate: ({ editor: createdEditor }) => {
      setEditor(createdEditor)
    },
    onDestroy: () => {
      clearEditor(editor)
    },
  })

  const {
    pendingOperation,
    pendingPatch,
    changeHunks,
    changesOpen,
    setChangesOpen,
    handleAcceptChanges,
    handleRejectChanges,
  } = usePendingMarkdownChanges({
    editor,
    projectId,
    fileId: tab.id,
    baseMarkdown,
    autosave,
    setMarkdownContent: setStoryboardMarkdownContent,
    appliedDiffRef,
    isApplyingVisualDiffRef,
  })

  const openShotSheet = useCallback((shotId: string) => {
    setShotSheet({ mode: "edit", shotId })
  }, [])

  const openNewShotSheet = useCallback((sceneId: string) => {
    setShotSheet({ mode: "create", sceneId })
  }, [])

  const attachFile = useCallback(() => {
    attachStoryboardToChat({ file: { name: tab.name, path: tab.path } })
  }, [tab.name, tab.path])

  const attachScene = useCallback(
    (sceneNumber: number) => {
      attachStoryboardToChat({
        file: { name: tab.name, path: tab.path },
        extraText: sceneAttachLabel(sceneNumber),
      })
    },
    [tab.name, tab.path],
  )

  const attachShot = useCallback(
    (sceneNumber: number, shotNumber: number) => {
      attachStoryboardToChat({
        file: { name: tab.name, path: tab.path },
        extraText: shotAttachLabel(sceneNumber, shotNumber),
      })
    },
    [tab.name, tab.path],
  )

  const providerValue = useMemo(
    () => ({ openShotSheet, openNewShotSheet, attachScene, attachShot }),
    [openShotSheet, openNewShotSheet, attachScene, attachShot],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const scenes = getSceneSummaries(editor)
  const sceneIds = scenes.map((scene) => scene.id)
  const shotIds = getShotIds(editor)
  const sequenceShots = collectSequenceShots(editor)
  const worldSettings = getStoryboardSettings(editor)
  const aspectCss = aspectRatioToCss(worldSettings.aspectRatio)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as
        { type?: string; sceneId?: string; shotId?: string } | undefined
      const overData = over.data.current as
        { type?: string; sceneId?: string; shotId?: string } | undefined
      if (!activeData) return

      if (activeData.type === "scene-preview" && activeData.sceneId) {
        if (overData?.sceneId)
          moveScene(editor, activeData.sceneId, overData.sceneId)
        return
      }

      if (activeData.type === "scene" && activeData.sceneId) {
        if (overData?.sceneId)
          moveScene(editor, activeData.sceneId, overData.sceneId)
        return
      }

      if (activeData.type === "shot" && activeData.shotId) {
        if (overData?.type === "shot" && overData.shotId) {
          const toSceneId = findSceneIdOfShot(editor, overData.shotId)
          if (toSceneId)
            moveShot(editor, activeData.shotId, toSceneId, overData.shotId)
        } else if (overData?.type === "grid" && overData.sceneId) {
          moveShot(editor, activeData.shotId, overData.sceneId, null)
        }
      }
    },
    [editor],
  )

  const handleSelectScene = useCallback((sceneId: string) => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector<HTMLElement>(
      `[data-scene-id="${cssEscape(sceneId)}"]`,
    )
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleShotSubmit = useCallback(
    (values: ShotFormValues) => {
      if (!shotSheet) return
      // In "create" mode the shot is only inserted on save, so cancelling the
      // sheet leaves the scene untouched.
      const shotId =
        shotSheet.mode === "create"
          ? insertShot(editor, shotSheet.sceneId)
          : shotSheet.shotId
      if (shotId) {
        updateShot(editor, shotId, {
          image: values.image,
          action: values.action,
          narration: values.narration,
          dialogue: values.dialogue,
          camera: {
            angle: values.cameraAngle,
            movement: values.cameraMovement,
          },
        })
      }
    },
    [editor, shotSheet],
  )

  const handleSettingsSubmit = useCallback(
    (values: SettingsFormValues) => {
      updateStoryboardSettings(editor, values)
    },
    [editor],
  )

  useEffect(() => {
    // Ensure the panel/sortable lists react to programmatic content changes.
    const handler = () => setTick((tick) => tick + 1)
    editor.on("update", handler)
    return () => {
      editor.off("update", handler)
    }
  }, [editor])

  const activeShot =
    shotSheet?.mode === "edit" ? getShotData(editor, shotSheet.shotId) : null

  return (
    <StoryboardProvider value={providerValue}>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <EditorTopChrome editor={editor} tabId={tab.id} />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div
            className="storyboard-layout"
            style={{ "--storyboard-aspect": aspectCss } as CSSProperties}
          >
            <div
              ref={scrollRef}
              className="storyboard-editor-col scrollbar-hide"
            >
              <div className="storyboard-editor-inner">
                <SortableContext
                  items={sceneIds}
                  strategy={rectSortingStrategy}
                >
                  <SortableContext
                    items={shotIds}
                    strategy={rectSortingStrategy}
                  >
                    <EditorContent editor={editor} />
                  </SortableContext>
                </SortableContext>
              </div>
            </div>

            <StoryboardScenePanel
              scenes={scenes}
              onSelect={handleSelectScene}
            />
          </div>
        </DndContext>

        {pendingOperation ? (
          <MarkdownPendingChangesBar
            className="bottom-19"
            changesOpen={changesOpen}
            onToggleChanges={() => setChangesOpen((open) => !open)}
            onAccept={handleAcceptChanges}
            onReject={handleRejectChanges}
          />
        ) : null}

        <MarkdownDiffChangesPanel
          open={Boolean(pendingPatch) && changesOpen}
          onOpenChange={setChangesOpen}
          hunks={changeHunks}
        />

        <StoryboardToolbar
          hasShots={shotIds.length > 0}
          onViewSequence={() => setSequenceOpen(true)}
          onOpenWorld={() => setSettingsOpen(true)}
          onAttachContext={attachFile}
        />

        <StoryboardSequenceDialog
          open={sequenceOpen}
          onOpenChange={setSequenceOpen}
          shots={sequenceShots}
          aspectRatio={worldSettings.aspectRatio}
        />

        <StoryboardSettingsSheet
          open={settingsOpen}
          settings={worldSettings}
          onOpenChange={setSettingsOpen}
          onSubmit={handleSettingsSubmit}
        />

        <StoryboardShotSheet
          open={shotSheet !== null}
          shot={activeShot}
          onOpenChange={(open) => {
            if (!open) setShotSheet(null)
          }}
          onSubmit={handleShotSubmit}
        />
      </div>
    </StoryboardProvider>
  )
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && "escape" in CSS) return CSS.escape(value)
  return value.replace(/["\\]/g, "\\$&")
}

function setStoryboardMarkdownContent(editor: Editor, markdown: string) {
  const next = toStoryboardContent(markdown)
  editor.commands.setContent(
    next.content,
    next.contentType ? { contentType: next.contentType } : undefined,
  )
}

export function toStoryboardContent(markdown: string): {
  content: string | JSONContent
  contentType?: "markdown"
} {
  if (!markdown.trim()) {
    return {
      content: {
        type: "doc",
        content: [
          settingsToNode(DEFAULT_STORYBOARD_SETTINGS),
          sceneToNode({
            id: generateStoryboardId("scene"),
            title: "",
            description: "",
            environment: "",
            lighting: "",
            shots: [],
          }),
        ],
      },
    }
  }

  return {
    content: ensureStoryboardFrontMatter(markdown),
    contentType: "markdown",
  }
}
