<script lang="ts">
  import { onMount } from 'svelte'

  let canvas: HTMLCanvasElement
  let gl: WebGLRenderingContext | null = null
  let program: WebGLProgram | null = null
  let animationFrame = 0
  let error = ''
  let startTime = performance.now()
  let codeScrollTop = 0
  let codeScrollLeft = 0

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

  $: highlightedShader = highlightShader(shaderCode)

  $: if (gl && shaderCode) {
    buildProgram()
  }

  onMount(() => {
    gl = canvas.getContext('webgl')

    if (!gl) {
      error = 'WebGL is not available in this browser.'
      return
    }

    buildProgram()
    render()

    return () => cancelAnimationFrame(animationFrame)
  })

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
  }

  function highlightShader(source: string) {
    const escaped = escapeHtml(source)
    const keywords = 'attribute|break|const|continue|discard|do|else|for|if|in|inout|out|precision|return|struct|uniform|varying|while'
    const types = 'bool|bvec2|bvec3|bvec4|float|int|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube|vec2|vec3|vec4|void'
    const builtins = 'abs|acos|asin|atan|ceil|clamp|cos|cross|distance|dot|exp|floor|fract|gl_FragColor|gl_FragCoord|gl_Position|length|mix|mod|normalize|pow|reflect|sin|smoothstep|sqrt|step|tan|texture2D'
    const pattern = new RegExp(
      `(/\\*[\\s\\S]*?\\*/|//.*)|\\b(${keywords})\\b|\\b(${types})\\b|\\b(${builtins})\\b|(-?\\b\\d+(?:\\.\\d+)?\\b)`,
      'g',
    )

    return escaped.replace(pattern, (match, comment, keyword, type, builtin, number) => {
      if (comment) return `<span class="token-comment">${match}</span>`
      if (keyword) return `<span class="token-keyword">${match}</span>`
      if (type) return `<span class="token-type">${match}</span>`
      if (builtin) return `<span class="token-builtin">${match}</span>`
      if (number) return `<span class="token-number">${match}</span>`
      return match
    })
  }

  function syncCodeScroll(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement
    codeScrollTop = target.scrollTop
    codeScrollLeft = target.scrollLeft
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
    <label for="shader-code">Fragment shader</label>
    <div class="code-editor">
      <pre class="highlight-layer" aria-hidden="true"><code style={`transform: translate(${-codeScrollLeft}px, ${-codeScrollTop}px)`}>{@html highlightedShader}</code></pre>
      <textarea
        id="shader-code"
        bind:value={shaderCode}
        spellcheck="false"
        onscroll={syncCodeScroll}
      ></textarea>
    </div>
  </section>

  <section class="preview-panel">
    <canvas bind:this={canvas} aria-label="Shader preview"></canvas>
    {#if error}
      <pre class="error">{error}</pre>
    {/if}
  </section>
</main>
