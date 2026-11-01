import "dotenv/config"
import * as Sentry from "@sentry/bun"
import { drizzle } from "drizzle-orm/node-postgres"
import pg, { Pool } from "pg"
import { isSentrySpanRecording } from "@/sentry"
import * as schema from "./schema"

const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(
  process.env.SENTRY_SLOW_DB_MS ?? "100",
  10,
)

const IGNORED_SQL_RE =
  /^\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT\s+\S+|RELEASE\s+SAVEPOINT\s+\S+|SET\s+LOCAL\s+|SELECT\s+1)\s*;?\s*$/i

const IDENTIFIER_PART = `(?:"[^"]*"|'[^']*'|[^\\s(,;).'"]+)`
const TABLE_NAME_PART = `${IDENTIFIER_PART}(?:\\.${IDENTIFIER_PART})*`
const DML_SUMMARY_RE = new RegExp(
  `^\\s*(?:(?<insert>INSERT)\\s+INTO\\s+(?<insertTable>${TABLE_NAME_PART})|(?<update>UPDATE)\\s+(?<updateTable>${TABLE_NAME_PART})|(?<delete>DELETE)\\s+FROM\\s+(?<deleteTable>${TABLE_NAME_PART}))`,
  "i",
)
const SELECT_FROM_RE = new RegExp(
  `\\bFROM\\s+(?<table>${TABLE_NAME_PART})`,
  "i",
)

