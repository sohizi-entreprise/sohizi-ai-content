import { Elysia, t } from 'elysia'
import { z } from 'zod'
import { redis, createBlockingRedisClient, ResumableStream } from '@/lib'
import { generationRequestTypeEnum } from '@/db/schema/base'
import { projectRepo } from '@/entities/project'
import * as requestsRepo from '@/entities/requests/repo'
import { NotFound } from '../error'

// Type for the job runner function
type JobRunner = (
  stream: ResumableStream,
  projectId: string,
  prompt?: string
) => Promise<void>

// Registry of job runners by type
const jobRunners: Partial<Record<string, JobRunner>> = {}

/**
 * Register a job runner for a specific generation type
 */
export function registerJobRunner(type: string, runner: JobRunner) {
  jobRunners[type] = runner
}

/**
 * Run a job in fire-and-forget mode
 */
async function runJob(
  projectId: string,
  type: string,
  prompt?: string
) {
  const stream = new ResumableStream(redis, projectId)
  const runner = jobRunners[type]

  if (!runner) {
    await stream.pushError(`No job runner registered for type: ${type}`)
    await stream.close('error')
    return
  }

  try {
    await runner(stream, projectId, prompt)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Job error for ${projectId}:`, error)
    
    // Check if cancelled
    if (await stream.isCancelled()) {
      await stream.close('cancelled')
    } else {
      await stream.pushError(message)
      await stream.close('error')
    }
  }
}

export const streamRoutes = new Elysia({ prefix: '/stream' })
  /**
   * POST /stream/start - Initialize a stream and fire the LLM job
   */
  .post('/start', async ({ body }) => {
    const { projectId, type, prompt } = body

    // Validate project exists
    const project = await projectRepo.getProjectById(projectId)
    if (!project) {
      throw new NotFound('Project not found')
    }

    // Create generation request record
    await requestsRepo.createGenerationRequest({
      projectId,
      type,
      prompt: prompt || null,
    })

    // Fire and forget - run the job in the background
    runJob(projectId, type, prompt).catch((err) => {
      console.error(`Background job failed for ${projectId}:`, err)
    })

    return { projectId }
  }, {
    body: t.Object({
      projectId: t.String({ format: 'uuid' }),
      type: t.UnionEnum(generationRequestTypeEnum.enumValues),
      prompt: t.Optional(t.String()),
    }),
    response: {
      200: t.Object({
        projectId: t.String(),
      }),
    },
  })

  /**
   * GET /stream/:projectId - SSE endpoint for EventSource subscription
   */
  .get('/:projectId', async function* ({ params, request }) {
    const { projectId } = params

    // Get Last-Event-ID from headers (for resumption)
    const lastEventId = request.headers.get('Last-Event-ID') || undefined

    const stream = new ResumableStream(redis, projectId)
    
    // Check if stream exists
    const exists = await stream.exists()
    if (!exists) {
      // Stream doesn't exist yet or was cleaned up
      // Return a single error event
      yield {
        event: 'error',
        id: '0',
        data: JSON.stringify({ type: 'error', data: { message: 'Stream not found or expired' } }),
      }
      return
    }

    // Create a blocking client for this subscription
    const blockingClient = createBlockingRedisClient()
    
    try {
      await blockingClient.connect()
      
      for await (const entry of stream.subscribe(blockingClient, lastEventId)) {
        yield {
          event: entry.event.type,
          id: entry.id,
          data: JSON.stringify(entry.event),
        }
      }
    } finally {
      // Clean up the blocking client
      await blockingClient.quit().catch(() => {})
    }
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
  })

  /**
   * DELETE /stream/:projectId - Cancel the stream
   */
  .delete('/:projectId', async ({ params }) => {
    const { projectId } = params

    const stream = new ResumableStream(redis, projectId)
    
    // Set cancel flag
    await stream.cancel()

    // Update generation request status
    // Note: We'd need to find the request by projectId, but for simplicity
    // we just set the cancel flag and let the producer handle it

    return { cancelled: true }
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
    response: {
      200: t.Object({
        cancelled: t.Boolean(),
      }),
    },
  })


// ============================================================================
// DEMO JOB RUNNER (for testing)
// ============================================================================

/**
 * A demo job runner that simulates LLM streaming
 * Register this for testing purposes
 */
export async function demoJobRunner(
  stream: ResumableStream,
  projectId: string,
  prompt?: string
) {
  const words = (prompt || 'Hello, this is a demo stream response.').split(' ')
  
  for (const word of words) {
    // Check for cancellation before each chunk
    if (await stream.isCancelled()) {
      await stream.close('cancelled')
      return
    }

    // Simulate streaming delay
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Push chunk
    await stream.pushChunk({ text: word + ' ' })
  }

  // Complete the stream
  await stream.close('done')
}

// Register the demo runner for a test type (you can remove this in production)
// registerJobRunner('GENERATE_BRIEF', demoJobRunner)
