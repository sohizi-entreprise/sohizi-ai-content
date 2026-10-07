FROM oven/bun:1 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY /apps/api/package.json ./apps/api/package.json
COPY /packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY /packages/analytics/package.json ./packages/analytics/package.json

RUN bun install

# Copy source only so bun's isolated workspace node_modules stay intact
COPY /apps/api/src ./apps/api/src
COPY /apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY /packages/analytics/src ./packages/analytics/src

ENV NODE_ENV=production

WORKDIR /app/apps/api

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--sourcemap \
	--outfile /app/api \
	src/entry.ts \
	&& bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile /app/migrate \
	src/db/migrate.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build --chmod=755 /app/api api
COPY --from=build --chmod=755 /app/migrate migrate
COPY --from=build /app/apps/api/src/db/migrations /app/migrations

ENV NODE_ENV=production

CMD ["./api"]

EXPOSE 3030
