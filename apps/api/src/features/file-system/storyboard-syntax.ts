const ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "4:5",
  "21:9",
  "2.39:1",
] as const

const FRONT_MATTER_KEYS = [
  "aspectRatio",
  "visualStyle",
  "colorPalette",
  "temporalContext",
] as const

const SCENE_KEYS = [
  "id",
  "title",
  "description",
  "environment",
  "lighting",
] as const

const SHOT_TYPES = [
  "Extreme Close-Up",
  "Close-Up",
  "Medium Close-Up",
  "Medium Shot",
  "Medium Long Shot",
  "Long Shot",
  "Wide Shot",
  "Extreme Wide Shot",
] as const

const SHOT_SCALAR_KEYS = [
  "id",
  "number",
  "shotType",
  "image",
  "action",
  "narration",
] as const
const SHOT_REQUIRED_KEYS = ["id", "number", "action"] as const

const SYNTAX_RELOAD =
  'Call fileSyntaxTool with fileType "storyboard" if you have not loaded the storyboard syntax yet, then rewrite the file to match it. Values may be empty, but the fences and required keys must be present.'

export type StoryboardSyntaxResult = {
  ok: boolean
  error?: string
}

type ProblemList = Array<string>

type ShotState = {
  seen: Set<string>
  mode: "scalar" | "dialogue" | "camera"
  pendingSpeakerLine: number | null
  seenCamera: Set<string>
}

/**
 * Checks that storyboard markdown uses the world-bible front matter and
 * `:::scene` / `:::shot` fences, and that the required keys are present.
 * Empty values are allowed.
 */
export function validateStoryboardSyntax(
  content: string,
): StoryboardSyntaxResult {
  const problems: ProblemList = []
  const lines = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")

  if (lines[0] !== "---") {
    problems.push(
      "Line 1: the file must open with a world-bible line that is exactly `---`.",
    )
    return fail(problems)
  }

  const nextIndex = readFrontMatter(lines, problems)
  readScenes(lines, nextIndex, problems)

  if (problems.length === 0) return { ok: true }
  return fail(problems)
}

function fail(problems: ProblemList): StoryboardSyntaxResult {
  const shown = problems.slice(0, 8)
  const rest = problems.length - shown.length
  const lines = [
    "Storyboard syntax is invalid:",
    ...shown.map((problem) => `- ${problem}`),
  ]
  if (rest > 0) {
    lines.push(`- ${rest} more syntax problem${rest === 1 ? "" : "s"}.`)
  }
  lines.push(SYNTAX_RELOAD)
  return { ok: false, error: lines.join("\n") }
}

function readFrontMatter(lines: Array<string>, problems: ProblemList): number {
  const seen = new Set<string>()
  let index = 1
  let closed = false

  while (index < lines.length) {
    const line = lines[index]
    const lineNo = index + 1

    if (line === "---") {
      closed = true
      index += 1
      break
    }

    if (line.startsWith(":::")) {
      problems.push(
        `Line ${lineNo}: close the world bible with a line that is exactly \`---\` before \`${line.trim()}\`.`,
      )
      break
    }

    if (isBlank(line)) {
      index += 1
      continue
    }

    if (/^\s/.test(line)) {
      problems.push(
        `Line ${lineNo}: world-bible keys start at column 0. Only color palette items are indented.`,
      )
      index += 1
      continue
    }

    if (line === "colorPalette:") {
      noteKey(seen, "colorPalette", lineNo, problems)
      index += 1
      while (index < lines.length && isPaletteItem(lines[index])) {
        validatePaletteItem(lines[index], index + 1, problems)
        index += 1
      }
      continue
    }

    if (line.startsWith("colorPalette:")) {
      noteKey(seen, "colorPalette", lineNo, problems)
      problems.push(
        `Line ${lineNo}: \`colorPalette\` must be alone on its line. Add indented \`- "#rrggbb"\` items below it, or leave it with no items.`,
      )
      index += 1
      continue
    }

    const match = line.match(/^([A-Za-z_]+):(.*)$/)
    if (!match) {
      problems.push(
        "Line " +
          lineNo +
          ": expected a world-bible key: `aspectRatio`, `visualStyle`, `colorPalette`, or `temporalContext`.",
      )
      index += 1
      continue
    }

    const key = match[1]
    if (
      key !== "aspectRatio" &&
      key !== "visualStyle" &&
      key !== "temporalContext"
    ) {
      problems.push(`Line ${lineNo}: unknown world-bible key \`${key}\`.`)
      index += 1
      continue
    }

    noteKey(seen, key, lineNo, problems)
    validateFrontScalar(key, match[2], lineNo, problems)
    index += 1
  }

  if (!closed) {
    problems.push("The world bible is missing its closing `---` line.")
  }

  for (const key of FRONT_MATTER_KEYS) {
    if (!seen.has(key)) {
      problems.push(
        `World bible is missing \`${key}\`. The value may be empty, but the key must be present.`,
      )
    }
  }

  return index
}

