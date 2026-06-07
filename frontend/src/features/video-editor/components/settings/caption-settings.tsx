import { CaptionClip } from "../../store/types";
import { useVideoEditorStore } from "../../store/editor-store";


export function CaptionSettings({ clip }: { clip: CaptionClip }) {
    const updateClip = useVideoEditorStore((s) => s.updateClip)
    return (
        <div>
            <h1>Caption Settings</h1>
        </div>
    )
}