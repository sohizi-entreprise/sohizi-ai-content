TODOS before Jun 10

[ ] AI tools generation for media
[ ] Media preview (react-doc-viewer)
[ ] Attach file to input by drag and drop
[ ] Image editor with AI
[ ] Billing system
[ ] Auth user + organization
[ ] Project core settings
[ ] Templating for flexibility
[ ] Writing tools for AI
[ ] Searching tools for AI
[ ] Assign tool
[ ] Landing pages
[ ] Polish design

TODOS Jun 11 - Jun 23

[ ] Video timeline to database
[ ] Video editor sub-agent
[ ] Video timeline tools
[ ] Add captions
[ ] Add transitions + effects
[ ] Video rendering engine
[ ] Export video

======
[ ] Remove the messages table
[ ] The agent expose some internal errors of the system, when something goes wrong let's rather return a generic error
[ ] create other extensions for markdown
[ ] Make the checkpoints robust to bad message ordering
[ ] Add compression
[ ] Add memory
[ ] Polish the diff (especially when you try to reformat a doc)
[ ] improve tool in the chat design
[ ] Fix the problem, the app is freezing during streaming
[ ] Handle drag and drop for file in timeline
[ ] Optimize captions so it can run on the background
[ ] clean timeline.tsx - decompose logic into hooks
[ ] avoid dropping node on the timeline layer - it stucks we should fix that
[ ] inside the storage.ts the max file size is 15MB for video and audio

===== Final stages ========

1. Create a temporary context which lives in the session that maintain context between main-agent and sub-agent

===== Render performance (Cloudflare Remotion) ========

Critical

[ ] Cap accepted jobs to the container envelope (2 vCPU / 8 GiB / 30–45 min). RENDER_LIMITS allow 72k frames, 4096px, 1000 clips; prod RENDER_CONCURRENCY=4 oversubscribes 2 CPUs. Oversized exports timeout while holding max_instances slots. - cloudflare/src/render/contracts.ts (RENDER_LIMITS) - server/src/features/video-editor/render-schema.ts (same limits) - cloudflare/wrangler.jsonc (instance_type, max_instances, RENDER_CONCURRENCY, RENDER_TIMEOUT_MINUTES) - cloudflare/src/render/container.ts - cloudflare/container/src/server.ts (CONCURRENCY, TIMEOUT_MS)

[ ] Split Player vs renderer composition. Shared package uses OffthreadVideo, per-frame caption pagination, and delayRender iframes (GSAP from jsDelivr) in the editor preview. Caption createTikTokStyleCaptions is not memoized; iframe onLoad can miss continueRender and stall 90s. - frontend/src/features/video-editor/engine/player.tsx - cloudflare/packages/video-composition/src/clips.tsx (OffthreadVideo) - cloudflare/packages/video-composition/src/caption-clip.tsx - cloudflare/packages/video-composition/src/html-clip.tsx - cloudflare/packages/video-composition/src/html-document.ts (GSAP_SCRIPT_TAG) - cloudflare/container/src/server.ts (DELAY_RENDER_TIMEOUT_MS)

[ ] Recover or stop the container on fail/cancel/recycle. 404 and retryable errors only retry the GET poll, they do not POST the render again. Cancel terminates the Workflow but never DELETE/cancels the container; it keeps encoding until sleepAfter=3m. - cloudflare/src/render/workflow.ts (404 handler, retryable failed state, containerFetch) - cloudflare/src/render/routes.ts (cancelRender) - cloudflare/src/render/container.ts (sleepAfter) - cloudflare/container/src/server.ts (jobs Map, retryable, DELETE /renders/:id)

Medium

[ ] Stop paying a cold container per job plus 3 min idle hold. getContainer(..., jobId) never reuses a warm instance; cleanup does not stop the DO. Runtime image still includes @remotion/bundler and fonts-noto-cjk. - cloudflare/src/render/workflow.ts (containerFetch) - cloudflare/src/render/container.ts - cloudflare/wrangler.jsonc - cloudflare/Dockerfile - cloudflare/container/package.json

[ ] Skip selectComposition; snapshot already has fps/width/height/durationInFrames. Extra Chrome spawn every export. - cloudflare/container/src/server.ts (startRender)

[ ] Prefetch clip media to disk (and vendor GSAP). Live CDN fetches during encode; Failed to fetch is non-retryable. HTML clips depend on jsDelivr which is not on RENDER_ALLOWED_MEDIA_HOSTS. - cloudflare/packages/video-composition/src/clips.tsx - cloudflare/packages/video-composition/src/html-document.ts - cloudflare/container/src/server.ts (isDeterministicFailure) - cloudflare/src/render/media-hosts.ts - cloudflare/src/render/container.ts (enableInternet)

[ ] Reduce status-poll chatter. Editor refetchInterval 2s → API reconcile → Workflow.status + R2 progress; Workflow also polls every 5s and writes a durable step + R2 object on every frame-count change. - frontend/src/features/video-editor/query-mutations.ts (renderQueryOptions) - server/src/features/video-editor/render-service.ts (reconcileRenderJob) - cloudflare/src/render/routes.ts (getWorkflowState, readProgress) - cloudflare/src/render/workflow.ts (poll loop, publish progress)

[ ] Shrink the 8MB snapshot copy chain and raise/guard the 15s create timeout. structuredClone → API Zod → Worker text/JSON/Zod → R2 → Workflow input.text() → container body. HTML clips allow 2MB each. - frontend/src/features/video-editor/hooks/use-video-export.ts - server/src/features/video-editor/render-client.ts (REQUEST_TIMEOUT_MS) - server/src/features/video-editor/render-schema.ts - cloudflare/src/render/routes.ts (readCreateRequest, createRender) - cloudflare/src/render/contracts.ts (htmlClipSchema, maxPayloadBytes) - cloudflare/src/render/workflow.ts (start render) - cloudflare/container/src/server.ts (readBody)

[ ] Add admission control beyond one active job per composition. 21st concurrent render still inserts a DB row + Workflow, then sits on container provisioning until the 10 min start-step timeout. Also watch CSS blur up to 200px on image clips. - server/src/features/video-editor/render-service.ts - server/src/features/video-editor/repo.ts (getActiveRenderJobForComposition) - cloudflare/wrangler.jsonc (max_instances) - cloudflare/src/render/workflow.ts (CONTAINER_STEP_RETRIES) - cloudflare/packages/video-composition/src/clips.tsx (ImageClipRenderer filter) - cloudflare/src/render/contracts.ts (imageClipSchema.blur)
