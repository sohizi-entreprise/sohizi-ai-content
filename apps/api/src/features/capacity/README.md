# Capacity routing

Think of every outside service as a checkout lane. A request needs a ticket before it can use a lane. Redis is the only ticket booth. Postgres remembers which lane a long job picked. It does not count the tickets.

## The two decisions

1. **Which lane is allowed.** That is a route.
2. **Whether that lane has room right now.** That is a lease.

LLM and media routes come from the database: vendor name, adapter, API name, enabled flag, and priority. The code registry owns the adapter implementation, stable account ids, API keys, limits, selection strategy, and circuit settings. A database row with no matching registry account is skipped.

`web.search`, `web.extract`, and `video.export` have no database route. The registry provider list is the route list. Their API name is the task name.

Missing credentials, or a Remotion account missing region, function name, or serve URL, make that account disappear. The request then tries the next account.

## The ticket

A lease is `{ poolId, holderId, leaseId, epoch, expiresAtMs }`.

- `poolId` is one lane. Account lanes are `account:{accountId}`. User lanes are `user:{userId}:media` or `user:{userId}:video.export`.
- `holderId` is the job or call id. Asking again with the same holder in the same pool returns the same ticket and does not spend another token. The same holder in another pool is a different ticket.
- `leaseId` and `epoch` stop an old worker from renewing or releasing a newer ticket. A second release is `not_found` and counts as success. A stale release is ignored.

Acquire, renew, and release are each one Redis Lua script. Keys use the `cap:` prefix. If Redis errors or times out, the call fails closed. Nothing is sent.

Limits:

- `maxConcurrency` is how many tickets can be out at once.
- `rpm` and `burst` are a token bucket. Leave `rpm` unset or at `0` to skip it. Concurrency-only lanes do this.
- A lease expires at `expiresAtMs` unless something renews it. Long jobs must renew before that time.

Release outcomes:

| Outcome | Slot | Token | Circuit |
| --- | --- | --- | --- |
| `completed` | freed | spent token stays spent | closed if this lease held the probe |
| `rate_limited` | freed | spent token stays spent | opened for the provider's 429 retry time, or the account cooldown when that time is missing |
| `not_sent` | freed | one token refunded, capped at burst | probe reopened |
| `abandoned` | freed | no success claimed | probe reopened if this lease held it |

An open circuit rejects everyone except one probe. The probe belongs to one `leaseId`. Renew keeps that probe. `not_sent` gives the probe back.

A 429 opens that account's circuit for the provider's retry time. Adapters read `Retry-After` as seconds or an HTTP date, or set `retryAfterMs` themselves. A positive value is used exactly, even when it is shorter or longer than the account cooldown. A missing, zero, or invalid hint uses `cooldownMs` from the registry, then 15 seconds if that is also unset. A 500 or other account failure does not use a retry hint. The current request still moves to the next account immediately. Calls that already hold a ticket keep running.

For example, OpenRouter answers 429 with `Retry-After: 8`. That account pauses for 8 seconds. The chat tries the Vercel gateway on the same request. For the next 8 seconds, new calls skip that OpenRouter account. If OpenRouter sends no retry time, the pause is the registry cooldown, which is 15 seconds today.

## How a call gets a lane

`tryAcquireCapacity` picks a route and returns the account, binding, and lease. It does not call the provider.

`runWithCapacity` does the whole short call: acquire, run, classify the error, release, and maybe try another lane until `waitMs` runs out.

Route order is priority, then provider name. Inside one provider, `priority` keeps account order. `spread` tries the account with the most free slots first. The acquire itself is still the atomic step.

Waiting sleeps with jitter, between 250 ms and 15 s, and can be aborted. At the deadline, a full lane is `CapacityBusyError`. Redis down is `CapacityUnavailableError`. No enabled account is `NoCapacityRouteError`.

Error actions:

| Action | What it means | Next step |
| --- | --- | --- |
| `account_failure` | This account is sick: 429, 402, 5xx | Release `rate_limited`, try the next account |
| `route_failure` | This provider cannot do this job, such as 404 | Release `completed`, skip the rest of that provider |
| `client_failure` | Our request is bad, such as 400 | Release `completed`, stop |
| `not_sent` | The provider definitely did not receive it | Refund the token and try again |
| `submission_unknown` | It might have been sent | Keep the lease, do not send it again |
| `abort` | The caller cancelled | Refund the token, do not fail over |

## The user gate

`media` allows 5 jobs per user. `video.export` allows 2. Web search and LLM have no user cap.

