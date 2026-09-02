FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/api/package.json ./apps/api/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json

RUN bun install

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/api/src ./apps/api/src
COPY /apps/api/tsconfig.json ./apps/api/tsconfig.json

ENV NODE_ENV=production

WORKDIR /app/apps/api

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile /app/api \
	src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build --chmod=755 /app/api api

ENV NODE_ENV=production

CMD ["./api"]

EXPOSE 3030
