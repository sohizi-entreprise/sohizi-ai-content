import { TokenizerInterface } from "./tokenizer";


function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(text: string): string[] {
  return text
    .split(/\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function splitOversizedUnit(tokenizer: TokenizerInterface, unit: string, maxTokens: number): Promise<string[]> {
  if (await tokenizer.tokenLength(unit) <= maxTokens) {
    return [unit];
  }

  const sentences = splitSentences(unit);
  if (sentences.length > 1) {
    return await packUnits(sentences, maxTokens, 0, tokenizer);
  }

  const words = splitWords(unit);
  if (words.length <= 1) {
    return [unit];
  }

  return await packUnits(words, maxTokens, 0, tokenizer, ' ');
}

async function buildOverlapTail(
  tokenizer: TokenizerInterface,
  chunkUnits: string[],
  maxOverlapTokens: number,
  joiner: string,
): Promise<string[]> {
  const tail: string[] = [];

  for (let i = chunkUnits.length - 1; i >= 0; i--) {
    const piece = chunkUnits[i];
    if (piece === undefined) break;

    const candidate = [piece, ...tail];
    const candidateText = candidate.join(joiner).trim();

    if ((await tokenizer.tokenLength(candidateText)) > maxOverlapTokens) {
      break;
    }

    tail.unshift(piece);
  }

  return tail;
}

async function packUnits(
  units: string[],
  targetTokens: number,
  overlapTokens: number,
  tokenizer: TokenizerInterface,
  joiner = '\n\n',
): Promise<string[]> {
  const chunks: string[] = [];
  let currentUnits: string[] = [];

  for (const unit of units) {
    const preparedUnits =
      (await tokenizer.tokenLength(unit)) > targetTokens
        ? await splitOversizedUnit(tokenizer, unit, targetTokens)
        : [unit];

    for (const piece of preparedUnits) {
      const candidateUnits = [...currentUnits, piece];
      const candidateText = candidateUnits.join(joiner).trim();

      if (currentUnits.length === 0 || (await tokenizer.tokenLength(candidateText)) <= targetTokens) {
        currentUnits = candidateUnits;
        continue;
      }

      const currentText = currentUnits.join(joiner).trim();
      if (currentText) {
        chunks.push(currentText);
      }

      const overlapTail =
        overlapTokens > 0
          ? await buildOverlapTail(tokenizer, currentUnits, overlapTokens, joiner)
          : [];

      currentUnits = overlapTail.length > 0 ? [...overlapTail, piece] : [piece];

      const resetText = currentUnits.join(joiner).trim();
      if ((await tokenizer.tokenLength(resetText)) > targetTokens) {
        chunks.push(piece);
        currentUnits = [];
      }
    }
  }

  const finalText = currentUnits.join(joiner).trim();
  if (finalText) {
    chunks.push(finalText);
  }

  return chunks;
}

export async function splitIntoChunks(
  text: string,
  tokenizer: TokenizerInterface,
  options: {
    targetTokens: number;
    overlapTokens: number;
  },
): Promise<string[]> {
  const target = options.targetTokens;
  const overlap = options.overlapTokens;

  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = splitParagraphs(normalized);
  if (paragraphs.length === 0) {
    return [];
  }

  return await packUnits(paragraphs, target, overlap, tokenizer);
}
