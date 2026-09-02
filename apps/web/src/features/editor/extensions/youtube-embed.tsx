import { Youtube } from "@tiptap/extension-youtube"

export const YoutubeEmbed = Youtube.configure({
  width: 640,
  height: 360,
  nocookie: true,
})

export { isValidYoutubeUrl } from "@tiptap/extension-youtube"
