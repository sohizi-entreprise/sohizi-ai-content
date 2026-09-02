export type PublicEnv = {
  appUrl: string
}

let cache: PublicEnv | undefined

export function setPublicEnv(env: PublicEnv) {
  cache = env
}

export function getPublicEnv(): PublicEnv {
  if (!cache) {
    throw new Error("Public env has not been loaded")
  }
  return cache
}