function readScenes(
  lines: Array<string>,
  start: number,
  problems: ProblemList,
) {
  let index = start
  let sceneCount = 0

  while (index < lines.length) {
    if (isBlank(lines[index])) {
      index += 1
      continue
    }
    if (lines[index] !== ":::scene") {
      problems.push(
        `Line ${index + 1}: expected a \`:::scene\` block. Headings, paragraphs, and other markdown are not valid storyboard syntax.`,
      )
      index += 1
      continue
    }
    sceneCount += 1
    index = readScene(lines, index, sceneCount, problems)
  }

  if (sceneCount === 0) {
    problems.push(
      "The file must contain at least one `:::scene` block. A scene may contain zero shots.",
    )
  }
}

function readScene(
  lines: Array<string>,
  start: number,
  sceneNumber: number,
  problems: ProblemList,
): number {
  const seen = new Set<string>()
  const openLine = start + 1
  let index = start + 1
  let shotsStarted = false
  let shotNumber = 0
  let closed = false

  while (index < lines.length) {
    const line = lines[index]
    const lineNo = index + 1

    if (line === ":::") {
      closed = true
      index += 1
      break
    }

    if (line === ":::shot") {
      shotsStarted = true
      shotNumber += 1
      index = readShot(lines, index, sceneNumber, shotNumber, problems)
      continue
    }

    if (line === ":::scene") {
      problems.push(
        `Line ${lineNo}: close scene ${sceneNumber} with \`:::\` before opening another \`:::scene\`.`,
      )
      break
    }

    if (line.startsWith(":::")) {
      problems.push(
        `Line ${lineNo}: open a shot with a line that is exactly \`:::shot\`, or close the scene with \`:::\`.`,
      )
      index += 1
      continue
    }

    parseSceneField(line, lineNo, seen, shotsStarted, problems)
    index += 1
  }

  if (!closed) {
    problems.push(
      `Scene ${sceneNumber} (line ${openLine}): missing the closing \`:::\`.`,
    )
  }

  for (const key of SCENE_KEYS) {
    if (!seen.has(key)) {
      problems.push(
        `Scene ${sceneNumber} (line ${openLine}): missing \`${key}\`. The value may be empty, but the key must be present.`,
      )
    }
  }

  return index
}

function readShot(
  lines: Array<string>,
  start: number,
  sceneNumber: number,
  shotNumber: number,
  problems: ProblemList,
): number {
  const state: ShotState = {
    seen: new Set<string>(),
    mode: "scalar",
    pendingSpeakerLine: null,
    seenCamera: new Set<string>(),
  }
  const openLine = start + 1
  const label = `Scene ${sceneNumber}, shot ${shotNumber}`
  let index = start + 1
  let closed = false

  while (index < lines.length) {
    const line = lines[index]
    const lineNo = index + 1

    if (line === ":::") {
      closed = true
      index += 1
      break
    }

    if (line === ":::shot" || line === ":::scene") {
      problems.push(
        `Line ${lineNo}: close the current shot with \`:::\` before opening another block.`,
      )
      break
    }

    if (line.startsWith(":::")) {
      problems.push(
        `Line ${lineNo}: close the shot with a line that is exactly \`:::\`.`,
      )
      index += 1
      continue
    }

    parseShotLine(line, lineNo, state, problems)
    index += 1
  }

  finishDialogue(state, problems)

  if (!closed) {
    problems.push(`${label} (line ${openLine}): missing the closing \`:::\`.`)
  }

  for (const key of SHOT_REQUIRED_KEYS) {
    if (!state.seen.has(key)) {
      problems.push(
        `${label} (line ${openLine}): missing \`${key}\`. The value may be empty, but the key must be present.`,
      )
    }
  }

  return index
}

