import {
  isBooleanVariable,
  isColorVariable,
  isEnumVariable,
  isNumberVariable,
  isStringVariable,
} from "@sohizi/video-composition"
import { useVideoEditorStore } from "../../store/editor-store"
import type { HtmlClip } from "../../store/types"
import type { CompositionVariable } from "@sohizi/video-composition"

export const HtmlSettings: React.FC<{ clip: HtmlClip }> = ({ clip }) => {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div>
      {clip.variables.map((v) => (
        <label key={v.id}>
          {" "}
          {/* ← v.id */}
          {v.label}
          <VariableInput
            variable={v}
            value={clip.values[v.id] ?? v.default}
            onChange={(value) =>
              updateClip(clip.id, { values: { ...clip.values, [v.id]: value } })
            }
          />
        </label>
      ))}
    </div>
  )
}

const VariableInput: React.FC<{
  variable: CompositionVariable
  value: string | number | boolean
  onChange: (v: string | number | boolean) => void
}> = ({ variable: v, value, onChange }) => {
  if (isStringVariable(v))
    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  if (isColorVariable(v))
    return (
      <input
        type="color"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  if (isNumberVariable(v))
    return (
      <input
        type="range"
        min={v.min ?? 0}
        max={v.max ?? 100}
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    )
  if (isBooleanVariable(v))
    return (
      <input
        type="checkbox"
        checked={value as boolean}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  if (isEnumVariable(v))
    return (
      <select
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      >
        {v.options.map((o) => (
          <option
            key={o.value}
            value={o.value}
          >
            {o.label}
          </option>
        ))}
      </select>
    )
  return null
}
