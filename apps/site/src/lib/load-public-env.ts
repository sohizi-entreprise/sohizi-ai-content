import { createServerFn } from "@tanstack/react-start"
import { readPublicEnvFromNitro } from "./public-env.server"
import type { PublicEnv } from "./public-env"

export const loadPublicEnv = createServerFn({ method: "GET" }).handler(
  (): PublicEnv => readPublicEnvFromNitro(),
)
