// MP3 Frame Trimmer Worker for Cloudflare Workers + R2
//
// Example request:
//   /trim?key=audio/example.mp3&offset=30&duration=15
//
// Returns:
//   audio/mpeg
  
type MpegVersion = 1 | 2 | 2.5;
  
interface Mp3Frame {
    version: MpegVersion;
    bitrate: number;
    sampleRate: number;
    frameSize: number;
    duration: number;
}
  
const BITRATE_TABLE: Record<string, number[]> = {
    // MPEG-1 Layer III
    "1_3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  
    // MPEG-2 Layer III
    "2_3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  
    // MPEG-2.5 Layer III
    "2.5_3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  };
  
const SAMPLE_RATE_TABLE: Record<string, number[]> = {
    "1": [44100, 48000, 32000, 0],
    "2": [22050, 24000, 16000, 0],
    "2.5": [11025, 12000, 8000, 0],
  };
  
export function parseFrameHeader(
    b0: number,
    b1: number,
    b2: number,
): Mp3Frame | null {
    // 11-bit frame sync: 11111111 111xxxxx
    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  
    const versionBits = (b1 >> 3) & 0x03;

    const versionMap: Record<number, MpegVersion> = {
        3: 1,
        2: 2,
        0: 2.5,
    };

    const version = versionMap[versionBits];
    if (!version) return null;

    const layerBits = (b1 >> 1) & 0x03;
  
    // Layer bits:
    // 01 = Layer III
    // 10 = Layer II
    // 11 = Layer I
    const layerMap: Record<number, number> = {
        3: 1,
        2: 2,
        1: 3,
    };

    const layer = layerMap[layerBits];
    
    // This worker intentionally supports only MP3 / Layer III.
    if (layer !== 3) return null;
  
    const bitrateIndex = (b2 >> 4) & 0x0f;
    if (bitrateIndex === 0 || bitrateIndex === 15) return null;
  
    const sampleRateIndex = (b2 >> 2) & 0x03;
    if (sampleRateIndex === 3) return null;
  
    const padding = (b2 >> 1) & 0x01;
  
    const bitrate = BITRATE_TABLE[`${version}_${layer}`]?.[bitrateIndex];
    const sampleRate = SAMPLE_RATE_TABLE[String(version)]?.[sampleRateIndex];
  
    if (!bitrate || !sampleRate) return null;
  
    const frameSize =
      version === 1
        ? Math.floor((144 * bitrate * 1000) / sampleRate) + padding
        : Math.floor((72 * bitrate * 1000) / sampleRate) + padding;
  
    if (frameSize <= 4) return null;
  
    const samplesPerFrame = version === 1 ? 1152 : 576;
    const duration = samplesPerFrame / sampleRate;
  
    return {
      version,
      bitrate,
      sampleRate,
      frameSize,
      duration,
    };
}
  
export function skipID3v2Tag(bytes: Uint8Array): number {
    if (bytes.length < 10) return 0;
  
    // "ID3"
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
      return 0;
    }
  
    const flags = bytes[5];
  
    // ID3v2 uses a synchsafe 28-bit integer.
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
  
    // ID3v2.4 footer flag.
    const hasFooter = (flags & 0x10) !== 0;
  
    return 10 + size + (hasFooter ? 10 : 0);
}
  
export function getAudioEnd(bytes: Uint8Array): number {
    // ID3v1 tag is exactly 128 bytes at the end and starts with "TAG".
    if (bytes.length >= 128) {
      const tagStart = bytes.length - 128;
  
      if (
        bytes[tagStart] === 0x54 && // T
        bytes[tagStart + 1] === 0x41 && // A
        bytes[tagStart + 2] === 0x47 // G
      ) {
        return tagStart;
      }
    }
  
    return bytes.length;
}
  
export function looksLikeNextFrame(
    bytes: Uint8Array,
    pos: number,
    frameSize: number,
    audioEnd: number,
  ): boolean {
    const next = pos + frameSize;
  
    // End of audio data. Good enough.
    if (next + 4 > audioEnd) {
      return true;
    }
  
    return parseFrameHeader(bytes[next], bytes[next + 1], bytes[next + 2]) !== null;
}
  
export function parsePositiveNumber(value: string | null): number | null {
    if (value === null) return null;
  
    const parsed = Number(value);
  
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
  
    return parsed;
}
  
export function parseNonNegativeNumber(value: string | null): number | null {
    if (value === null) return null;
  
    const parsed = Number(value);
  
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
  
    return parsed;
}
  
export function badRequest(message: string): Response {
    return new Response(message, {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
}
  
