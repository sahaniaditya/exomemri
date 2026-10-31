import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { filterSlashItems } from './filterSlashItems'
import { basicSlashItems } from './items-basic'
import { SlashController } from './slashController'
import type { SlashItem } from './types'

export interface SlashExtensionOptions {
  items: SlashItem[]
}

export interface SlashExtensionStorage {
  controller: SlashController
}

export const slashPluginKey = new PluginKey('noteSlashMenu')

/**
 * `/` command menu. State is exposed through `editor.storage.slash.controller`
 * for the React `SlashMenu`; the plugin itself stays DOM-free.
 */
export const SlashExtension = Extension.create<SlashExtensionOptions, SlashExtensionStorage>({
  name: 'slash',

  addOptions() {
    return { items: basicSlashItems }
  },

  addStorage() {
    return { controller: new SlashController() }
  },

  addProseMirrorPlugins() {
    const controller = this.storage.controller
    const options = this.options
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: '/',
        // Never trigger inside code blocks (or any other `code` node).
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterSlashItems(options.items, query),
        command: ({ editor, range, props }) => {
          // Remove the typed `/query`, then run the item at the (now collapsed) position.
          editor.chain().focus().deleteRange(range).run()
          props.run({ editor, range: { from: range.from, to: range.from } })
        },
        render: () => ({
          onStart: props =>
            controller.open({
              query: props.query,
              items: props.items,
              rect: props.clientRect ?? null,
              command: props.command,
            }),
          onUpdate: props =>
            controller.update({
              query: props.query,
              items: props.items,
              rect: props.clientRect ?? null,
              command: props.command,
            }),
          onExit: () => controller.close(),
          onKeyDown: ({ event }) => controller.handleKey(event.key),
        }),
      }),
    ]
  },
})
