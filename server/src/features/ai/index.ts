import { ProjectRequirements } from '@/type'
import { ScriptAgent, ScriptStreamEvent } from './agents/script-agent'
import * as aiService from './service'
import { StreamBus } from './stream-bus'
import { ScriptWriterEvent, writeScript } from './write_script'
import { Elysia, sse, t } from 'elysia'
import { z } from 'zod'


export const aiRoutes = new Elysia({ prefix: '/ai' })
  .post('/brief/project/:id', async function*({ params }){
    const streams = await aiService.generateBrief(params.id)
    yield sse({
      event: 'start',
      data: null,
    })
    for await (const chunk of streams) {
      // The AI SDK's partialOutputStream returns chunks in the AI SDK data stream format
      // These are already strings in the correct format (e.g., '0:"data"', '1:"data"')
      // Send them directly as SSE data
      const data = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
      yield sse({
        event: 'chunk_delta',
        data: data,
      })
    }
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    })
  })

  .post('/correct/script', async function*({ body }){
    const streams = await aiService.correctScript(body)
    yield sse({
      event: 'start',
      data: null,
    })
    for await (const chunk of streams) {
      const data = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
      yield sse({
        event: 'chunk_delta',
        data: data,
      })
    }
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    body: t.Object({
      brief: t.String(),
      feedback: t.String(),
      partsToEdit: t.String(),
    })
  })

  .post('/script/project/:id', async function*({ params }){
    // Create an AbortController to cancel the script generation when client disconnects
    const abortController = new AbortController();
    
    const bus = new StreamBus<ScriptWriterEvent>({
      // When the bus closes (e.g., client disconnects), abort the script generation
      onClose: () => {
        console.log('bus closed, aborting script generation');
        abortController.abort();
      }
    });
    
    yield sse({
      event: 'start',
      data: null,
    })

    // Pass the abort signal to writeScript so it can check for cancellation
    bus.attachProducer('writeScript', writeScript(params.id, abortController.signal));

    try {
      for await (const ev of bus) {
        yield sse({
          event: ev.type,
          data: JSON.stringify(ev.data),
        })
      }
    } finally {
      // Ensure abort is called when the generator exits (client disconnect or completion)
      abortController.abort();
    }
    
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    })
  })
  .post('/script_v2/project/:id', async function*({ params, body }){
    // Create an AbortController to cancel the script generation when client disconnects
    const abortController = new AbortController();
    
    const bus = new StreamBus<ScriptStreamEvent>({
      // When the bus closes (e.g., client disconnects), abort the script generation
      onClose: () => {
        console.log('bus closed, aborting script generation');
        abortController.abort();
      }
    });

    const projectRequirements: ProjectRequirements = {
      format: "storytime",
      audience: "adult",
      genre: "mystery",
      tone: "mysterious, suspenseful",
      maxDuration: "2min"
    }

    const scriptAgent = new ScriptAgent('gpt-5-mini', bus, projectRequirements, abortController.signal);
    
    yield sse({
      event: 'start',
      data: null,
    })

    // Fire and forget
    scriptAgent.run(body.prompt);

    try {
      for await (const ev of bus) {
        const {source, ...rest} = ev;
        yield sse({
          event: source,
          data: JSON.stringify(rest),
        })
      }
    } finally {
      // Ensure abort is called when the generator exits (client disconnect or completion)
      abortController.abort();
    }
    
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    }),
    body: t.Object({
      prompt: t.String(),
    })
  })
