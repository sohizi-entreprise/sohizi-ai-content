import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

export function getContext() {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError: (error) => {
            toast.error(error?.message || "An error occurred")
        },
        onSuccess: async (_data, _variables, _onMutateResult, mutation) => {
            const keys = (mutation?.meta)?.invalidateQueries as string[][] | undefined
            if (!keys) {
                return
            }
            await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })))
        },
    }),
    defaultOptions: {
      queries: {
          refetchOnWindowFocus: false,
          retry: false,
      },
      mutations: {
          retry: false,
      },
    }
  })
  return {
    queryClient,
  }
}

export function Provider({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
