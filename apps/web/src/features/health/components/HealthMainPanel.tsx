import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HealthExport } from '@/features/health/components/HealthExport'
import { HealthRecordDetail } from '@/features/health/components/HealthRecordDetail'
import { LabBatchDetail } from '@/features/health/components/LabBatchDetail'
import { MetricsChart } from '@/features/health/components/MetricsChart'
import { MetricsTable } from '@/features/health/components/MetricsTable'
import { useHealthStore } from '@/features/health/store/health.store'
import { useEffect, useState } from 'react'

export function HealthMainPanel() {
  const activeSection = useHealthStore((s) => s.activeSection)
  const selectedRecordId = useHealthStore((s) => s.selectedRecordId)
  const selectedMetric = useHealthStore((s) => s.selectedMetric)
  const dateRange = useHealthStore((s) => s.dateRange)
  const [activeTab, setActiveTab] = useState<'record' | 'table' | 'charts'>('table')

  const params = {
    ...(selectedMetric ? { metric_name: selectedMetric } : {}),
    ...(dateRange?.from ? { from: dateRange.from } : {}),
    ...(dateRange?.to ? { to: dateRange.to } : {}),
    ...(activeSection === 'inbody' ? { kind: 'inbody' as const } : {}),
  }

  useEffect(() => {
    if (activeSection === 'inbody' && selectedRecordId) {
      setActiveTab('record')
    }
  }, [activeSection, selectedRecordId])

  if (activeSection === 'labs') {
    return <LabBatchDetail />
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">Показатели здоровья</span>
        <HealthExport params={params} />
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'record' | 'table' | 'charts')}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-2 w-fit shrink-0">
          <TabsTrigger value="record" disabled={!selectedRecordId}>
            Запись
          </TabsTrigger>
          <TabsTrigger value="table">Таблица</TabsTrigger>
          <TabsTrigger value="charts">Графики</TabsTrigger>
        </TabsList>
        <TabsContent value="record" className="mt-0 flex-1 overflow-hidden">
          <HealthRecordDetail />
        </TabsContent>
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
