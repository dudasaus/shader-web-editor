# Shader Web Editor

A tiny browser-based fragment shader editor built with Svelte, Vite, and WebGL.

Type GLSL fragment shader code on the left and see it rendered live on the canvas on the right.

## Features

- Live WebGL fragment shader preview
- Basic GLSL syntax highlighting
- Compile/link error display
- Built-in uniforms:
  - `u_resolution` — canvas resolution in pixels
  - `u_time` — elapsed time in seconds

## Development

Install dependencies:

```sh
bun install
```

Start the dev server:

```sh
bun dev
```

Run checks:

```sh
bun run check
```

Build for production:

```sh
bun run build
```

Preview the production build:

```sh
bun run preview
```

## Deployment

This project includes a GitHub Actions workflow that deploys `dist/` to GitHub Pages whenever changes are pushed to `main`.

For this repository, the deployed app should be available at:

https://dudasaus.github.io/shader-web-editor/
