# Ideas

## Texture inputs

Add support for sampling external inputs from shaders via `sampler2D` uniforms.

On the shader side, images, videos, webcam frames, canvases, or generated pixel data can all be treated as textures:

```glsl
uniform sampler2D u_texture;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec4 inputColor = texture2D(u_texture, uv);

  gl_FragColor = inputColor;
}
```

The shader does not need to know whether `u_texture` came from an image, video, webcam, another canvas, or generated data. JavaScript/WebGL handles uploading/updating the source into a GPU texture.

Multiple inputs could be exposed as multiple texture uniforms:

```glsl
uniform sampler2D u_image;
uniform sampler2D u_video;
uniform sampler2D u_noise;
```

## JavaScript example: image texture

```js
const image = new Image()
image.src = 'my-image.jpg'

image.onload = () => {
  const texture = gl.createTexture()

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)

  // Optional: flip image so UV coordinates feel natural
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image,
  )

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const textureLocation = gl.getUniformLocation(program, 'u_texture')

  // Tell shader that u_texture should sample from TEXTURE0
  gl.useProgram(program)
  gl.uniform1i(textureLocation, 0)

  render()
}
```

Important bit:

```js
gl.activeTexture(gl.TEXTURE0)
gl.bindTexture(gl.TEXTURE_2D, texture)
gl.uniform1i(textureLocation, 0)
```

This means: bind the image texture to texture unit `0`, and tell `u_texture` to sample from texture unit `0`.

## Practical notes

- Images/videos may appear vertically flipped. Fix either in the shader with `uv.y = 1.0 - uv.y;` or in WebGL with `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`.
- Video and webcam inputs work the same way as images, but the texture must be updated every frame with the latest video frame.
- Useful additional uniform: `u_textureResolution`, containing the media dimensions in pixels.
