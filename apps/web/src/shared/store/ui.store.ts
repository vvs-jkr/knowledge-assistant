import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: getInitialCollapsed(),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      try {
        localStorage.setItem('sidebar-collapsed', String(next))
      } catch {
        // ignore storage errors
      }
      return { sidebarCollapsed: next }
    }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
