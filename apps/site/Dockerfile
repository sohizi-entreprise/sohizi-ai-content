# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/site/package.json ./apps/site/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/analytics/package.json ./packages/analytics/package.json
COPY /packages/ui/package.json ./packages/ui/package.json

RUN --mount=type=cache,id=bun-site,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/site/src ./apps/site/src
COPY /apps/site/public ./apps/site/public
COPY /apps/site/vite.config.ts ./apps/site/vite.config.ts
COPY /apps/site/tsconfig.json ./apps/site/tsconfig.json
COPY /packages/ui/src ./packages/ui/src
COPY /packages/ui/tsconfig.json ./packages/ui/tsconfig.json
COPY /packages/analytics/src ./packages/analytics/src
COPY /scripts/prune-nitro-trace.mjs ./scripts/prune-nitro-trace.mjs

ENV NODE_ENV=production
ARG SENTRY_ORG
ARG SENTRY_PROJECT_SITE
ARG SENTRY_RELEASE

WORKDIR /app/apps/site

# Sentry must be traced (bundling OOMs). Prune build-only transitive deps that
# @sentry/bundler-plugins pulls into .output (vite/esbuild/rollup/sentry-cli).
RUN --mount=type=secret,id=sentry_auth_token \
    if [ -s /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi; \
    bun run build && \
    find .output -name '*.map' -delete && \
    bun /app/scripts/prune-nitro-trace.mjs .output

FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=build /app/apps/site/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

USER bun

CMD ["bun", ".output/server/index.mjs"]
