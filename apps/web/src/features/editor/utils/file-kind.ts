export function defaultFormatForType(type: string): string {
  switch (type) {
    case "image":
    case "video":
    case "audio":
      return "file"
    case "video-editor":
      return "json"
    default:
      return "markdown"
  }
}
