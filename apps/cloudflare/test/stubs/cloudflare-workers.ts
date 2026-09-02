/**
 * `cloudflare:workers` only exists inside workerd. The route tests import the
 * Worker entry, which transitively pulls in the Durable Object and Workflow
 * base classes, so they are stubbed with the minimum shape those classes need.
 */

export class DurableObject<Env = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: Env,
  ) {}
}

export class WorkerEntrypoint<Env = unknown, Props = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: Env,
    readonly props?: Props,
  ) {}
}

export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: Env,
  ) {}

  declare run: (event: unknown, step: unknown) => Promise<unknown>
  declare __params?: Params
}

export class RpcTarget {}
