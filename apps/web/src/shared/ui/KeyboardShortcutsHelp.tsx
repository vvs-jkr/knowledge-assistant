import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SHORTCUTS = [
  { key: 'g n', description: 'Перейти к заметкам' },
  { key: 'g h', description: 'Перейти к здоровью' },
  { key: 'g w', description: 'Перейти к тренировкам' },
  { key: '[', description: 'Свернуть или развернуть меню' },
  { key: '/', description: 'Фокус на поиске в заметках' },
  { key: '⌘S / Ctrl+S', description: 'Сохранить заметку' },
  { key: 'Esc', description: 'Отменить редактирование' },
  { key: '?', description: 'Показать эту справку' },
]

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Горячие клавиши</DialogTitle>
        </DialogHeader>
        <div className="space-y-0.5">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{description}</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
