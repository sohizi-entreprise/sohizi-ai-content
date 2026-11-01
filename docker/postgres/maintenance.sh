#!/bin/sh
set -eu

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

BACKUP_DB="${BACKUP_DB:-sohizi_prod}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-21600}"
CLEANUP_INTERVAL_SECONDS="${CLEANUP_INTERVAL_SECONDS:-3600}"
BACKUP_LOCAL_RETENTION_DAYS="${BACKUP_LOCAL_RETENTION_DAYS:-7}"
BACKUP_R2_RETENTION_DAYS="${BACKUP_R2_RETENTION_DAYS:-30}"
INNGEST_DBS="${INNGEST_DBS:-inngest_rc inngest_prod}"

log() {
  printf '[%s] [pg-maintenance] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

wait_for_postgres() {
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; do
    log "Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
    sleep 3
  done
}

ensure_extensions() {
  for db in sohizi_rc sohizi_prod; do
    exists="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null || true)"
    if [ "$exists" = "1" ]; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -tAc "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" >/dev/null 2>&1 && \
        log "Ensured pg_stat_statements extension in '${db}'" || \
        log "WARN: Could not enable pg_stat_statements in '${db}' (ensure shared_preload_libraries=pg_stat_statements is set)"
    fi
  done
}

run_backup() {
  mkdir -p "$BACKUP_DIR"
  ts="$(date -u '+%Y%m%dT%H%M%SZ')"
  dump_file="${BACKUP_DIR}/${BACKUP_DB}_${ts}.dump"
  tmp_file="${dump_file}.tmp"

  log "Starting pg_dump for database '${BACKUP_DB}' -> ${dump_file}"
  if ! pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$BACKUP_DB" -Fc -Z 6 -f "$tmp_file"; then
    log "ERROR: pg_dump failed for '${BACKUP_DB}'"
    rm -f "$tmp_file"
    return 1
  fi

  if ! pg_restore --list "$tmp_file" >/dev/null 2>&1; then
    log "ERROR: pg_restore verification failed for '${tmp_file}'"
    rm -f "$tmp_file"
    return 1
  fi

  mv "$tmp_file" "$dump_file"
  log "Local backup verified: ${dump_file} ($(du -h "$dump_file" | cut -f1))"

  # Upload to Cloudflare R2 if credentials are configured
  if [ -n "${R2_ENDPOINT:-}" ] && [ -n "${R2_BUCKET_NAME:-}" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    r2_key="backups/postgres/$(basename "$dump_file")"
    log "Uploading backup to Cloudflare R2: s3://${R2_BUCKET_NAME}/${r2_key}"
    if aws s3 cp "$dump_file" "s3://${R2_BUCKET_NAME}/${r2_key}" --endpoint-url "$R2_ENDPOINT" --only-show-errors; then
      log "R2 upload complete: s3://${R2_BUCKET_NAME}/${r2_key}"
      prune_r2_backups || log "WARN: Failed to prune old R2 backups"
    else
      log "ERROR: Failed to upload backup to Cloudflare R2"
    fi
  else
    log "R2 credentials not fully set; skipping offsite R2 upload"
  fi

  # Prune local backups older than retention window
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${BACKUP_DB}_*.dump" -mtime "+${BACKUP_LOCAL_RETENTION_DAYS}" -print -delete || true
}

prune_r2_backups() {
  cutoff_epoch="$( expr "$(date -u +%s)" - \( "$BACKUP_R2_RETENTION_DAYS" \* 86400 \) )"
  aws s3api list-objects-v2 \
    --bucket "$R2_BUCKET_NAME" \
    --prefix "backups/postgres/${BACKUP_DB}_" \
    --endpoint-url "$R2_ENDPOINT" \
    --query "Contents[].Key" \
    --output text 2>/dev/null | tr '\t' '\n' | while IFS= read -r key; do
      [ -z "$key" ] || [ "$key" = "None" ] && continue
      # Extract YYYYMMDDTHHMMSSZ timestamp from filename
      ts_part="$(basename "$key" .dump | sed "s/^${BACKUP_DB}_//")"
      obj_epoch="$(date -u -d "$(printf '%s' "$ts_part" | sed 's/\(....\)\(..\)\(..\)T\(..\)\(..\)\(..\)Z/\1-\2-\3 \4:\5:\6/')" +%s 2>/dev/null || echo "")"
      if [ -n "$obj_epoch" ] && [ "$obj_epoch" -lt "$cutoff_epoch" ]; then
        log "Pruning expired R2 backup: s3://${R2_BUCKET_NAME}/${key}"
        aws s3 rm "s3://${R2_BUCKET_NAME}/${key}" --endpoint-url "$R2_ENDPOINT" --only-show-errors || true
      fi
    done
}

cleanup_inngest_db() {
  db="$1"
  exists="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null || true)"
  if [ "$exists" != "1" ]; then
    return 0
  fi

  has_tables="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trace_runs'" 2>/dev/null || true)"
  if [ "$has_tables" != "1" ]; then
    log "Database '${db}' has no Inngest schema yet; skipping cleanup"
    return 0
  fi

  log "Pruning finished Inngest records older than 24h in '${db}'"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- 1. Prune finished v1 CQRS runs older than 24h
WITH finished_v1 AS (
  SELECT run_id
  FROM public.function_finishes
  WHERE created_at < NOW() - INTERVAL '24 hours'
),
del_history AS (
  DELETE FROM public.history
  WHERE run_id IN (SELECT run_id FROM finished_v1)
),
del_runs AS (
  DELETE FROM public.function_runs
  WHERE run_id IN (SELECT run_id FROM finished_v1)
)
DELETE FROM public.function_finishes
WHERE run_id IN (SELECT run_id FROM finished_v1);

-- 2. Prune finished v2 trace_runs, traces, spans, and event_batches older than 24h
-- Terminal status codes in Inngest: 50=Overflowed, 300=Completed, 400=Failed, 500=Cancelled, 600=Skipped
WITH finished_v2 AS (
  SELECT run_id
  FROM public.trace_runs
  WHERE status IN (50, 300, 400, 500, 600)
    AND ended_at > 0
    AND ended_at < (EXTRACT(EPOCH FROM (NOW() - INTERVAL '24 hours')) * 1000)::BIGINT
),
del_traces AS (
  DELETE FROM public.traces
  WHERE run_id IN (SELECT run_id FROM finished_v2)
),
del_spans AS (
  DELETE FROM public.spans
  WHERE run_id IN (SELECT TRIM(run_id) FROM finished_v2)
),
del_batches AS (
  DELETE FROM public.event_batches
  WHERE run_id IN (SELECT run_id FROM finished_v2)
)
DELETE FROM public.trace_runs
WHERE run_id IN (SELECT run_id FROM finished_v2);

-- 3. Prune orphaned finished spans and events older than 24h with no active runs
DELETE FROM public.spans
WHERE end_time < NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.trace_runs tr
    WHERE TRIM(tr.run_id) = spans.run_id
      AND tr.status NOT IN (50, 300, 400, 500, 600)
  );

DELETE FROM public.events e
WHERE e.received_at < NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.function_runs r WHERE r.event_id = e.internal_id
  );

