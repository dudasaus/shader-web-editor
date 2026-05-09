<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { EditorState } from '@codemirror/state'
  import { keymap, EditorView } from '@codemirror/view'
  import { indentWithTab } from '@codemirror/commands'
  import { basicSetup } from 'codemirror'
  import { oneDark } from '@codemirror/theme-one-dark'
  import { glsl } from 'codemirror-lang-glsl'

  export let inputId = 'shader-code'
  export let value = ''

  let container: HTMLDivElement
  let editorView: EditorView | null = null

  const editorTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'var(--color-bg-panel)',
      color: 'var(--color-text-primary)',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
      lineHeight: '1.5',
    },
    '.cm-content, .cm-gutter': {
      minHeight: '100%',
    },
    '.cm-content': {
      padding: '18px 0',
      caretColor: 'var(--color-text-primary)',
      tabSize: '2',
    },
    '.cm-line': {
      padding: '0 18px',
    },
    '.cm-gutters': {
      border: '0',
      backgroundColor: 'var(--color-bg-panel)',
      color: 'var(--color-text-muted)',
    },
    '.cm-gutterElement': {
      padding: '0 12px 0 18px',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--color-bg-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--color-bg-line-strong)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-bg-selection) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-text-primary)',
    },
    '.cm-panels': {
      backgroundColor: 'var(--color-bg-panel)',
      color: 'var(--color-text-primary)',
      borderBottom: '1px solid var(--color-border)',
    },
    '.cm-focused': {
      outline: 'none',
    },
  })

  onMount(() => {
    editorView = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Fragment shader',
            autocapitalize: 'off',
            id: inputId,
            spellcheck: 'false',
          }),
          oneDark,
          editorTheme,
          glsl(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              value = update.state.doc.toString()
            }
          }),
        ],
      }),
      parent: container,
    })
  })

  onDestroy(() => {
    editorView?.destroy()
    editorView = null
  })

  $: if (editorView) {
    const currentValue = editorView.state.doc.toString()

    if (value !== currentValue) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
    }
  }
</script>

<div class="editor-host" bind:this={container}></div>

<style>
  .editor-host {
    height: 100%;
  }

  :global(.editor-host .cm-editor) {
    height: 100%;
  }
</style>
