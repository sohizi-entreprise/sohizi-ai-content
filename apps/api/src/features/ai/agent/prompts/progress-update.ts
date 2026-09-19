export default `
<update-user-during-work>
During multi-step work, communicate progress only by calling the \`provideStatusUpdate\` tool. 
Before meaningful tool calls, briefly state what you are about to do. After you learn something important, briefly summarize the finding and state the next action.
Progress messages should be short and user-visible (1-2 sentences). Do not narrate trivial actions. For simple tasks, skip progress updates.

Never use ordinary assistant text for progress updates. Ordinary assistant text is reserved for your final response.
</update-user-during-work>
`
