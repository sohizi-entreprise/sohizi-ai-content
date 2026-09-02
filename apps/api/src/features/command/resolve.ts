export const COMMAND_MENTION_REGEX = /#\[command=([^\]]+)\]/g

export function extractCommandNames(text: string): string[] {
  const names: string[] = []
  const pattern = new RegExp(
    COMMAND_MENTION_REGEX.source,
    COMMAND_MENTION_REGEX.flags,
  )

  for (const match of text.matchAll(pattern)) {
    const name = match[1]?.trim()
    if (name) {
      names.push(name)
    }
  }

  return names
}

export function buildInvokedCommandsPrompt(
  commands: Array<{ name: string; action: string }>,
): string {
  if (commands.length === 0) {
    return ''
  }

  const lines = commands.map(
    (command, index) => `${index + 1}. /${command.name}: ${command.action}`,
  )

  return `
<invoked-commands>
The user invoked these slash commands. Follow their instructions:
${lines.join('\n')}
</invoked-commands>
`.trim()
}
