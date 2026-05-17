import { lazy, Suspense } from 'react'
import '@cyntler/react-doc-viewer/dist/index.css'

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
    <div className="h-full w-full">
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading document…</div>}>
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
      className='bg-black!'
    />
  )
}
