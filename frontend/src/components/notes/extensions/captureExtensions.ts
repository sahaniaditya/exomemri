/**
 * Everything Phase 3 adds to the editor schema. The integration step spreads
 * this into `buildNoteExtensions`:
 *
 *   [...base, ...captureExtensions()]
 */
import type { AnyExtension } from '@tiptap/core'
import { CaptureEmbed } from './captureEmbed'
import { NoteMention, SourceMention } from './mentions'
import { MentionSuggestion, type MentionOptions } from './mentionSuggestion'

export function captureExtensions(options: MentionOptions = {}): AnyExtension[] {
  return [CaptureEmbed, NoteMention, SourceMention, MentionSuggestion.configure(options)]
}