The user ticket is taken at HTTP admission, before the job row and before the provider ticket. It is a different lease from the account lease. Rejected admission creates no row, no billing reservation, and no Inngest event. The HTTP error is 429. Durable jobs renew the user lease while they wait or poll, and release it when they finish.

## Long jobs

Media and video export use this order: `selected -> submitting -> submitted -> terminal`.

The account id and lease are saved before the provider call. The provider request id is saved immediately after a confirmed submit. A crash after `submitting` with no provider id becomes `submission_unknown`. Polling uses the saved account. The account lease is released only after the provider is terminal, or after a confirmed cancel. An unknown submission keeps the account lease so a possible live job cannot be double-booked.

A recovery cron re-sends media jobs whose enqueue time is still empty, and video jobs whose poller enqueue time is still empty.

## Extend each type

### `web.search` and `web.extract`

These two tasks share providers, but each call acquires its own ticket. The tool calls `runWithCapacity` and then the adapter.

**Add another Tavily key.** In `registry.ts`, add an account on the `tavily` provider:

```ts
account("tavily:backup", { ...DEFAULT_CIRCUIT, rpm: 60, burst: 60, maxConcurrency: 10 }, {
  credentialEnv: "TAVILY_BACKUP_API_KEY",
})
```

Set the env var. No database row. No tool change. The new account is its own lane.

**Add Brave for search only.** Register a provider with `tasks: ["web.search"]`, adapter `brave`, and a Brave API key. In `web-search.ts`, branch on `account.adapter`: Brave calls Brave, Tavily still calls `tavilySearch`. Teach `classifyWebError` Brave's statuses. Extract stays on Tavily because Brave is not in the `web.extract` task list.

### `llm`

The task string is `llm:{modelId}`. Routes come from enabled `llm` vendor rows joined to that model. The public calls stay `generateTextWithFailover` and `streamTextWithFailover`.

**Add a second OpenRouter key.** Add `openrouter:backup` to the `openrouter` provider with its own env var and concurrency limit. The existing vendor row already points at the `openrouter` provider, so both keys are tried. An account failure opens only that key's circuit.

**Add a new LLM host.** Register the provider with task `llm` and an adapter name. Add that adapter in `features/ai/llm/adapters/factory.ts` so it receives the resolved API key. Insert an enabled `llm` vendor whose `name` and `adapter` match the registry, then bind models with `apiName` and `priority`. A 404 skips that provider. A 400 stops. A 402, 429, or 5xx tries the next account. After the first stream token, there is no failover. The stream renews a 60-second lease every 20 seconds and releases it on finish, error, disconnect, or iterator return.

### `media`

The task string is `media:{modelId}`. Routes come from enabled `media` vendor rows. `submitMediaWithCapacity` acquires, saves the selection, claims `submitting`, then calls the adapter.

**Add Replicate next to WaveSpeed.**

1. Implement `MediaEngineProvider` for Replicate: submit, poll, cancel, and price. On a network failure after POST, throw `MediaSubmissionUnknownError`. A definite HTTP 429 or 5xx should be an account failure. A validation error should be a client failure.
2. Register the class in `features/media-engine/providers/factory.ts` under adapter `replicate`.
3. In `registry.ts`, add provider `replicate`, adapter `replicate`, task `media`, and account `replicate:primary` with `REPLICATE_API_TOKEN`.
4. Insert an enabled media vendor named `replicate` with adapter `replicate`. Bind each model with Replicate's model id as `apiName` and a priority. Lower priority is tried first.
5. Map that model's payload to Replicate's input shape. A model bound only to WaveSpeed never reaches Replicate.

Both vendors share the user's 5-job media cap. They do not share account lanes.

### `video.export`

There is one provider, `remotion`, strategy `spread`. Each account is one deployed Lambda: region, function name, and serve URL. The render service acquires the user slot, then the Remotion account, saves both, and only then calls `createRemoteRender`. Later progress, cancel, and download use the saved account.

**Add `eu-central-1`.** Deploy the function and site there. Add an account:

```ts
account("remotion:eu-central-1", { ...DEFAULT_CIRCUIT, maxConcurrency: 2 }, {
  remotion: () => ({
    region: "eu-central-1",
    functionName: process.env.REMOTION_EU_FUNCTION_NAME ?? "",
    serveUrl: process.env.REMOTION_EU_SERVE_URL ?? "",
  }),
})
```

Give it its own env vars. Do not reuse `REMOTION_FUNCTION_NAME`; that belongs to `remotion:primary`. An empty function name or serve URL hides the account. Spread prefers the lane with more free slots. A job that lands in Frankfurt keeps polling Frankfurt.
