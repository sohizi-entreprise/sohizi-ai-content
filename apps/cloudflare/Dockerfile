# Remotion renderer for Cloudflare Containers.
#
# Build context is the repository root so the image can pull in both the
# container app and the composition package shared with the editor preview.
FROM node:22-bookworm-slim

# Shared libraries required by Chrome Headless Shell.
# https://www.remotion.dev/docs/miscellaneous/linux-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  fonts-noto-color-emoji \
  fonts-noto-cjk \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libgbm-dev \
  libnss3 \
  libpango-1.0-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon-dev \
  libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/cloudflare/container/package.json ./package.json
RUN npm install --no-audit --no-fund

# The composition package is dropped straight into node_modules (after install so
# npm cannot prune it). Its `remotion`/`react` imports then resolve to the single
# copy in /app/node_modules, exactly like the editor resolves them.
COPY packages/video-composition ./node_modules/@sohizi/video-composition

COPY apps/cloudflare/container/tsconfig.json apps/cloudflare/container/tsconfig.remotion.json ./
COPY apps/cloudflare/container/src ./src

RUN npx tsc -p tsconfig.json
RUN npx tsc --noEmit -p tsconfig.remotion.json

ENV REMOTION_BUNDLE_DIR=/app/remotion-bundle
RUN node dist/build-bundle.js

# Download Chrome Headless Shell into the image so the first render is not slowed
# down by a browser install. Done through the renderer API to avoid shipping the
# Remotion CLI in the production image.
RUN node --input-type=module -e "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser();"

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Node handles SIGTERM directly (see the shutdown handler in server.ts), so no
# init shim is needed for graceful stops.
CMD ["node", "dist/server.js"]
