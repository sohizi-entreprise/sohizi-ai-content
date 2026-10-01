# remotion-package

Lambda site for video-editor export. The composition lives in
`@sohizi/video-composition`; this package is the Remotion entry that gets
bundled and uploaded to S3.

## Deploy

AWS credentials (`REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`)
must be in the environment. Deploy the function once per Remotion version, then
the site whenever the composition changes:

```bash
bun run lambda:functions
bun run lambda:site
```

The function timeout is 900 seconds (AWS maximum). After `sites create`, copy
the printed Serve URL into the API as `REMOTION_SERVE_URL`, and set
`REMOTION_FUNCTION_NAME` / `REMOTION_AWS_REGION` to match the deployed function.

Exports launch at most 8 renderer Lambdas (`REMOTION_CONCURRENCY`) so a new
account's concurrency quota is not exhausted. Raise that value after AWS
approves a higher Lambda concurrency limit.
