import type { FileNode, EditorTab, ChatMessage } from './types'

export const MOCK_FILE_TREE: FileNode[] = [
  {
    id: 'root-episodes',
    name: 'Episodes',
    children: [
      {
        id: 'ep-1',
        name: 'Episode 1 - Pilot',
        children: [
          { id: 'ep1-script', name: 'script.md' },
          { id: 'ep1-storyboard', name: 'storyboard.vid' },
          { id: 'ep1-notes', name: 'notes.txt' },
        ],
      },
      {
        id: 'ep-2',
        name: 'Episode 2 - The Chase',
        children: [
          { id: 'ep2-script', name: 'script.md' },
          { id: 'ep2-storyboard', name: 'storyboard.vid' },
        ],
      },
    ],
  },
  {
    id: 'root-scenes',
    name: 'Key Scenes',
    children: [
      { id: 'scene-opening', name: 'opening-sequence.vid' },
      { id: 'scene-climax', name: 'climax.vid' },
      { id: 'scene-finale', name: 'finale.vid' },
    ],
  },
  {
    id: 'root-art',
    name: 'Art',
    children: [
      {
        id: 'art-concepts',
        name: 'Concepts',
        children: [
          { id: 'art-char', name: 'characters.md' },
          { id: 'art-env', name: 'environments.md' },
        ],
      },
      {
        id: 'art-refs',
        name: 'References',
        children: [
          { id: 'art-mood', name: 'moodboard.md' },
        ],
      },
    ],
  },
  {
    id: 'root-assets',
    name: 'Assets',
    children: [
      { id: 'asset-audio', name: 'soundtrack.mp3' },
      { id: 'asset-sfx', name: 'sfx-library.txt' },
    ],
  },
  { id: 'root-readme', name: 'README.md' },
  { id: 'root-project', name: 'project.json' },
]

export const MOCK_INITIAL_TABS: EditorTab[] = [
  {
    id: 'ep1-script',
    name: 'script.md',
    extension: '.md',
    pane: 'left',
  },
  {
    id: 'ep1-storyboard',
    name: 'storyboard.vid',
    extension: '.vid',
    pane: 'left',
  },
]

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Generate a storyboard for the opening scene of Episode 1.',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content:
      'I\'ve analyzed the script and generated a 6-shot storyboard for the opening sequence. The scene establishes tone and atmosphere with a strong contrast between warm shelter light and cool street environment.',
    timestamp: '10:32 AM',
    reasoning:
      'Design System:\n- Vibrant cinematic primary colors\n- Modern shadows and animations\n- Custom button variants with hover effects\n- Smooth transitions and scaling animations\n\nComponents:\n- Scene cards with thumbnail previews\n- Timeline segments with drag handles\n- Audio waveform visualization\n- Shot-to-shot transition markers',
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'Can you adjust the lighting for shot 3? It feels too warm.',
    timestamp: '10:35 AM',
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content:
      'I\'ve adjusted the color temperature for shot 3, cooling it down by approximately 200K. The background now better matches the nighttime exterior mood while maintaining visibility on the subject.',
    timestamp: '10:35 AM',
  },
]

export const MOCK_SCENES = [
  {
    id: 'scene-1',
    number: 1,
    heading: '1. EXT. YARD - DAY',
    description:
      'Scene description here. A bustling cafe. JAMES, late 20s, sits alone...',
    location: '221B Baker Street, London',
    timeOfDay: 'Sunrise',
    time: '7:30 AM',
    shots: [
      {
        id: 'shot-1',
        number: 1,
        dialogue: 'Mark: "Here as in... this Coffee? Or here as in... life?"',
        audio: 'sound_fx.mp3',
      },
      {
        id: 'shot-2',
        number: 2,
        dialogue:
          'Character dialogue Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        audio: 'sound_fx.mp3',
      },
      {
        id: 'shot-3',
        number: 3,
        dialogue:
          'Character dialogue Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt.',
        audio: 'sound_fx.mp3',
      },
      {
        id: 'shot-4',
        number: 4,
        dialogue: 'Character dialogue...',
        audio: 'sound_fx.mp3',
      },
      {
        id: 'shot-5',
        number: 5,
        dialogue:
          'Character dialogue Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut.',
        audio: 'sound_fx.mp3',
      },
    ],
  },
  {
    id: 'scene-2',
    number: 2,
    heading: '2. INT. HOSPITAL - NIGHT',
    description:
      'Scene description Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
    location: 'City Hospital',
    timeOfDay: 'Midnight',
    time: '7:30 AM',
    shots: [
      {
        id: 'shot-6',
        number: 1,
        dialogue:
          'Character dialogue Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        audio: 'sound_fx.mp3',
      },
      {
        id: 'shot-7',
        number: 2,
        dialogue: 'Character dialogue...',
        audio: 'sound_fx.mp3',
      },
    ],
  },
]

export const MOCK_TIMELINE_TRACKS = [
  {
    id: 'track-video',
    label: 'Video',
    type: 'video' as const,
    clips: [
      { id: 'clip-v1', start: 0, end: 25, label: 'Shot 1', color: 'bg-primary/60' },
      { id: 'clip-v2', start: 25, end: 45, label: 'Shot 2', color: 'bg-primary/50' },
      { id: 'clip-v3', start: 45, end: 70, label: 'Shot 3', color: 'bg-primary/60' },
      { id: 'clip-v4', start: 70, end: 85, label: 'Shot 4', color: 'bg-primary/50' },
      { id: 'clip-v5', start: 85, end: 100, label: 'Shot 5', color: 'bg-primary/60' },
    ],
  },
  {
    id: 'track-text',
    label: 'Text',
    type: 'text' as const,
    clips: [
      { id: 'clip-t1', start: 0, end: 20, label: 'Title Card', color: 'bg-chart-2/60' },
      { id: 'clip-t2', start: 30, end: 50, label: 'Subtitle', color: 'bg-chart-2/50' },
      { id: 'clip-t3', start: 60, end: 80, label: 'Lower Third', color: 'bg-chart-2/60' },
    ],
  },
  {
    id: 'track-audio',
    label: 'Audio',
    type: 'audio' as const,
    clips: [
      { id: 'clip-a1', start: 0, end: 40, label: 'Ambient', color: 'bg-chart-3/60' },
      { id: 'clip-a2', start: 40, end: 75, label: 'Dialogue', color: 'bg-chart-3/50' },
      { id: 'clip-a3', start: 75, end: 100, label: 'Music', color: 'bg-chart-3/60' },
    ],
  },
]

export const MOCK_CAST = [
  { id: 'cast-1', name: 'Harvey Halvorson', checked: false },
  { id: 'cast-2', name: 'Katherine Schaefer', checked: false },
  { id: 'cast-3', name: 'Erin Zieme', checked: true },
  { id: 'cast-4', name: 'Olive Schwalter', checked: false },
  { id: 'cast-5', name: 'Faith Botsford', checked: false },
  { id: 'cast-6', name: 'Rita Greenfelder', checked: false },
]
