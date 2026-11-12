'use client'

import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { tags as t } from '@lezer/highlight'

/**
 * The Boss Round's code editor: CodeMirror 6 with JavaScript highlighting,
 * the same on a phone and a laptop. Loaded only when a Boss Round is on
 * screen (PhoneActivity imports it lazily and shows a plain textarea until
 * it's here, or if it fails to load). The code never leaves the browser:
 * this only edits; PhoneActivity keeps it in localStorage and runs it.
 *
 * Keyboard: Tab indents two spaces; Escape then Tab leaves the editor
 * (CodeMirror's tab-focus mode), so the keyboard is never trapped. On touch,
 * 16 px text (no iOS zoom), and no autocorrect, capitals or spellcheck.
 */

/** Soft syntax colours from the guild's tokens: they follow light and dark by themselves. */
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--color-wisteria)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--color-indigo-jp)' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: 'var(--color-ink)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--color-vermillion)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--color-matcha)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--color-ink-muted)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--color-ink-soft)' },
  { tag: t.propertyName, color: 'var(--color-ink)' },
])

const theme = EditorView.theme({
  '&': {
    fontSize: 'inherit',
    color: 'var(--color-ink)',
    backgroundColor: 'var(--color-sumi)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-control, 10px)',
    transition: 'border-color 150ms, box-shadow 150ms',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--color-border-strong)',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--color-indigo-jp) 18%, transparent)',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', lineHeight: '1.6', minHeight: '10rem' },
  '.cm-content': { padding: '10px 0', caretColor: 'var(--color-ink)' },
  '.cm-line': { padding: '0 12px 0 6px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'color-mix(in oklab, var(--color-ink-muted) 60%, transparent)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 2px 0 10px', minWidth: '1.6em' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--color-ink) 4%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-ink-soft)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-ink)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--color-indigo-jp) 22%, transparent) !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--color-matcha) 20%, transparent)', outline: 'none' },
  '.cm-placeholder': { color: 'var(--color-ink-muted)' },
  '&.cm-readonly': { opacity: '0.75' },
})

export function BossEditor({
  value,
  onChange,
  readOnly = false,
  label,
  describedBy,
}: {
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
  label: string
  describedBy?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const changed = useRef(onChange)
  useEffect(() => { changed.current = onChange })
  const ro = useRef(new Compartment())

  // One editor per mount; the value only flows in when it changed from outside (a refresh's saved code).
  useEffect(() => {
    if (!host.current) return
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          javascript(),
          syntaxHighlighting(highlight),
          theme,
          cmPlaceholder('function sumEvens(nums) { … }'),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          ro.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          EditorView.contentAttributes.of({
            'aria-label': label,
            ...(describedBy ? { 'aria-describedby': describedBy } : {}),
            autocorrect: 'off',
            autocapitalize: 'off',
            spellcheck: 'false',
            'data-gramm': 'false',
            inputmode: 'text',
          }),
          EditorView.updateListener.of(u => {
            if (u.docChanged) changed.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // Built once; value and readOnly are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const v = view.current
    if (!v) return
    const now = v.state.doc.toString()
    if (now !== value) v.dispatch({ changes: { from: 0, to: now.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: ro.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) })
  }, [readOnly])

  return <div ref={host} className="text-[13.5px] pointer-coarse:text-[16px]" />
}
