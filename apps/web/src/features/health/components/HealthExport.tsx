import { Button } from '@/components/ui/button'
import { exportHealthMarkdown } from '@/features/health/api/health.api'
import type { MetricsQuery } from '@/shared/schemas/health.schema'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface HealthExportProps {
  params?: MetricsQuery
}

export function HealthExport({ params }: HealthExportProps) {
  const [isPending, setIsPending] = useState(false)

  const handleExport = () => {
    setIsPending(true)
    exportHealthMarkdown(params)
      .then(() => toast.success('Exported to Markdown'))
      .catch(() => toast.error('Export failed'))
      .finally(() => setIsPending(false))
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
      <Download className="h-4 w-4" />
      {isPending ? 'Exporting…' : 'Export .md'}
    </Button>
  )
}