function parseSceneField(
  line: string,
  lineNo: number,
  seen: Set<string>,
  shotsStarted: boolean,
  problems: ProblemList,
) {
  if (isBlank(line)) return

  if (/^\s/.test(line)) {
    problems.push(
      `Line ${lineNo}: scene keys start at column 0, and each value stays on that same line.`,
    )
    return
  }

  const match = line.match(/^([A-Za-z_]+):(.*)$/)
  if (!match) {
    problems.push(
      `Line ${lineNo}: expected a scene key (\`id\`, \`title\`, \`description\`, \`environment\`, \`lighting\`) or a \`:::shot\` block.`,
    )
    return
  }

  const key = match[1]
  if (!isSceneKey(key)) {
    problems.push(`Line ${lineNo}: unknown scene key \`${key}\`.`)
    return
  }

  if (shotsStarted) {
    problems.push(
      `Line ${lineNo}: \`${key}\` must come before the shots in the scene.`,
    )
    return
  }

  noteKey(seen, key, lineNo, problems)
}

function parseShotLine(
  line: string,
  lineNo: number,
  state: ShotState,
  problems: ProblemList,
) {
  if (isBlank(line)) return

  if (/^\s/.test(line)) {
    parseIndentedShotLine(line, lineNo, state, problems)
    return
  }

  if (state.mode === "dialogue") finishDialogue(state, problems)
  state.mode = "scalar"

  if (line === "dialogue:") {
    noteKey(state.seen, "dialogue", lineNo, problems)
    state.mode = "dialogue"
    return
  }

  if (line === "camera:") {
    noteKey(state.seen, "camera", lineNo, problems)
    state.mode = "camera"
    return
  }

  if (line.startsWith("dialogue:") || line.startsWith("camera:")) {
    const key = line.startsWith("dialogue:") ? "dialogue" : "camera"
    problems.push(
      `Line ${lineNo}: \`${key}\` must be alone on its line, with its fields indented below.`,
    )
    return
  }

  const match = line.match(/^([A-Za-z_]+):(.*)$/)
  if (!match) {
    problems.push(
      `Line ${lineNo}: expected a shot key (\`id\`, \`number\`, \`action\`, and optional \`shotType\`, \`image\`, \`dialogue\`, \`narration\`, \`camera\`).`,
    )
    return
  }

  const key = match[1]
  if (key === "angle" || key === "movement") {
    problems.push(`Line ${lineNo}: indent \`${key}\` under a \`camera:\` line.`)
    return
  }

  if (!isShotScalarKey(key)) {
    problems.push(`Line ${lineNo}: unknown shot key \`${key}\`.`)
    return
  }

  noteKey(state.seen, key, lineNo, problems)
  if (key === "number") validateShotNumber(match[2], lineNo, problems)
  if (key === "shotType") validateShotType(match[2], lineNo, problems)
}

function parseIndentedShotLine(
  line: string,
  lineNo: number,
  state: ShotState,
  problems: ProblemList,
) {
  if (state.mode === "dialogue") {
    if (/^\s+-\s+speaker:[ \t]?/.test(line)) {
      if (state.pendingSpeakerLine != null) {
        problems.push(
          `Line ${state.pendingSpeakerLine}: dialogue entry is missing its indented \`text\` line.`,
        )
      }
      state.pendingSpeakerLine = lineNo
      return
    }

    if (/^\s+text:[ \t]?/.test(line)) {
      if (state.pendingSpeakerLine == null) {
        problems.push(
          `Line ${lineNo}: \`text\` must be indented under a \`- speaker:\` line.`,
        )
        return
      }
      state.pendingSpeakerLine = null
      return
    }

    problems.push(
      `Line ${lineNo}: dialogue lines must be an indented \`- speaker:\` line followed by an indented \`text:\` line.`,
    )
    return
  }

  if (state.mode === "camera") {
    const match = line.match(/^\s+(angle|movement):[ \t]?/)
    if (!match) {
      problems.push(
        `Line ${lineNo}: camera fields must be indented \`angle\` or \`movement\` lines under \`camera:\`.`,
      )
      return
    }
    noteKey(state.seenCamera, match[1], lineNo, problems)
    return
  }

  problems.push(
    `Line ${lineNo}: values stay on the same line as their key. Indent only \`dialogue\` and \`camera\` fields.`,
  )
}

