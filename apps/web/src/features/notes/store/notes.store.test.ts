import { beforeEach, describe, expect, it } from 'vitest'
import { useNotesStore } from './notes.store'

const resetStore = () => useNotesStore.setState({ selectedNoteId: null, isEditing: false })

describe('useNotesStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('starts with no selected note and not editing', () => {
    const { selectedNoteId, isEditing } = useNotesStore.getState()
    expect(selectedNoteId).toBeNull()
    expect(isEditing).toBe(false)
  })

  it('selectNote sets selectedNoteId and resets isEditing', () => {
    useNotesStore.getState().setEditing(true)
    useNotesStore.getState().selectNote('note-1')
    const { selectedNoteId, isEditing } = useNotesStore.getState()
    expect(selectedNoteId).toBe('note-1')
    expect(isEditing).toBe(false)
  })

  it('selectNote with null deselects', () => {
    useNotesStore.getState().selectNote('note-1')
    useNotesStore.getState().selectNote(null)
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
  })

  it('setEditing(true) enables editing mode', () => {
    useNotesStore.getState().selectNote('note-1')
    useNotesStore.getState().setEditing(true)
    expect(useNotesStore.getState().isEditing).toBe(true)
  })

  it('setEditing(false) disables editing mode', () => {
    useNotesStore.getState().setEditing(true)
    useNotesStore.getState().setEditing(false)
    expect(useNotesStore.getState().isEditing).toBe(false)
  })

  it('selectNote does not change isEditing if already false', () => {
    useNotesStore.getState().selectNote('note-2')
    expect(useNotesStore.getState().isEditing).toBe(false)
  })
})
