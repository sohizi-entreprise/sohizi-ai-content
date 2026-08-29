import { createParser } from 'eventsource-parser'
import type { EventSourceMessage } from 'eventsource-parser'

export async function* parseSseStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const events: Array<EventSourceMessage> = []
  const parser = createParser({
    onEvent: (event) => {
      events.push(event)
    },
  })

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      parser.feed(decoder.decode(value, { stream: true }))

      while (events.length > 0) {
        yield events.shift()!
      }
    }

    const remaining = decoder.decode()
    if (remaining) {
      parser.feed(remaining)
    }

    parser.reset({ consume: true })

    while (events.length > 0) {
      yield events.shift()!
    }
  } finally {
    reader.releaseLock()
  }
}
