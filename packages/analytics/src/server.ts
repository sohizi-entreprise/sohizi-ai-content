import { PostHog } from "posthog-node"
import type { AnalyticsEventName, AnalyticsProperties } from "./events"

let client: PostHog | null = null

function getClient(): PostHog | null {
  const project = process.env.POSTHOG_PROJECT
  const host = process.env.POSTHOG_API_HOST
  if (!project || !host) return null
  client ??= new PostHog(project, { host })
  return client
}

export function captureServerEvent<TName extends AnalyticsEventName>(
  distinctId: string,
  name: TName,
  properties: AnalyticsProperties<TName>,
): void {
  const posthog = getClient()
  if (!posthog || !distinctId) return
  const eventId =
    "request_id" in properties
      ? properties.request_id
      : "job_id" in properties && name !== "video_export_downloaded"
        ? properties.job_id
        : null
  posthog.capture({
    distinctId,
    event: name,
    properties: eventId
      ? { ...properties, $insert_id: `${name}:${eventId}` }
      : properties,
  })
}

export async function shutdownAnalytics(): Promise<void> {
  await client?.shutdown()
  client = null
}
