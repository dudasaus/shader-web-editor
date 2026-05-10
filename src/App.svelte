<script lang="ts">
  import { onMount } from 'svelte'
  import ShaderEditor from './lib/ShaderEditor.svelte'
  import {
    getShaderDirectoryName,
    loadShader,
    restoreShaderDirectory,
    saveShader,
    supportsFileSystemAccess,
  } from './lib/shaderFiles'

  let canvas: HTMLCanvasElement
  let gl: WebGLRenderingContext | null = null
  let program: WebGLProgram | null = null
  let animationFrame = 0
  let activeDirectoryName = ''
  let error = ''
  let fileStatus = ''
  let startTime = performance.now()

  let shaderCode = `precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec3 color = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(color, 1.0);
}`

  const vertexShaderSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

  $: if (gl && shaderCode) {
    buildProgram()
  }

  onMount(() => {
    if (!supportsFileSystemAccess()) {
      fileStatus = 'File System Access API is not available in this browser.'
    }

    void hydrateDirectoryState()

    window.addEventListener('keydown', handleGlobalKeydown)

    gl = canvas.getContext('webgl')

    if (!gl) {
      error = 'WebGL is not available in this browser.'
      return () => window.removeEventListener('keydown', handleGlobalKeydown)
    }

    buildProgram()
    render()

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleGlobalKeydown)
    }
  })

  async function handleSaveShader() {
    try {
      const result = await saveShader(shaderCode)

      if (!result) {
        fileStatus = 'Save canceled.'
        return
      }

      syncDirectoryName()
      fileStatus = `Saved ${result.fileName} in ${result.directoryName}.`
    } catch (err) {
      fileStatus = getFileActionMessage(err, 'Save')
    }
  }

  async function handleLoadShader() {
    try {
      const result = await loadShader()

      if (!result) {
        fileStatus = 'Load canceled.'
        return
      }

      syncDirectoryName()
      shaderCode = result.source
      fileStatus = `Loaded ${result.fileName} from ${result.directoryName}.`
    } catch (err) {
      fileStatus = getFileActionMessage(err, 'Load')
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) {
      return
    }

    if (!event.ctrlKey && !event.metaKey) {
      return
    }

    const key = event.key.toLowerCase()

    if (key === 's') {
      event.preventDefault()
      void handleSaveShader()
      return
    }

    if (key === 'o') {
      event.preventDefault()
      void handleLoadShader()
    }
  }

  function getFileActionMessage(error: unknown, action: 'Save' | 'Load') {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return `${action} canceled.`
    }

    return error instanceof Error ? error.message : String(error)
  }

  async function hydrateDirectoryState() {
    try {
      await restoreShaderDirectory()
      syncDirectoryName()
    } catch {
      activeDirectoryName = ''
    }
  }

  function syncDirectoryName() {
    activeDirectoryName = getShaderDirectoryName()
  }

  function compileShader(context: WebGLRenderingContext, type: number, source: string) {
    const shader = context.createShader(type)
    if (!shader) throw new Error('Could not create shader.')

    context.shaderSource(shader, source)
    context.compileShader(shader)

    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      const message = context.getShaderInfoLog(shader) ?? 'Shader compile failed.'
      context.deleteShader(shader)
      throw new Error(message)
    }

    return shader
  }

  function buildProgram() {
    const context = gl
    if (!context) return

    try {
      const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
      const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, shaderCode)
      const nextProgram = context.createProgram()
      if (!nextProgram) throw new Error('Could not create shader program.')

      context.attachShader(nextProgram, vertexShader)
      context.attachShader(nextProgram, fragmentShader)
      context.linkProgram(nextProgram)

      context.deleteShader(vertexShader)
      context.deleteShader(fragmentShader)

      if (!context.getProgramParameter(nextProgram, context.LINK_STATUS)) {
        const message = context.getProgramInfoLog(nextProgram) ?? 'Program link failed.'
        context.deleteProgram(nextProgram)
        throw new Error(message)
      }

      if (program) context.deleteProgram(program)
      program = nextProgram
      error = ''
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  function resizeCanvas(context: WebGLRenderingContext) {
    const size = canvas.clientWidth
    const pixelRatio = window.devicePixelRatio || 1
    const displaySize = Math.floor(size * pixelRatio)

    if (canvas.width !== displaySize || canvas.height !== displaySize) {
      canvas.width = displaySize
      canvas.height = displaySize
    }

    context.viewport(0, 0, canvas.width, canvas.height)
  }

  function render() {
    animationFrame = requestAnimationFrame(render)
    const context = gl
    if (!context || !program) return

    resizeCanvas(context)
    context.useProgram(program)

    const positionLocation = context.getAttribLocation(program, 'a_position')
    const buffer = context.createBuffer()
    context.bindBuffer(context.ARRAY_BUFFER, buffer)
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      context.STATIC_DRAW,
    )

    context.enableVertexAttribArray(positionLocation)
    context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0)

    const resolutionLocation = context.getUniformLocation(program, 'u_resolution')
    const timeLocation = context.getUniformLocation(program, 'u_time')

    context.uniform2f(resolutionLocation, canvas.width, canvas.height)
    context.uniform1f(timeLocation, (performance.now() - startTime) / 1000)
    context.drawArrays(context.TRIANGLES, 0, 3)

    context.deleteBuffer(buffer)
  }
</script>

<main class="editor-shell">
  <section class="code-panel">
    <div class="panel-header">
      <label for="shader-code">Fragment shader</label>
      <p class="panel-meta">
        <span>{activeDirectoryName ? `Directory: ${activeDirectoryName}` : 'Directory: not selected'}</span>
        <span>Ctrl+S save</span>
        <span>Ctrl+O load</span>
      </p>
      {#if fileStatus}
        <p class="file-status">{fileStatus}</p>
      {/if}
    </div>
    <div class="code-editor">
      <ShaderEditor inputId="shader-code" bind:value={shaderCode} />
    </div>
  </section>

  <section class="preview-panel">
    <canvas bind:this={canvas} aria-label="Shader preview"></canvas>
    {#if error}
      <pre class="error">{error}</pre>
    {/if}
  </section>
</main>