-- 4. Keep only the latest 5 queue snapshots
DELETE FROM public.queue_snapshot_chunks
WHERE snapshot_id NOT IN (
  SELECT DISTINCT snapshot_id
  FROM public.queue_snapshot_chunks
  ORDER BY snapshot_id DESC
  LIMIT 5
);

COMMIT;

VACUUM (ANALYZE)
  public.function_finishes,
  public.function_runs,
  public.history,
  public.trace_runs,
  public.traces,
  public.spans,
  public.event_batches,
  public.events,
  public.queue_snapshot_chunks;
SQL
}

run_inngest_cleanup() {
  for db in $INNGEST_DBS; do
    cleanup_inngest_db "$db" || log "WARN: Cleanup failed for '${db}'"
  done
}

main() {
  if ! command -v aws >/dev/null 2>&1; then
    log "Installing aws-cli..."
    apk add --no-cache aws-cli >/dev/null
  fi

  wait_for_postgres
  ensure_extensions

  last_backup=0
  last_cleanup=0

  while true; do
    now="$(date -u +%s)"

    if [ "$(expr "$now" - "$last_cleanup")" -ge "$CLEANUP_INTERVAL_SECONDS" ]; then
      run_inngest_cleanup
      last_cleanup="$now"
    fi

    if [ "$(expr "$now" - "$last_backup")" -ge "$BACKUP_INTERVAL_SECONDS" ]; then
      run_backup || log "WARN: Backup cycle encountered an error"
      last_backup="$now"
    fi

    sleep 60
  done
}

main "$@"
