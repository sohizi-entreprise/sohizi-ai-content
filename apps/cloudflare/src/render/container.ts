import { Container } from "@cloudflare/containers"
import { readIntVar } from "../env"
import type { WorkerEnv } from "../env"

type ContainerState = ConstructorParameters<typeof Container>[0]

/**
 * One container instance per render job, addressed by job id.
 *
 * The image is a Node process running Remotion's renderer. It needs internet
 * access to pull clip media from the CDN and the pinned GSAP bundle used by
 * Hyperframe clips; every URL is checked against the media allowlist before a
 * job is accepted.
 */
export class RemotionRenderContainer extends Container<WorkerEnv> {
  defaultPort = 8080
  /**
   * Long enough to survive the gap between Workflow polls, short enough that a
   * finished job stops billing quickly.
   */
  sleepAfter = "3m"
  enableInternet = true

  constructor(ctx: ContainerState, env: WorkerEnv) {
    super(ctx, env)
    this.envVars = {
      NODE_ENV: "production",
      RENDER_CONCURRENCY: String(
        readIntVar(env.RENDER_CONCURRENCY, 2, { min: 1, max: 8 }),
      ),
      RENDER_TIMEOUT_MINUTES: String(
        readIntVar(env.RENDER_TIMEOUT_MINUTES, 30, { min: 1, max: 120 }),
      ),
      ...(env.RENDER_SERVICE_TOKEN
        ? { RENDER_TOKEN: env.RENDER_SERVICE_TOKEN }
        : {}),
    }
  }

  override onStart(): void {
    console.log(`[render-container ${this.ctx.id.toString()}] started`)
  }

  override onStop({
    exitCode,
    reason,
  }: {
    exitCode: number
    reason: string
  }): void {
    console.log(
      `[render-container ${this.ctx.id.toString()}] stopped exitCode=${exitCode} reason=${reason}`,
    )
  }

  override onError(error: unknown): unknown {
    console.error(`[render-container ${this.ctx.id.toString()}] error:`, error)
    return error
  }
}
