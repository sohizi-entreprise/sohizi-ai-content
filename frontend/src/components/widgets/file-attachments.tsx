export type AttachedFile =
  | {
      status: 'pending'
      id: string
      type: string
      preview?: string
    }
  | {
      status: 'uploaded'
      id: string
      type: string
      preview?: string
      url: string
    }
  | {
      status: 'failed'
      id: string
      type: string
      preview?: string
      error: string
    }
