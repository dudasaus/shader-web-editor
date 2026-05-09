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
      caretColor: '#d1fae5',
      tabSize: '2',
    },
    '.cm-line': {
      padding: '0 18px',
    },
    '.cm-gutters': {
      border: '0',
      backgroundColor: '#020617',
      color: '#64748b',
    },
    '.cm-gutterElement': {
      padding: '0 12px 0 18px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(148, 163, 184, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(96, 165, 250, 0.35) !important',
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