function validateFrontScalar(
  key: "aspectRatio" | "visualStyle" | "temporalContext",
  raw: string,
  lineNo: number,
  problems: ProblemList,
) {
  const trimmed = raw.trim()
  if (
    trimmed === "|" ||
    trimmed === ">" ||
    trimmed.startsWith("|") ||
    trimmed.startsWith(">")
  ) {
    problems.push(
      `Line ${lineNo}: keep \`${key}\` on one line. Do not use a YAML block scalar.`,
    )
    return
  }

  const parsed = unquote(trimmed)
  if (parsed.text !== "" && !parsed.quoted) {
    problems.push(
      `Line ${lineNo}: quote the \`${key}\` value, for example \`${key}: "..."\`.`,
    )
    return
  }

  if (
    key === "aspectRatio" &&
    parsed.text !== "" &&
    !(ASPECT_RATIOS as readonly string[]).includes(parsed.text)
  ) {
    problems.push(
      `Line ${lineNo}: \`aspectRatio\` must be one of ${ASPECT_RATIOS.join(", ")}, or empty.`,
    )
  }
}

function validatePaletteItem(
  line: string,
  lineNo: number,
  problems: ProblemList,
) {
  const match = line.match(/^(?: {2,}|\t+)-\s+(.*)$/)
  const value = match?.[1]?.trim() ?? ""
  if (!/^(['"])#[0-9a-fA-F]{6}\1$/.test(value)) {
    problems.push(
      `Line ${lineNo}: color palette items must be an indented dash and a quoted hex color, for example \`- "#1a1a1a"\`.`,
    )
  }
}

function validateShotNumber(
  raw: string,
  lineNo: number,
  problems: ProblemList,
) {
  const text = raw.trim()
  if (text === "") return
  if (!/^[1-9]\d*$/.test(text)) {
    problems.push(
      `Line ${lineNo}: \`number\` must be a 1-based integer, or empty.`,
    )
  }
}

function validateShotType(raw: string, lineNo: number, problems: ProblemList) {
  const parsed = unquote(raw.trim())
  if (parsed.text === "") return
  if (!(SHOT_TYPES as readonly string[]).includes(parsed.text)) {
    problems.push(
      `Line ${lineNo}: \`shotType\` must be one of ${SHOT_TYPES.join(", ")}, or empty.`,
    )
  }
}

function finishDialogue(state: ShotState, problems: ProblemList) {
  if (state.pendingSpeakerLine == null) return
  problems.push(
    `Line ${state.pendingSpeakerLine}: dialogue entry is missing its indented \`text\` line.`,
  )
  state.pendingSpeakerLine = null
}

function noteKey(
  seen: Set<string>,
  key: string,
  lineNo: number,
  problems: ProblemList,
) {
  if (seen.has(key)) {
    problems.push(`Line ${lineNo}: duplicate key \`${key}\`.`)
    return
  }
  seen.add(key)
}

function unquote(value: string): { quoted: boolean; text: string } {
  if (value === "") return { quoted: false, text: "" }
  const match = value.match(/^(['"])([\s\S]*)\1$/)
  if (!match) return { quoted: false, text: value }
  return { quoted: true, text: match[2] }
}

function isBlank(line: string): boolean {
  return line.trim() === ""
}

function isPaletteItem(line: string): boolean {
  return /^(?: {2,}|\t+)-\s+/.test(line)
}

function isSceneKey(key: string): key is (typeof SCENE_KEYS)[number] {
  return (SCENE_KEYS as readonly string[]).includes(key)
}

function isShotScalarKey(
  key: string,
): key is (typeof SHOT_SCALAR_KEYS)[number] {
  return (SHOT_SCALAR_KEYS as readonly string[]).includes(key)
}
