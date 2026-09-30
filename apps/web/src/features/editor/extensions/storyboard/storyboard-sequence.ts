import { nodeToShot } from "./storyboard-nodes"
import type { ShotData, ShotDialogueLine } from "./storyboard-markdown"
import type { Editor, JSONContent } from "@tiptap/core"
import type { ImageClip, TextClip, Track } from "@sohizi/video-composition"

export const SEQUENCE_FPS = 30
export const SEQUENCE_SHOT_SECONDS = 3
export const SEQUENCE_FRAMES_PER_SHOT = SEQUENCE_FPS * SEQUENCE_SHOT_SECONDS

/** 1x1 transparent GIF so shots without art still occupy a black frame. */
const EMPTY_SHOT_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="

export type SequenceShot = {
  sceneNumber: number
  shotNumber: number
  image: string
  subtitle: string
}

export type StoryboardSequenceComposition = {
  tracks: Array<Track>
  durationInFrames: number
  fps: number
}

export function sceneAttachLabel(sceneNumber: number): string {
  return `scene ${sceneNumber}`
}

export function shotAttachLabel(
  sceneNumber: number,
  shotNumber: number,
): string {
  return `scene ${sceneNumber} - shot ${shotNumber}`
}

/** Dialogue first, then narration, then action. */
export function formatShotSubtitle(shot: ShotData): string {
  const dialogue = formatDialogue(shot.dialogue)
  if (dialogue) return dialogue
  if (shot.narration?.trim()) return shot.narration.trim()
  return shot.action?.trim() ?? ""
}

export function collectSequenceShots(
  editor: Editor | null,
): Array<SequenceShot> {
  if (!editor) return []
  return collectSequenceShotsFromJson(editor.getJSON())
}

export function collectSequenceShotsFromJson(
  json: JSONContent,
): Array<SequenceShot> {
  const shots: Array<SequenceShot> = []
  let sceneNumber = 0

  for (const scene of json.content ?? []) {
    if (scene.type !== "storyboardScene") continue
    sceneNumber += 1
    const grid = scene.content?.find((child) => child.type === "shotGrid")
    let shotNumber = 0
    for (const node of grid?.content ?? []) {
      if (node.type !== "shot") continue
      shotNumber += 1
      const shot = nodeToShot(node)
      shots.push({
        sceneNumber,
        shotNumber,
        image: shot.image ?? "",
        subtitle: formatShotSubtitle(shot),
      })
    }
  }

  return shots
}

export function getShotPosition(
  editor: Editor | null,
  shotId: string,
): { sceneNumber: number; shotNumber: number } | null {
  if (!editor) return null
  let sceneNumber = 0
  for (const scene of editor.getJSON().content) {
    if (scene.type !== "storyboardScene") continue
    sceneNumber += 1
    const grid = scene.content?.find((child) => child.type === "shotGrid")
    let shotNumber = 0
    for (const shot of grid?.content ?? []) {
      if (shot.type !== "shot") continue
      shotNumber += 1
      if (shot.attrs?.shotId === shotId) {
        return { sceneNumber, shotNumber }
      }
    }
  }
  return null
}

export function shotIndexFromFrame(frame: number, shotCount: number): number {
  if (shotCount <= 0) return 0
  return Math.min(
    shotCount - 1,
    Math.max(0, Math.floor(frame / SEQUENCE_FRAMES_PER_SHOT)),
  )
}

export function buildStoryboardSequence(
  shots: Array<SequenceShot>,
): StoryboardSequenceComposition {
  const imageTrackId = "storyboard-images"
  const textTrackId = "storyboard-subtitles"
  const imageClips: Array<ImageClip> = []
  const textClips: Array<TextClip> = []

  shots.forEach((shot, index) => {
    const startFrame = index * SEQUENCE_FRAMES_PER_SHOT
    const endFrame = startFrame + SEQUENCE_FRAMES_PER_SHOT
    imageClips.push({
      id: `storyboard-image-${index}`,
      trackId: imageTrackId,
      type: "image",
      startFrame,
      endFrame,
      sourceStartFrame: 0,
      sourceDurationInFrames: SEQUENCE_FRAMES_PER_SHOT,
      url: shot.image || EMPTY_SHOT_IMAGE,
      fileName: `scene-${shot.sceneNumber}-shot-${shot.shotNumber}`,
      opacity: 1,
      borderRadius: 0,
      blur: 0,
      brightness: 100,
      xRatio: 0.5,
      yRatio: 0.5,
      widthRatio: 1,
      heightRatio: 1,
    })
    if (!shot.subtitle) return
    textClips.push({
      id: `storyboard-text-${index}`,
      trackId: textTrackId,
      type: "text",
      startFrame,
      endFrame,
      sourceStartFrame: 0,
      sourceDurationInFrames: SEQUENCE_FRAMES_PER_SHOT,
      text: shot.subtitle,
      fontSize: 64,
      color: "#ffffff",
      fontFamily: "Inter",
      fontWeight: "bold",
      align: "center",
      opacity: 1,
      xRatio: 0.5,
      yRatio: 0.85,
      widthRatio: 0.7,
      heightRatio: 0.18,
    })
  })

  return {
    fps: SEQUENCE_FPS,
    durationInFrames: Math.max(1, shots.length * SEQUENCE_FRAMES_PER_SHOT),
    tracks: [
      {
        id: textTrackId,
        type: "text",
        name: "Subtitles",
        muted: false,
        hidden: false,
        clips: textClips,
      },
      {
        id: imageTrackId,
        type: "image",
        name: "Shots",
        muted: false,
        hidden: false,
        clips: imageClips,
      },
    ],
  }
}

function formatDialogue(dialogue: Array<ShotDialogueLine> | undefined): string {
  if (!dialogue?.length) return ""
  return dialogue
    .map((line) => {
      const text = line.text.trim()
      if (!text) return ""
      const speaker = line.speaker.trim()
      return speaker ? `${speaker}: ${text}` : text
    })
    .filter(Boolean)
    .join("\n")
}
