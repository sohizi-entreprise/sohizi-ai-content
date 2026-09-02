FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/site/package.json ./apps/site/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/ui/package.json ./packages/ui/package.json

RUN bun install

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/site/src ./apps/site/src
COPY /apps/site/public ./apps/site/public
COPY /apps/site/vite.config.ts ./apps/site/vite.config.ts
COPY /apps/site/tsconfig.json ./apps/site/tsconfig.json
COPY /packages/ui/src ./packages/ui/src
COPY /packages/ui/tsconfig.json ./packages/ui/tsconfig.json

ENV NODE_ENV=production

WORKDIR /app/apps/site

RUN bun run build

FROM oven/bun:1

WORKDIR /app

COPY --from=build /app/apps/site/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["bun", ".output/server/index.mjs"]
