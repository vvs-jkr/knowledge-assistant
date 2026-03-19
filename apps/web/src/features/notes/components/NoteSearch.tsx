import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchNotes } from '@/features/notes/api/notes.api'
import { useNotesStore } from '@/features/notes/store/notes.store'
import { isInputFocused } from '@/shared/lib/keyboard'
import type { SearchResult } from '@/shared/schemas/notes.schema'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function NoteSearch() {
  const [localQuery, setLocalQuery] = useState('')
  const searchMutation = useSearchNotes()
  const selectNote = useNotesStore((s) => s.selectNote)
  const setIsSearching = useNotesStore((s) => s.setIsSearching)
  const clearSearch = useNotesStore((s) => s.clearSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // / → focus this search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim().length < 2) {
        clearSearch()
        return
      }
      setIsSearching(true)
      searchMutation.mutate({ query: query.trim() })
    },
    [clearSearch, setIsSearching, searchMutation]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(localQuery), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [localQuery, handleSearch])

  const handleClear = () => {
    setLocalQuery('')
    clearSearch()
    searchMutation.reset()
  }

  const handleSelect = (noteId: string) => {
    selectNote(noteId)
    handleClear()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Semantic search…"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          className="pl-8 pr-8"
          aria-label="Search notes"
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searchMutation.isPending && (
        <div className="flex flex-col gap-1.5 px-1">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {searchMutation.isError && (
        <p className="px-1 text-xs text-destructive">Search failed. Try again.</p>
      )}

      {searchMutation.isSuccess && searchMutation.data.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No results found.</p>
      )}

      {searchMutation.isSuccess && searchMutation.data.length > 0 && (
        <SearchResultList results={searchMutation.data} onSelect={handleSelect} />
      )}
    </div>
  )
}

interface SearchResultListProps {
  results: SearchResult[]
  onSelect: (noteId: string) => void
}

function SearchResultList({ results, onSelect }: SearchResultListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {results.map((r) => (
        <li key={r.note_id}>
          <button
            type="button"
            onClick={() => onSelect(r.note_id)}
            className="w-full rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{r.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {Math.round((1 - r.distance) * 100)}%
              </span>
            </div>
            {r.snippet && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</p>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
