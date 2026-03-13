import type { ReactNode } from 'react'

type Props = {
  sidebar: ReactNode
  children: ReactNode
}

export function SidebarLayout({ sidebar, children }: Props) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r">{sidebar}</aside>
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
