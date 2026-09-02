import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const getRouter = () => {
  return createRouter({
    routeTree,
    context: {},
    defaultPreload: "intent",
    defaultNotFoundComponent: () => <div>Not found</div>,
    defaultErrorComponent: ({ error }) => <div>Error: {error.message}</div>,
  })
}
