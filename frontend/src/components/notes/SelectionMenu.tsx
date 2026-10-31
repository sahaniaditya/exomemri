'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/react/menus'
import { parseLinkInput } from '@/lib/notes/linkUrl'
import { NOTE_HIGHLIGHT_COLORS, NOTE_TEXT_COLORS } from '@/lib/notes/palette'
import { TURN_INTO_OPTIONS } from '@/lib/notes/turnIntoOptions'
import ColorPalette from './ColorPalette'
import { useEditorTick } from './hooks/useEditorTick'
import styles from './note-blocks.module.css'

type Panel = 'main' | 'link' | 'highlight' | 'color' | 'turn'

/** The menu shows for a non-empty text selection in an editable editor, never inside code blocks. */
export function shouldShowSelectionMenu({
  editor,
  state,
}: {
  editor: Editor
  state: EditorState
}): boolean {
  if (!editor.isEditable) return false
  const { selection } = state
  if (!(selection instanceof TextSelection) || selection.empty) return false
  if (selection.$from.parent.type.name === 'codeBlock') return false
  if (selection.$to.parent.type.name === 'codeBlock') return false
  return true
}

// Stable reference: a new object per render makes the plugin dispatch a transaction, re-rendering us.
const BUBBLE_OPTIONS = { placement: 'top', offset: 8 } as const

const keepSelection = (e: React.MouseEvent) => e.preventDefault()

interface MarkButtonProps {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function MarkButton({ label, active, onClick, children }: MarkButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${active ? styles.btnOn : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function LinkEditor({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [value, setValue] = useState<string>(
    () => (editor.getAttributes('link').href as string | undefined) ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const apply = () => {
    const result = parseLinkInput(value)
    if (result.kind === 'invalid') {
      setError(result.reason)
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (result.kind === 'remove') chain.unsetLink().run()
    else chain.setLink({ href: result.href }).run()
    onDone()
  }

  return (
    <div>
      <form
        className={styles.linkRow}
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <input
          ref={inputRef}
          className={`${styles.linkInput} ${error ? styles.linkInputBad : ''}`}
          type="text"
          inputMode="url"
          aria-label="Link URL"
          aria-invalid={error !== null}
          placeholder="Paste a link, empty removes it"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onDone()
              editor.commands.focus()
            }
          }}
        />
        <button type="submit" className={styles.btn} aria-label="Apply link">
          ↵
        </button>
      </form>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

export default function SelectionMenu({ editor }: { editor: Editor | null }) {
  const [panel, setPanel] = useState<Panel>('main')
  useEditorTick(editor)

  // Collapse back to the main row whenever the selection goes away.
  useEffect(() => {
    if (!editor) return
    const reset = () => {
      if (editor.state.selection.empty) setPanel('main')
    }
    editor.on('selectionUpdate', reset)
    return () => {
      editor.off('selectionUpdate', reset)
    }
  }, [editor])

  if (!editor) return null

  const toggle = (next: Panel) => setPanel((cur) => (cur === next ? 'main' : next))
  const run = (fn: () => void) => {
    fn()
    setPanel('main')
  }
  const activeHighlight = (editor.getAttributes('highlight').color as string | undefined) ?? null
  const activeColor = (editor.getAttributes('textStyle').color as string | undefined) ?? null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShowSelectionMenu}
      options={BUBBLE_OPTIONS}
    >
      <div className={styles.menu} role="toolbar" aria-label="Text formatting" data-testid="selection-menu">
        {panel === 'link' ? (
          <LinkEditor editor={editor} onDone={() => setPanel('main')} />
        ) : (
          <>
            <MarkButton
              label="Bold"
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </MarkButton>
            <MarkButton
              label="Italic"
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </MarkButton>
            <MarkButton
              label="Strikethrough"
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <s>S</s>
            </MarkButton>
            <MarkButton
              label="Code"
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              {'</>'}
            </MarkButton>
            <MarkButton label="Link" active={editor.isActive('link')} onClick={() => toggle('link')}>
              🔗
            </MarkButton>
            <span className={styles.sep} aria-hidden="true" />
            <div className={styles.anchor}>
              <MarkButton
                label="Highlight"
                active={activeHighlight !== null}
                onClick={() => toggle('highlight')}
              >
                ▇
              </MarkButton>
              {panel === 'highlight' && (
                <ColorPalette
                  label="Highlight"
                  variant="fill"
                  colors={NOTE_HIGHLIGHT_COLORS}
                  active={activeHighlight}
                  onPick={(color) =>
                    run(() => editor.chain().focus().setHighlight({ color }).run())
                  }
                  onClear={() => run(() => editor.chain().focus().unsetHighlight().run())}
                />
              )}
            </div>
            <div className={styles.anchor}>
              <MarkButton
                label="Text color"
                active={activeColor !== null}
                onClick={() => toggle('color')}
              >
                A
              </MarkButton>
              {panel === 'color' && (
                <ColorPalette
                  label="Text color"
                  variant="text"
                  colors={NOTE_TEXT_COLORS}
                  active={activeColor}
                  onPick={(color) => run(() => editor.chain().focus().setColor(color).run())}
                  onClear={() => run(() => editor.chain().focus().unsetColor().run())}
                />
              )}
            </div>
            <span className={styles.sep} aria-hidden="true" />
            <div className={styles.anchor}>
              <MarkButton label="Turn into" active={panel === 'turn'} onClick={() => toggle('turn')}>
                Turn into ▾
              </MarkButton>
              {panel === 'turn' && (
                <div className={styles.popover} role="menu" aria-label="Turn into">
                  {TURN_INTO_OPTIONS.filter((o) => o.target !== 'codeBlock').map((o) => (
                    <button
                      key={o.target}
                      type="button"
                      role="menuitem"
                      className={styles.item}
                      onMouseDown={keepSelection}
                      onClick={() =>
                        run(() => editor.chain().focus().turnSelectionInto(o.target).run())
                      }
                    >
                      <span className={styles.itemIcon} aria-hidden="true">
                        {o.icon}
                      </span>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BubbleMenu>
  )
}