export function sanitizeSqlQuery(rawSql: string): {
  queryText: string
  querySummary: string
} {
  const sanitized = rawSql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|\\'|[^'])*'/g, "?")
    .replace(/\b(?:TRUE|FALSE)\b/gi, "?")
    .replace(/(?<![$?@\w])-?\b\d+(?:\.\d+)?\b/g, "?")
    .replace(/\bIN\s*\(\s*(?:\?\s*,\s*)*\?\s*\)/gi, "IN (?)")
    .replace(/\bIN\s*\(\s*(?:\$\d+\s*,\s*)*\$\d+\s*\)/gi, "IN ($?)")
    .replace(/;\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()

  const queryText =
    sanitized.length > 1024 ? `${sanitized.slice(0, 1024)}...` : sanitized

  const dmlMatch = DML_SUMMARY_RE.exec(sanitized)
  if (dmlMatch?.groups) {
    if (dmlMatch.groups.insert && dmlMatch.groups.insertTable) {
      return {
        queryText,
        querySummary: `INSERT ${dmlMatch.groups.insertTable}`,
      }
    }
    if (dmlMatch.groups.update && dmlMatch.groups.updateTable) {
      return {
        queryText,
        querySummary: `UPDATE ${dmlMatch.groups.updateTable}`,
      }
    }
    if (dmlMatch.groups.delete && dmlMatch.groups.deleteTable) {
      return {
        queryText,
        querySummary: `DELETE ${dmlMatch.groups.deleteTable}`,
      }
    }
  }

  if (/^\s*\(?\s*SELECT\b/i.test(sanitized)) {
    const fromMatch = SELECT_FROM_RE.exec(sanitized)
    return {
      queryText,
      querySummary: fromMatch?.groups?.table
        ? `SELECT ${fromMatch.groups.table}`
        : "SELECT",
    }
  }

  const firstVerb = sanitized.split(/\s+/, 1)[0]?.toUpperCase() || "pg.query"
  return { queryText, querySummary: firstVerb.slice(0, 64) }
}

const PATCHED_SYMBOL = Symbol.for("sohizi.pg.sentry.patched")

function extractRawSqlText(config: unknown): string | undefined {
  if (typeof config === "string") return config
  if (
    config &&
    typeof config === "object" &&
    "text" in config &&
    typeof (config as { text?: unknown }).text === "string"
  ) {
    return (config as { text: string }).text
  }
  return undefined
}

function instrumentPgClient(): void {
  const proto = pg.Client.prototype as unknown as Record<
    string | symbol,
    unknown
  >
  if (proto[PATCHED_SYMBOL]) return
  proto[PATCHED_SYMBOL] = true

  const originalQuery = pg.Client.prototype.query

  pg.Client.prototype.query = function patchedQuery(
    this: pg.Client & {
      connectionParameters?: {
        database?: string
        host?: string
        port?: number
      }
    },
    config: unknown,
    values?: unknown,
    callback?: unknown,
  ) {
    // Fast-path: zero allocations or regex work when no Sentry trace is sampled
    if (!isSentrySpanRecording()) {
      return (originalQuery as (...args: unknown[]) => unknown).call(
        this,
        config,
        values,
        callback,
      )
    }

    const rawSql = extractRawSqlText(config)
    if (!rawSql || IGNORED_SQL_RE.test(rawSql)) {
      return (originalQuery as (...args: unknown[]) => unknown).call(
        this,
        config,
        values,
        callback,
      )
    }

    const { queryText, querySummary } = sanitizeSqlQuery(rawSql)
    const connParams = this.connectionParameters
    const startMs = performance.now()

    const span = Sentry.startInactiveSpan({
      name: querySummary,
      op: "db",
      attributes: {
        "sentry.op": "db",
        "sentry.origin": "auto.db.postgres",
        "sentry.kind": "client",
        "db.system.name": "postgresql",
        "db.system": "postgresql",
        "db.namespace": connParams?.database,
        "server.address": connParams?.host,
        "server.port": connParams?.port,
        "db.query.text": queryText,
        "db.query.summary": querySummary,
      },
    })

    let ended = false
    const finishSpan = (err?: unknown, rowCount?: number | null) => {
      if (ended) return
      ended = true
      const durationMs = performance.now() - startMs
      if (typeof rowCount === "number") {
        span.setAttribute("db.response.returned_rows", rowCount)
      }
      if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
        span.setAttribute("db.slow_query", true)
      }
      if (err) {
        span.setStatus({ code: 2, message: "internal_error" })
      } else {
        span.setStatus({ code: 1 })
      }
      span.end()
    }

    // 1. Callback style (used internally by pg.Pool.prototype.query)
    if (typeof values === "function") {
      const origCb = values as (
        err: Error | null,
        res?: { rowCount?: number | null },
      ) => void
      const wrappedCb = (
        err: Error | null,
        res?: { rowCount?: number | null },
      ) => {
        finishSpan(err, res?.rowCount)
        origCb(err, res)
      }
      try {
        return (originalQuery as (...args: unknown[]) => unknown).call(
          this,
          config,
          wrappedCb,
        )
      } catch (err) {
        finishSpan(err)
        throw err
      }
    }

    if (typeof callback === "function") {
      const origCb = callback as (
        err: Error | null,
        res?: { rowCount?: number | null },
      ) => void
      const wrappedCb = (
        err: Error | null,
        res?: { rowCount?: number | null },
      ) => {
        finishSpan(err, res?.rowCount)
        origCb(err, res)
      }
      try {
        return (originalQuery as (...args: unknown[]) => unknown).call(
          this,
          config,
          values,
          wrappedCb,
        )
      } catch (err) {
        finishSpan(err)
        throw err
      }
    }

    // 2. Submittable Query object with its own .callback (e.g. new pg.Query)
    if (
      config &&
      typeof config === "object" &&
      "submit" in config &&
      typeof (config as { submit?: unknown }).submit === "function" &&
      typeof (config as { callback?: unknown }).callback === "function"
    ) {
      const queryObj = config as {
        callback: (
          err: Error | null,
          res?: { rowCount?: number | null },
        ) => void
      }
      const origCb = queryObj.callback
      queryObj.callback = (err, res) => {
        finishSpan(err, res?.rowCount)
        origCb(err, res)
      }
    }

    try {
      const result = (originalQuery as (...args: unknown[]) => unknown).call(
        this,
        config,
        values,
        callback,
      )

      // 3. Promise return style (used by checked-out PoolClient in transactions)
      if (result && typeof (result as Promise<unknown>).then === "function") {
        return (result as Promise<{ rowCount?: number | null }>).then(
          (res) => {
            finishSpan(undefined, res?.rowCount)
            return res
          },
          (err) => {
            finishSpan(err)
            throw err
          },
        )
      }

      // 4. EventEmitter return style (streaming Submittable without callback)
      if (result && typeof (result as { once?: unknown }).once === "function") {
        const emitter = result as {
          once: (event: string, listener: (...args: unknown[]) => void) => void
        }
        emitter.once("end", (res: unknown) =>
          finishSpan(
            undefined,
            (res as { rowCount?: number | null } | undefined)?.rowCount,
          ),
        )
        emitter.once("error", (err: unknown) => finishSpan(err))
        return result
      }

      finishSpan()
      return result
    } catch (err) {
      finishSpan(err)
      throw err
    }
  } as typeof pg.Client.prototype.query
}

instrumentPgClient()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: Number.parseInt(process.env.DB_POOL_MAX ?? "20", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const db = drizzle({ client: pool, schema: { ...schema } })
export { pool }
