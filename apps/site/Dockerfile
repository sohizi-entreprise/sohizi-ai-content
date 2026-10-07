FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/site/package.json ./apps/site/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/analytics/package.json ./packages/analytics/package.json
COPY /packages/ui/package.json ./packages/ui/package.json

RUN bun install

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/site/src ./apps/site/src
COPY /apps/site/public ./apps/site/public
COPY /apps/site/vite.config.ts ./apps/site/vite.config.ts
COPY /apps/site/tsconfig.json ./apps/site/tsconfig.json
COPY /packages/ui/src ./packages/ui/src
COPY /packages/ui/tsconfig.json ./packages/ui/tsconfig.json
COPY /packages/analytics/src ./packages/analytics/src

ENV NODE_ENV=production
ARG SENTRY_ORG
ARG SENTRY_PROJECT_SITE
ARG SENTRY_RELEASE

WORKDIR /app/apps/site

RUN --mount=type=secret,id=sentry_auth_token \
    if [ -s /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi; \
    bun run build && find .output/public -name '*.map' -delete

FROM oven/bun:1

WORKDIR /app

COPY --from=build /app/apps/site/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["bun", ".output/server/index.mjs"]
