import ReactPlayer from 'react-player'
import { AssetContent, AssetType } from '../../types'
import { DocumentViewer } from './document-viewer'

type Props = AssetContent

export default function AssetViewer(props: Props) {
  const { type, url, storageKey } = props

  switch (type) {
    case 'image':
      return <ImageViewer uri={getOptimizedUrl(type, url, storageKey)} name={props.name} />
    case 'document':
      return <DocumentViewer uri={url}/>
    case 'video':
    case 'audio':
      return <VideoAndAudioViewer url={url} />
    default:
      return null
  }
}

function ImageViewer({ uri, name }: { uri: string; name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black/20 p-4">
      <img src={uri} alt={name} className="max-h-full max-w-full object-contain" />
    </div>
  )
}

function VideoAndAudioViewer({ url }: { url: string }) {
  return (
    <div className="h-full w-full">
      <ReactPlayer src={url} controls width="100%" height="100%" />
    </div>
  )
}

function getOptimizedUrl(type: AssetType, url: string, storageKey: string) {
  if (type === 'image') {
    const cdnUrl = import.meta.env.VITE_MEDIA_CDN_URL
    if (!cdnUrl) {
      throw new Error('VITE_MEDIA_CDN_URL is not set')
    }
    const transformation = 'width=680,format=webp,quality=80'
    return `${cdnUrl.replace(/\/$/, '')}/${transformation}/${storageKey}`
  }
  return url
}
