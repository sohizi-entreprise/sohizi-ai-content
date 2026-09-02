FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/web/package.json ./apps/web/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/ui/package.json ./packages/ui/package.json
COPY /packages/video-composition/package.json ./packages/video-composition/package.json

RUN bun install

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/web/src ./apps/web/src
COPY /apps/web/public ./apps/web/public
COPY /apps/web/vite.config.ts ./apps/web/vite.config.ts
COPY /apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY /packages/ui/src ./packages/ui/src
COPY /packages/ui/tsconfig.json ./packages/ui/tsconfig.json
COPY /packages/video-composition/src ./packages/video-composition/src
COPY /packages/video-composition/tsconfig.json ./packages/video-composition/tsconfig.json

ARG API_URL=http://localhost:3030
ENV API_URL=$API_URL
ENV NODE_ENV=production

WORKDIR /app/apps/web

RUN bun run build

FROM oven/bun:1

WORKDIR /app

COPY --from=build /app/apps/web/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
