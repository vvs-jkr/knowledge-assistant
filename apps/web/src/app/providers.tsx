import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Skip if hook-level or per-call onError already handles this mutation's errors
      type WithMutateOptions = typeof mutation & { mutateOptions?: { onError?: unknown } }
      const m = mutation as WithMutateOptions
      if (m.options.onError ?? m.mutateOptions?.onError) return

      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (error instanceof Error ? error.message : 'Something went wrong')
      toast.error(msg)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 минут
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>{children}</ErrorBoundary>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
