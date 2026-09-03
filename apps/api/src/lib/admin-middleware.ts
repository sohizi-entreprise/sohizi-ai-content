import { Elysia } from "elysia"
import { authMiddleware } from "./auth-middleware"
import { assertAdmin } from "./authorize"

/**
 * Auth + admin check for /admin routes.
 * `.as('scoped')` lifts nested auth derive to the parent route plugin;
 * without it, `user` is undefined and requests incorrectly 401.
 */
export const adminMiddleware = new Elysia({ name: "admin-middleware" })
  .use(authMiddleware)
  .as("scoped")
  .onBeforeHandle({ as: "scoped" }, ({ user }) => {
    assertAdmin(user)
  })
