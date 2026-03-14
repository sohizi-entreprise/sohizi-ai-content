import { useEffect, useRef, useCallback, useMemo } from "react";
import { Editor, type JSONContent } from "@tiptap/react";
import { EventMap } from "@/features/text-editor/type";
import { findContextAnchorById } from "@/features/text-editor/extensions/context-anchor";

/** Every command the AI can dispatch to the editor */
export type EditorCommand =
  | { type: "INSERT_TEXT"; from: number; content: string | JSONContent; }
  | { type: "REPLACE_TEXT"; from: number; to: number; content: string | JSONContent }
  | { type: "DELETE_RANGE"; from: number; to: number }
  | { type: "FIND_AND_REPLACE"; find: string; replace: string; all?: boolean }
  | { type: "CLEAR_CONTEXT_ANCHOR"; blockId?: string }

/** State snapshot the AI can read */
export interface EditorState {
  /** Current content as Tiptap JSON */
  json: object;
  /** Current selection range, null if collapsed */
  selection: { from: number; to: number } | null;
  /** Text within the current selection */
  selectedText: string;
}

/** Events the editor emits toward the AI */
export type EditorEvent =
  | { type: "CONTENT_CHANGED"; state: EditorState }
  | { type: "SELECTION_CHANGED"; state: EditorState }
  | { type: "FOCUS_CHANGED"; isFocused: boolean }
  | { type: "COMMAND_EXECUTED"; command: EditorCommand; success: boolean }
  | { type: "ERROR"; message: string; command?: EditorCommand }
  | { type: "CONTEXT_SELECTED"; data: {id: string, display: string, from: number, to: number}};

export type EditorEventHandler = (event: EditorEvent) => void;

/** The public surface the AI agent consumes */
export interface EditorAIBridge {
  execute: (command: EditorCommand) => Promise<boolean>;
  getState: () => EditorState | null;
  subscribe: (handler: EditorEventHandler) => () => void;
  getContextAnchorPosition: (blockId: string) => { from: number; to: number; text: string } | null;
  isReady: boolean;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildState(editor: Editor): EditorState {
  const { from, to, empty } = editor.state.selection;
  const json = editor.getJSON();

  const selectedText = empty
    ? ""
    : editor.state.doc.textBetween(from, to, " ");

  return {
    json,
    selection: empty ? null : { from, to },
    selectedText,
  };
}

function findAndReplace(
  editor: Editor,
  find: string,
  replace: string,
  replaceAll: boolean
): boolean {
  const { doc } = editor.state;
  const positions: { from: number; to: number }[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let idx = node.text.indexOf(find);
    while (idx !== -1) {
      positions.push({ from: pos + idx, to: pos + idx + find.length });
      if (!replaceAll) return false; // stop after first
      idx = node.text.indexOf(find, idx + 1);
    }
  });

  if (!positions.length) return false;

  const targets = replaceAll ? positions : [positions[0]];
  // Apply in reverse to keep positions stable
  targets.reverse().forEach(({ from, to }) => {
    editor.chain().deleteRange({ from, to }).insertContentAt(from, replace).run();
  });

  return true;
}


// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEditorAIBridge(editor: Editor | null): EditorAIBridge {
  const handlersRef = useRef<Set<EditorEventHandler>>(new Set());
  const editorRef = useRef<Editor | null>(null);

  // Keep editorRef current
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // ── Emit helpers ────────────────────────────────────────────────────────────
  const emit = useCallback((event: EditorEvent) => {
    handlersRef.current.forEach((h) => {
      try {
        h(event);
      } catch (err) {
        console.error("[EditorAIBridge] Handler threw:", err);
      }
    });
  }, []);

  // ── Wire editor events → bridge events ─────────────────────────────────────
  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      const s = buildState(editor);
      emit({ type: "CONTENT_CHANGED", state: s });
    };

    const onSelectionUpdate = () => {
      const s = buildState(editor);
      emit({ type: "SELECTION_CHANGED", state: s });
    };

    const onFocus = () => {
      emit({ type: "FOCUS_CHANGED", isFocused: true });
    };

    const onBlur = () => {
      emit({ type: "FOCUS_CHANGED", isFocused: false });
    };

    const onContextSelected = (data: EventMap["contextSelected"]) => {
      emit({ type: "CONTEXT_SELECTED", data });
    };

    const eventBus = editor.storage.editorEventBus?.bus

    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onSelectionUpdate);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    eventBus?.on("contextSelected", onContextSelected);

    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onSelectionUpdate);
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
      eventBus?.clear()
    };
  }, [editor, emit]);

  // ── execute ─────────────────────────────────────────────────────────────────
  const execute = useCallback(
    async (command: EditorCommand): Promise<boolean> => {
      const ed = editorRef.current;
      if (!ed) {
        emit({
          type: "ERROR",
          message: "Editor is not mounted",
          command,
        });
        return false;
      }

      let success = false;

      try {
        switch (command.type) {
          case "INSERT_TEXT": {
            const chain = ed.chain().focus();
            if (command.from != -1) {
              chain.insertContentAt(command.from, command.content);
            } else {
              chain.insertContent(command.content);
            }
            success = chain.run();
            // TODO: increase the diff store
            break;
          }

          case "REPLACE_TEXT": {
            success = ed
              .chain()
              .focus()
              .deleteRange({ from: command.from, to: command.to })
              .insertContentAt(command.from, command.content)
              .run();
            break;
          }

          case "DELETE_RANGE": {
            success = ed
              .chain()
              .focus()
              .deleteRange({ from: command.from, to: command.to })
              .run();
            break;
          }

        //   case "SET_NODE": {
        //     success = ed
        //       .chain()
        //       .focus()
        //       .setNode(command.node, command.attrs)
        //       .run();
        //     break;
        //   }

          case "FIND_AND_REPLACE": {
            success = findAndReplace(
              ed,
              command.find,
              command.replace,
              command.all ?? false
            );
            break;
          }
          case "CLEAR_CONTEXT_ANCHOR": {
            // Don't call focus() — caller may be the chat input; keep focus where it is
            if (!command.blockId) {
              success = ed.chain().unsetAllContextAnchors().run();
            } else {
              success = ed.chain().unsetContextAnchor(command.blockId).run();
            }
            break;
          }

          default: {
            const _exhaustive: never = command;
            emit({
              type: "ERROR",
              message: `Unknown command type: ${(_exhaustive as EditorCommand).type}`,
              command,
            });
            return false;
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error during command";
        emit({ type: "ERROR", message, command });
        return false;
      }

      emit({ type: "COMMAND_EXECUTED", command, success });
      return success;
    },
    [emit]
  );

  // ── getState ────────────────────────────────────────────────────────────────
  const getState = useCallback((): EditorState | null => {
    if (!editorRef.current) return null;
    return buildState(editorRef.current);
  }, []);

  // ── subscribe ───────────────────────────────────────────────────────────────
  const subscribe = useCallback((handler: EditorEventHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const getContextAnchorPosition = useCallback((blockId: string) => {
    if (!editorRef.current) return null;
    const position = findContextAnchorById(editorRef.current, blockId);
    if (!position) return null;
    return position;
  }, []);

  const isReady = editor !== null;

  return useMemo<EditorAIBridge>(
    () => ({
      execute,
      getState,
      subscribe,
      getContextAnchorPosition,
      isReady,
    }),
    [execute, getState, subscribe, isReady]
  );
}