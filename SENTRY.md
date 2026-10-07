# Sentry setup

The API, web app, and site use separate Sentry projects. Configure each app's
local `.env` with its own `SENTRY_DSN`. Set `SENTRY_ENVIRONMENT` explicitly to
`local`, `rc`, or `prod`; `NODE_ENV` does not select the Sentry environment.
`SENTRY_RELEASE` should be the deployed commit SHA.

Local errors, traces, and structured logs are disabled by default. Set
`SENTRY_LOCAL_ENABLED=true` in an app's `.env` to test that app's telemetry.
Leave the variable unset or set it to `false` to disable local telemetry.
RC and production always send telemetry when their DSN is configured.
Trace sampling is 100% in local and RC and 10% in production.

The current RC deployment uses the three DSNs in the `ENV_FILE_RC` GitHub Actions variable:
`API_SENTRY_DSN`, `WEB_SENTRY_DSN`, and `SITE_SENTRY_DSN`. Its workflow sets
`SENTRY_ENVIRONMENT=rc` and `SENTRY_RELEASE` to the commit SHA. For production,
set `SENTRY_ENVIRONMENT=prod` in the production deployment environment and pass
the same release SHA to the image build and container.

Set GitHub Actions variables `SENTRY_ORG`, `SENTRY_PROJECT_WEB`, and
`SENTRY_PROJECT_SITE` to the Sentry organization and project slugs. Set the
`SENTRY_AUTH_TOKEN` secret to a token permitted to upload source maps. The token
is mounted only during the web and site image builds. Public browser config
contains the DSN, environment, release, and sample rate; it is read at runtime
so an image can be promoted from RC to production.

The API's Bun executable includes a source map. Sentry and Langfuse retain
separate trace pipelines; request and job IDs are attached to API events to
connect investigations. Session Replay and custom metrics are not configured.
