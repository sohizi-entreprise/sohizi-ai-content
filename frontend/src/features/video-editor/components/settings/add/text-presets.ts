import type { CSSProperties } from 'react'
import type { TextPresetStyle } from '../../../utils/library-dnd'

export type TextPreset = {
  id: string
  label: string
  style: TextPresetStyle
  /** Visual-only styling for the preset cell (may exceed persisted TextClip fields). */
  previewStyle?: CSSProperties
  previewClassName?: string
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'title',
    label: 'Title text',
    style: {
      text: 'Title text',
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fontSize: 72,
      color: '#ffffff',
    },
    previewStyle: { fontWeight: 700, fontSize: 13 },
  },
  {
    id: 'regular',
    label: 'Regular text',
    style: {
      text: 'Regular text',
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fontSize: 48,
      color: '#ffffff',
    },
    previewStyle: { fontWeight: 400, fontSize: 12 },
  },
  {
    id: 'handwrite',
    label: 'Hand Write',
    style: {
      text: 'Hand Write',
      fontFamily: 'Georgia',
      fontWeight: 'normal',
      fontSize: 56,
      color: '#ffffff',
    },
    previewStyle: { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13 },
  },
  {
    id: 'italic',
    label: 'Italic Text',
    style: {
      text: 'Italic Text',
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fontSize: 48,
      color: '#ffffff',
    },
    previewStyle: { fontStyle: 'italic', fontSize: 12 },
  },
  {
    id: 'underline',
    label: 'Underline',
    style: {
      text: 'Underline',
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fontSize: 48,
      color: '#ffffff',
    },
    previewStyle: { textDecoration: 'underline', fontSize: 12 },
  },
  {
    id: 'uppercase',
    label: 'UPPERCASE',
    style: {
      text: 'UPPERCASE',
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fontSize: 48,
      color: '#ffffff',
    },
    previewStyle: {
      textTransform: 'uppercase',
      fontWeight: 700,
      letterSpacing: '0.04em',
      fontSize: 11,
    },
  },
  {
    id: 'rounded',
    label: 'Rounded',
    style: {
      text: 'Rounded',
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fontSize: 48,
      color: '#ffffff',
    },
    previewClassName:
      'rounded-full bg-muted-foreground/25 px-2.5 py-0.5 text-[11px] font-semibold',
  },
  {
    id: 'black',
    label: 'BLACK',
    style: {
      text: 'BLACK',
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fontSize: 56,
      color: '#ffffff',
    },
    previewClassName:
      'rounded-md bg-black px-2 py-0.5 text-[11px] font-bold tracking-wide text-white',
  },
  {
    id: 'white',
    label: 'WHITE',
    style: {
      text: 'WHITE',
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fontSize: 56,
      color: '#111111',
    },
    previewClassName:
      'rounded-md bg-white px-2 py-0.5 text-[11px] font-bold tracking-wide text-black',
  },
  {
    id: 'classic',
    label: 'Classic',
    style: {
      text: 'Classic',
      fontFamily: 'Georgia',
      fontWeight: 'normal',
      fontSize: 56,
      color: '#ffffff',
    },
    previewStyle: { fontFamily: 'Georgia, serif', fontSize: 13 },
  },
  {
    id: 'meme',
    label: 'MEME TEXT',
    style: {
      text: 'MEME TEXT',
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontWeight: 'bold',
      fontSize: 64,
      color: '#ffffff',
    },
    previewStyle: {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontWeight: 700,
      textTransform: 'uppercase',
      fontSize: 11,
      letterSpacing: '0.02em',
    },
  },
  {
    id: 'spacing',
    label: 'Spacing',
    style: {
      text: 'S p a c i n g',
      fontFamily: 'Courier New',
      fontWeight: 'normal',
      fontSize: 48,
      color: '#ffffff',
    },
    previewStyle: {
      fontFamily: '"Courier New", monospace',
      letterSpacing: '0.28em',
      fontSize: 10,
    },
  },
  {
    id: 'manuscript',
    label: 'Manuscript',
    style: {
      text: 'Manuscript',
      fontFamily: 'Georgia',
      fontWeight: 'bold',
      fontSize: 56,
      color: '#ffffff',
    },
    previewStyle: {
      fontFamily: 'Georgia, serif',
      fontWeight: 700,
      fontStyle: 'italic',
      fontSize: 12,
    },
  },
  {
    id: 'strict',
    label: 'STRICT',
    style: {
      text: 'STRICT',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fontSize: 56,
      color: '#ffffff',
    },
    previewStyle: {
      fontFamily: 'Arial, sans-serif',
      fontWeight: 800,
      textTransform: 'uppercase',
      fontSize: 11,
      letterSpacing: '0.08em',
    },
  },
  {
    id: 'cheerful',
    label: 'Cheerful',
    style: {
      text: 'Cheerful',
      fontFamily: 'Georgia',
      fontWeight: 'normal',
      fontSize: 52,
      color: '#ffd666',
    },
    previewStyle: {
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      color: '#ffd666',
      fontSize: 13,
    },
  },
]
