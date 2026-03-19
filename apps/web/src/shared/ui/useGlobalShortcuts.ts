import { isInputFocused } from '@/shared/lib/keyboard'
import { useUiStore } from '@/shared/store/ui.store'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Callbacks = {
  toggleSidebar: () => void
  toggleHelp: () => void
  navigate: ReturnType<typeof useNavigate>
  pendingG: { current: boolean }
  gTimer: { current: ReturnType<typeof setTimeout> | null }
}

function handleKey(e: KeyboardEvent, cb: Callbacks): void {
  const { toggleSidebar, toggleHelp, navigate, pendingG, gTimer } = cb

  if (e.key === '[') {
    e.preventDefault()
    toggleSidebar()
    return
  }
  if (e.key === '?') {
    e.preventDefault()
    toggleHelp()
    return
  }
  if (e.key === 'g') {
    pendingG.current = true
    if (gTimer.current) clearTimeout(gTimer.current)
    gTimer.current = setTimeout(() => {
      pendingG.current = false
    }, 1000)
    return
  }
  if (pendingG.current) {
    pendingG.current = false
    if (gTimer.current) clearTimeout(gTimer.current)
    e.preventDefault()
    if (e.key === 'n') navigate('/notes')
    else if (e.key === 'h') navigate('/health')
    else if (e.key === 'w') navigate('/workouts')
  }
}

/** Global keyboard shortcuts. Returns help dialog state. */
export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [helpOpen, setHelpOpen] = useState(false)
  const pendingGRef = useRef(false)
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cb: Callbacks = {
      toggleSidebar,
      toggleHelp: () => setHelpOpen((prev) => !prev),
      navigate,
      pendingG: pendingGRef,
      gTimer: gTimerRef,
    }

    const handler = (e: KeyboardEvent) => {
      if (isInputFocused() || e.ctrlKey || e.metaKey || e.altKey) return
      handleKey(e, cb)
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (gTimerRef.current) clearTimeout(gTimerRef.current)
    }
  }, [navigate, toggleSidebar])

  return { helpOpen, setHelpOpen }
}
