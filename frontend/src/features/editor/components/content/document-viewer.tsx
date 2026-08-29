import { Suspense, lazy } from 'react'
import '@cyntler/react-doc-viewer/dist/index.css'
import { AssetSkeleton } from '@/components/ui/content-skeletons'

const DocViewer = lazy(() =>
  import('@cyntler/react-doc-viewer').then((module) => ({
    default: module.default,
  })),
)

type Props = {
  uri: string
}

export function DocumentViewer({ uri }: Props) {
  return (
    <div className="h-full w-full [&_#pdf-controls]:hidden!">
      <Suspense fallback={<AssetSkeleton />}>
        <DocViewerLazy uri={uri} />
      </Suspense>
    </div>
  )
}

function DocViewerLazy({ uri }: Props) {
  return (
    <DocViewer
      documents={[{ uri }]}
      config={{
        header: {
          disableHeader: true,
        },
      }}
      className="bg-surface!"
    />
  )
}
