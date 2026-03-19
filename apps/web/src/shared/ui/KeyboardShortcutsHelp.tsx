import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SHORTCUTS = [
  { key: 'g n', description: 'Go to Notes' },
  { key: 'g h', description: 'Go to Health' },
  { key: 'g w', description: 'Go to Workouts' },
  { key: '[', description: 'Toggle sidebar' },
  { key: '/', description: 'Focus search (Notes)' },
  { key: '⌘S / Ctrl+S', description: 'Save note' },
  { key: 'Esc', description: 'Cancel editing' },
  { key: '?', description: 'Show this help' },
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
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
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
