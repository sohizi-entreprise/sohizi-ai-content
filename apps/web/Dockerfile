# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/web/package.json ./apps/web/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/analytics/package.json ./packages/analytics/package.json
COPY /packages/ui/package.json ./packages/ui/package.json
COPY /packages/video-composition/package.json ./packages/video-composition/package.json

RUN --mount=type=cache,id=bun-web,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/web/src ./apps/web/src
COPY /apps/web/public ./apps/web/public
COPY /apps/web/vite.config.ts ./apps/web/vite.config.ts
COPY /apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY /packages/ui/src ./packages/ui/src
COPY /packages/ui/tsconfig.json ./packages/ui/tsconfig.json
COPY /packages/analytics/src ./packages/analytics/src
COPY /packages/video-composition/src ./packages/video-composition/src
COPY /packages/video-composition/tsconfig.json ./packages/video-composition/tsconfig.json
COPY /scripts/prune-nitro-trace.mjs ./scripts/prune-nitro-trace.mjs

ARG API_URL=http://localhost:3030
ARG SENTRY_ORG
ARG SENTRY_PROJECT_WEB
ARG SENTRY_RELEASE
ENV API_URL=$API_URL
ENV NODE_ENV=production
# Vite/Nitro SSR for this app peaks well above Node's default ~2GB heap.
# Keep headroom under typical ~8–10GB Docker VM limits.
ENV NODE_OPTIONS=--max-old-space-size=6144

WORKDIR /app/apps/web

# Sentry must be traced (bundling OOMs). Prune build-only transitive deps that
# @sentry/bundler-plugins pulls into .output (vite/esbuild/rollup/sentry-cli).
RUN --mount=type=secret,id=sentry_auth_token \
    if [ -s /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi; \
    bun run build && \
    find .output -name '*.map' -delete && \
    bun /app/scripts/prune-nitro-trace.mjs .output

FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=build /app/apps/web/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

USER bun

CMD ["bun", ".output/server/index.mjs"]
