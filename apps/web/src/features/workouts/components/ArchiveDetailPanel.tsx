import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useArchivedWorkout,
  useUpdateArchivedWorkout,
} from '@/features/workouts/api/workouts.api'
import type { ArchiveReviewStatus } from '@/shared/schemas/workouts.schema'
import { useEffect, useState } from 'react'

const REVIEW_STATUS_OPTIONS: { value: ArchiveReviewStatus; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'needs_review', label: 'Нужно проверить' },
  { value: 'reviewed', label: 'Проверено' },
  { value: 'corrected', label: 'Исправлено' },
]

export function ArchiveDetailPanel({ archiveWorkoutId }: { archiveWorkoutId: string }) {
  const { data, isLoading } = useArchivedWorkout(archiveWorkoutId)
  const updateArchive = useUpdateArchivedWorkout()

  const [title, setTitle] = useState('')
  const [reviewStatus, setReviewStatus] = useState<ArchiveReviewStatus>('raw')
  const [rawText, setRawText] = useState('')
  const [correctedText, setCorrectedText] = useState('')

  useEffect(() => {
    if (!data) return
    setTitle(data.title)
    setReviewStatus(data.review_status)
    setRawText(data.raw_ocr_text)
    setCorrectedText(data.corrected_text)
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const handleSave = async () => {
    await updateArchive.mutateAsync({
      id: data.id,
      title,
      review_status: reviewStatus,
      raw_ocr_text: rawText,
      corrected_text: correctedText,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{data.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.archive_date}</p>
          </div>
          <Badge variant="outline">{data.source_system}</Badge>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div className="space-y-2">
          <label htmlFor="archive-title" className="text-sm font-medium">
            Название
          </label>
          <Input id="archive-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label htmlFor="archive-status" className="text-sm font-medium">
            Статус ревью
          </label>
          <select
            id="archive-status"
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as ArchiveReviewStatus)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="archive-raw" className="text-sm font-medium">
            Raw OCR
          </label>
          <Textarea
            id="archive-raw"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[180px]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="archive-corrected" className="text-sm font-medium">
            Исправленный текст
          </label>
          <Textarea
            id="archive-corrected"
            value={correctedText}
            onChange={(e) => setCorrectedText(e.target.value)}
            className="min-h-[220px]"
          />
        </div>

        {data.images.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Файлы карточки</h3>
            <div className="space-y-1">
              {data.images.map((image) => (
                <div key={image.id} className="rounded-md border px-3 py-2 text-sm">
                  {image.file_path}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.sections.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Секции</h3>
            <div className="space-y-2">
              {data.sections.map((section) => (
                <div key={section.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {section.section_type_raw && <Badge variant="secondary">{section.section_type_raw}</Badge>}
                    {section.section_type_normalized && (
                      <Badge variant="outline">{section.section_type_normalized}</Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {section.content_corrected || section.content_raw || 'Пустая секция'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <Button onClick={() => void handleSave()} disabled={updateArchive.isPending}>
          {updateArchive.isPending ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  )
}
