export function cleanMediaType(mediaType: string, url: string) {
  const testType = /^(image|video|audio)\//
  if (testType.test(mediaType)) {
    return mediaType
  }

  const lastPart = url.split('/').pop()?.split('.').pop()

  switch (mediaType) {
    case 'image':
      return `image/${lastPart || 'png'}`
    case 'video':
      return `video/${lastPart || 'mp4'}`
    case 'audio':
      return `audio/${lastPart || 'mp3'}`
    default:
      return `application/${lastPart || 'octet-stream'}`
  }
}
