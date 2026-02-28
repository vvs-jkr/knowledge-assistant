import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Refs so the effects don't recreate on each render
  const initialValueRef = useRef(value)
  const resolvedThemeRef = useRef(resolvedTheme)
  resolvedThemeRef.current = resolvedTheme
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const themeCompartment = useMemo(() => new Compartment(), [])

  // Mount the editor once (themeCompartment is stable, so this runs exactly once)
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        markdown({ codeLanguages: languages }),
        themeCompartment.of(resolvedThemeRef.current === 'dark' ? oneDark : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    })

    viewRef.current = new EditorView({ state, parent: containerRef.current })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [themeCompartment])

  // Sync theme changes without recreating the editor
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(resolvedTheme === 'dark' ? oneDark : []),
    })
  }, [resolvedTheme, themeCompartment])

  return <div ref={containerRef} className="h-full text-sm" />
}
