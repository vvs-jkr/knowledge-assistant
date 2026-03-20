import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HealthExport } from '@/features/health/components/HealthExport'
import { MetricsChart } from '@/features/health/components/MetricsChart'
import { MetricsTable } from '@/features/health/components/MetricsTable'
import { useHealthStore } from '@/features/health/store/health.store'

export function HealthMainPanel() {
  const selectedMetric = useHealthStore((s) => s.selectedMetric)
  const dateRange = useHealthStore((s) => s.dateRange)

  const params = {
    ...(selectedMetric ? { metric_name: selectedMetric } : {}),
    ...(dateRange?.from ? { from: dateRange.from } : {}),
    ...(dateRange?.to ? { to: dateRange.to } : {}),
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">Health Metrics</span>
        <HealthExport params={params} />
      </div>
      <Tabs defaultValue="table" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 w-fit shrink-0">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-0 flex-1 overflow-auto">
          <MetricsTable params={params} />
        </TabsContent>
        <TabsContent value="charts" className="mt-0 flex-1 overflow-auto">
          <MetricsChart params={params} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
