/** The only public event names and payloads used by Sohizi analytics. */
export type AnalyticsEvents = {
  marketing_cta_clicked: { location: string; destination: "sign-up" }
  marketing_demo_played: { location: string }
  marketing_demo_viewed: {
    location: string
    position_seconds: number
    duration_seconds: number
    position_percent: number
    watched_seconds: number
    watched_percent: number
    completed: boolean
    stop_reason:
      | "paused"
      | "out_of_view"
      | "page_hidden"
      | "navigation"
      | "inactive"
      | "source_changed"
      | "ended"
  }
  signup_started: { method: "email" | "google" }
  signup_completed: { method: "email" | "google" }
  organization_created: Record<string, never>
  project_created: { project_id: string; mode: "blank" | "guided" }
  generation_started: {
    project_id: string
    request_id: string
    media_type: string
  }
  generation_succeeded: {
    project_id: string
    request_id: string
    media_type: string
  }
  generation_failed: {
    project_id: string
    request_id: string
    media_type: string
    failure_category: string
  }
  generated_asset_used: {
    project_id: string
    media_type: string
    destination: "timeline" | "project"
  }
  video_export_started: { project_id: string; job_id: string }
  video_export_succeeded: { project_id: string; job_id: string }
  video_export_failed: {
    project_id: string
    job_id: string
    failure_category: string
  }
  video_export_downloaded: { project_id: string; job_id: string }
}

export type AnalyticsEventName = keyof AnalyticsEvents
export type AnalyticsProperties<TName extends AnalyticsEventName> =
  AnalyticsEvents[TName]
