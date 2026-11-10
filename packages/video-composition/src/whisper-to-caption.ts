import type { Caption } from "@remotion/captions"
import type { ServerCaption } from "./types"

export type WhisperCaptionsInput = {
  transcription: {
    words: Array<ServerCaption>
    text: string
  }
}

export type OpenAiToCaptionsOutput = {
  captions: Array<Caption>
}

const escapeRegex = (text: string) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const apostropheVariants = ["\u0027", "\u2018", "\u2019", "\u02bc", "\uff07"]
const apostropheVariantRegex = `[${apostropheVariants.map(escapeRegex).join("")}]`

const escapeWordForRegex = (text: string) => {
  return Array.from(text)
    .map((character) => {
      return apostropheVariants.includes(character)
        ? apostropheVariantRegex
        : escapeRegex(character)
    })
    .join("")
}

export const whisperToCaptions = ({
  transcription,
}: WhisperCaptionsInput): OpenAiToCaptionsOutput => {
  const captions: Array<Caption> = []

  if (transcription.words.length === 0) {
    return { captions }
  }

  let remainingText = transcription.text

  for (let i = 0; i < transcription.words.length; i++) {
    const word = transcription.words[i]
    // https://github.com/remotion-dev/remotion/issues/5031
    const wordText = i === 0 ? word.word.trimStart() : word.word

    const punctuation = `\\?,\\.\\%\\–\\!\\;\\:\\'\\"\\-\\_\\(\\)\\[\\]\\{\\}\\@\\#\\$\\^\\&\\*\\+\\=\\/\\|\\<\\>\\~\`\\u2018\\u2019\\u02bc\\uff07`
    const wordToMatch = wordText.replace(new RegExp(`^[${punctuation}]+`), "")
    const match = new RegExp(
      `^([\\s?${punctuation}]{0,4})${escapeWordForRegex(wordToMatch)}([${punctuation}]{0,3})?`,
    ).exec(remainingText)

    let foundText: string
    if (match) {
      foundText = match[0]
      remainingText = remainingText.slice(foundText.length)
    } else {
      foundText = i === 0 ? wordText.trim() : ` ${wordText.trim()}`
    }

    captions.push({
      confidence: null,
      endMs: word.end * 1000,
      startMs: word.start * 1000,
      text: foundText,
      timestampMs: ((word.start + word.end) / 2) * 1000,
    })
  }

  return { captions }
}
