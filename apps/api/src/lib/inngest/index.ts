import { handleMediaGeneration } from "@/features/media-engine/inngest"
import { handleHtmlVideoGeneration } from "@/features/media-engine/html-video-inngest"
import { handleVideoExportPoll } from "@/features/video-editor/inngest"
import { recoverStuckJobs } from "@/features/capacity/recovery"
import {
  sweepBillingReservations,
  sweepBillingWallets,
  reconcilePolarBilling,
} from "@/features/billing/inngest"

export { inngest } from "./client"

export const functions = [
  handleHtmlVideoGeneration,
  handleMediaGeneration,
  handleVideoExportPoll,
  recoverStuckJobs,
  sweepBillingReservations,
  sweepBillingWallets,
  reconcilePolarBilling,
]
