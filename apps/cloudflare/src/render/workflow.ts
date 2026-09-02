import { WorkflowEntrypoint } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { getContainer } from '@cloudflare/containers'
import { readIntVar } from '../env'
import { containerRenderStatusSchema } from './contracts'
import { uploadStreamToR2 } from './r2-upload'
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers'
import type { WorkerEnv } from '../env'
import type { RenderWorkflowParams } from './contracts'

export type RenderWorkflowOutput = {
  outputKey: string
  sizeInBytes: number
  frameCount: number
  finishedAt: string
}

const CONTAINER_STEP_RETRIES = {
  retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' },
  timeout: '10 minutes',
} as const

/**
 * Durable orchestration for one export.
 *
 * The container is driven with short requests (start, poll, download) rather
 * than a single multi-minute call, so a dropped connection or an evicted
 * container never loses the job: the step simply retries.
 */
export class RenderWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  RenderWorkflowParams
> {
  async run(
    event: WorkflowEvent<RenderWorkflowParams>,
    step: WorkflowStep,
  ): Promise<RenderWorkflowOutput> {
    const params = event.payload
    try {
      return await this.render(params, step)
    } catch (error) {
      // A failed export must not leave its snapshot behind: the input document
      // can be megabytes and nothing reads it once the workflow is done.
      await step
        .do('cleanup after failure', async () => {
          await this.env.R2_BUCKET.delete([params.inputKey, params.progressKey])
          return { cleaned: true }
        })
        .catch((cleanupError: unknown) => {
          console.error('[render-workflow] cleanup failed:', cleanupError)
        })
      throw error
    }
  }

  private async render(
    params: RenderWorkflowParams,
    step: WorkflowStep,
  ): Promise<RenderWorkflowOutput> {
    const pollIntervalSeconds = readIntVar(
      this.env.RENDER_POLL_INTERVAL_SECONDS,
      5,
      { min: 1, max: 60 },
    )
    const timeoutMinutes = readIntVar(this.env.RENDER_TIMEOUT_MINUTES, 30, {
      min: 1,
      max: 120,
    })
    const maxPolls = Math.ceil((timeoutMinutes * 60) / pollIntervalSeconds)

    await step.do('start render', CONTAINER_STEP_RETRIES, async () => {
      const input = await this.env.R2_BUCKET.get(params.inputKey)
      if (!input) {
        throw new NonRetryableError(
          `Render input ${params.inputKey} is missing from R2`,
        )
      }

      // The snapshot is sent as a string, not `input.body`: a subrequest body
      // needs a known length, and a stream could only be read once anyway,
      // which would break this step's retries.
      const snapshot = await input.text()

      const response = await this.containerFetch(params.jobId, '/renders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: snapshot,
      })

      if (response.status !== 202 && response.status !== 200) {
        throw await this.toStepError(response, 'Container rejected the render')
      }
      return { started: true }
    })

    let lastRenderedFrames = 0

    for (let poll = 0; poll < maxPolls; poll++) {
      const status = await step.do(
        `poll render ${poll}`,
        CONTAINER_STEP_RETRIES,
        async () => {
          const response = await this.containerFetch(
            params.jobId,
            `/renders/${params.jobId}`,
            { method: 'GET' },
          )
          if (response.status === 404) {
            // The container was recycled mid-render. Restarting is cheaper than
            // failing the export.
            throw new Error('Render job is no longer known to the container')
          }
          if (!response.ok) {
            throw await this.toStepError(
              response,
              'Container status check failed',
            )
          }
          return containerRenderStatusSchema.parse(await response.json())
        },
      )

      if (status.state === 'failed') {
        const message =
          status.error?.message ?? 'Render failed inside container'
        if (status.error?.retryable) throw new Error(message)
        throw new NonRetryableError(message)
      }

      if (status.state === 'completed') {
        const stored = await step.do(
          'store output',
          CONTAINER_STEP_RETRIES,
          async () => {
            const response = await this.containerFetch(
              params.jobId,
              `/renders/${params.jobId}/output`,
              { method: 'GET' },
            )
            if (!response.ok || !response.body) {
              throw await this.toStepError(
                response,
                'Container did not return the rendered file',
              )
            }

            const { sizeInBytes } = await uploadStreamToR2(
              this.env.R2_BUCKET,
              params.outputKey,
              response.body,
              {
                contentType: 'video/mp4',
                cacheControl: 'private, max-age=0, no-store',
              },
            )
            return { sizeInBytes }
          },
        )

        await step.do('cleanup', async () => {
          await this.env.R2_BUCKET.delete([params.inputKey, params.progressKey])
          await this.containerFetch(params.jobId, `/renders/${params.jobId}`, {
            method: 'DELETE',
          }).catch(() => undefined)
          return { cleaned: true }
        })

        return {
          outputKey: params.outputKey,
          sizeInBytes: stored.sizeInBytes,
          frameCount: params.frameCount,
          finishedAt: new Date().toISOString(),
        }
      }

      if (status.renderedFrames !== lastRenderedFrames) {
        lastRenderedFrames = status.renderedFrames
        await step.do(`publish progress ${poll}`, async () => {
          await this.env.R2_BUCKET.put(
            params.progressKey,
            JSON.stringify({
              progress: status.progress,
              renderedFrames: status.renderedFrames,
              frameCount: params.frameCount,
              updatedAt: new Date().toISOString(),
            }),
            { httpMetadata: { contentType: 'application/json' } },
          )
          return { published: true }
        })
      }

      await step.sleep(`wait ${poll}`, `${pollIntervalSeconds} seconds`)
    }

    throw new NonRetryableError(
      `Render exceeded the ${timeoutMinutes} minute limit`,
    )
  }

  private containerFetch(
    jobId: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const container = getContainer(this.env.RENDER_CONTAINER, jobId)
    return container.fetch(`http://render.internal${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(this.env.RENDER_SERVICE_TOKEN
          ? { Authorization: `Bearer ${this.env.RENDER_SERVICE_TOKEN}` }
          : {}),
      },
    })
  }

  /** Container errors are logged verbatim but summarized for the caller. */
  private async toStepError(
    response: Response,
    summary: string,
  ): Promise<Error> {
    const body = await response.text().catch(() => '')
    console.error(`[render-workflow] ${summary} (${response.status}): ${body}`)
    if (response.status >= 400 && response.status < 500) {
      return new NonRetryableError(`${summary} (${response.status})`)
    }
    return new Error(`${summary} (${response.status})`)
  }
}
