import { Separator } from '@/components/ui/separator'
import { HealthRecordList } from '@/features/health/components/HealthRecordList'
import { HealthUpload } from '@/features/health/components/HealthUpload'

export function HealthSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <HealthUpload />
      </div>
      <Separator />
      <HealthRecordList />
    </div>
  )
}
