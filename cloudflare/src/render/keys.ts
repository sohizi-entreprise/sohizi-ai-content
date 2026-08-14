/** R2 layout for a render job. Everything lives under `renders/<projectId>/`. */
export function renderKeys(projectId: string, jobId: string) {
  const prefix = `renders/${projectId}/${jobId}`
  return {
    input: `${prefix}.input.json`,
    progress: `${prefix}.progress.json`,
    output: `${prefix}.mp4`,
  }
}
