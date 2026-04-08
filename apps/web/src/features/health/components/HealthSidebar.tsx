import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { HealthRecordList } from '@/features/health/components/HealthRecordList'
import { HealthUpload } from '@/features/health/components/HealthUpload'
import { LabBatchList } from '@/features/health/components/LabBatchList'
import { useHealthStore } from '@/features/health/store/health.store'

export function HealthSidebar() {
  const activeSection = useHealthStore((s) => s.activeSection)
  const setActiveSection = useHealthStore((s) => s.setActiveSection)

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2 p-3 pb-0">
        <Button
          type="button"
          size="sm"
          variant={activeSection === 'inbody' ? 'default' : 'outline'}
          onClick={() => setActiveSection('inbody')}
        >
          InBody
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeSection === 'labs' ? 'default' : 'outline'}
          onClick={() => setActiveSection('labs')}
        >
          Анализы
        </Button>
      </div>
      <div className="shrink-0 p-3">
        <HealthUpload />
      </div>
      <Separator />
      {activeSection === 'inbody' ? <HealthRecordList /> : <LabBatchList />}
    </div>
  )
}
