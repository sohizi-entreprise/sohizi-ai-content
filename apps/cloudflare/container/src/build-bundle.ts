import path from 'node:path'
import { bundle } from '@remotion/bundler'

/**
 * Builds the Remotion bundle at image build time so a render never pays the
 * webpack cost and the running container needs no build toolchain.
 */
const entryPoint = path.resolve(process.cwd(), 'src/remotion/index.ts')
const outDir =
  process.env.REMOTION_BUNDLE_DIR ??
  path.resolve(process.cwd(), 'remotion-bundle')

const serveUrl = await bundle({
  entryPoint,
  outDir,
  onProgress: (progress) => {
    if (progress % 25 === 0) {
      console.log(`[bundle] ${progress}%`)
    }
  },
})

console.log(`[bundle] ready at ${serveUrl}`)
