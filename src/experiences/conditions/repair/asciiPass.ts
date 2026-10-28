import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// Turns the rendered scene into coloured ASCII art. Each cell picks a glyph from a density ramp,
// or a line glyph (| \ - /) where the picture has a strong edge, and keeps the scene's colour.

const RAMP = ' .,:;=+*?%#@'
const EDGES = '|\\-/'
const GLYPHS = RAMP + EDGES

function glyphAtlas() {
  // One glyph per 40 × 64 tile: the same shape as a screen cell, so characters fill their cells.
  const width = 40, height = 64
  const canvas = document.createElement('canvas')
  canvas.width = width * GLYPHS.length
  canvas.height = height
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  const draw = () => {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${height * 0.92}px "IBM Plex Mono", ui-monospace, monospace`
    for (let index = 0; index < GLYPHS.length; index += 1) ctx.fillText(GLYPHS[index], index * width + width / 2, height * 0.54, width * 1.02)
    texture.needsUpdate = true
  }
  draw()
  document.fonts?.load(`700 32px "IBM Plex Mono"`).then(draw).catch(() => undefined)
  return texture
}

export function createAsciiPass() {
  const glyphs = glyphAtlas()
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tGlyphs: { value: null },
      tNormal: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCell: { value: new THREE.Vector2(8, 13) },
      uMix: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tGlyphs;
      uniform sampler2D tNormal;
      uniform vec2 uResolution;
      uniform vec2 uCell;
      uniform float uMix;
      uniform float uTime;
      varying vec2 vUv;
      const float RAMP = ${RAMP.length.toFixed(1)};
      const float COUNT = ${GLYPHS.length.toFixed(1)};

      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec3 cellColor(vec2 center, vec2 texel) {
        vec3 c = texture2D(tDiffuse, center).rgb * 2.0;
        c += texture2D(tDiffuse, center + texel * vec2(0.3, 0.3)).rgb;
        c += texture2D(tDiffuse, center + texel * vec2(-0.3, 0.3)).rgb;
        c += texture2D(tDiffuse, center + texel * vec2(0.3, -0.3)).rgb;
        c += texture2D(tDiffuse, center + texel * vec2(-0.3, -0.3)).rgb;
        return c / 6.0;
      }

      // The steepest of the three normal channels gives a signed direction across a crease or outline.
      vec2 normalEdge(vec2 center, vec2 texel) {
        vec3 r = texture2D(tNormal, center + vec2(texel.x * 0.5, 0.0)).rgb, l = texture2D(tNormal, center - vec2(texel.x * 0.5, 0.0)).rgb;
        vec3 u = texture2D(tNormal, center + vec2(0.0, texel.y * 0.5)).rgb, d = texture2D(tNormal, center - vec2(0.0, texel.y * 0.5)).rgb;
        vec2 gx = vec2(r.x - l.x, u.x - d.x), gy = vec2(r.y - l.y, u.y - d.y), gz = vec2(r.z - l.z, u.z - d.z);
        vec2 best = gx;
        if (length(gy) > length(best)) best = gy;
        if (length(gz) > length(best)) best = gz;
        return best;
      }

      void main() {
        vec2 px = vUv * uResolution;
        vec2 cell = floor(px / uCell);
        vec2 texel = uCell / uResolution;
        vec2 center = (cell + 0.5) * texel;
        vec3 color = cellColor(center, texel);
        float light = luma(color);
        // Edges: brightness changes, plus colour changes (a pink side panel against a black front).
        vec3 right = texture2D(tDiffuse, center + vec2(texel.x, 0.0)).rgb, left = texture2D(tDiffuse, center - vec2(texel.x, 0.0)).rgb;
        vec3 up = texture2D(tDiffuse, center + vec2(0.0, texel.y)).rgb, down = texture2D(tDiffuse, center - vec2(0.0, texel.y)).rgb;
        vec2 gradient = vec2(luma(right) - luma(left), luma(up) - luma(down));
        float hueEdge = max(length(right - left), length(up - down));
        if (length(gradient) < 0.18 && hueEdge > 0.42) gradient = normalize(vec2(length(right - left), length(up - down)) + 1e-4) * 0.3;
        vec2 crease = normalEdge(center, texel);
        bool outline = length(crease) > 0.3;
        if (outline) gradient = crease;
        float glyph;
        if (outline || length(gradient) > 0.22 && light > 0.05) {
          float angle = mod(atan(gradient.y, gradient.x) + 3.14159265 / 8.0, 3.14159265);
          glyph = RAMP + floor(angle / (3.14159265 / 4.0));
        } else {
          float level = clamp((light - 0.035) * 1.35, 0.0, 0.999);
          // Flat surfaces get light fill characters, so the outlines carry the shape.
          glyph = floor(pow(level, 1.05) * RAMP * 0.82);
        }
        vec2 inside = fract(px / uCell);
        float ink = texture2D(tGlyphs, vec2((glyph + inside.x) / COUNT, inside.y)).r;
        float peak = max(max(color.r, color.g), max(color.b, 0.08));
        vec3 hue = mix(color / peak, vec3(1.0), 0.18);
        vec3 fore = hue * (outline ? max(0.85, 0.5 + 0.9 * pow(light, 0.55)) : 0.45 + 0.9 * pow(light, 0.55));
        vec3 back = vec3(0.027, 0.035, 0.031) + color * 0.08;
        float scan = 0.94 + 0.06 * sin(px.y * 1.2);
        vec3 ascii = mix(back, fore, ink) * scan;
        gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, ascii, uMix), 1.0);
      }
    `,
  })
  // ShaderPass copies its uniforms; hand it the atlas itself so the redraw after the font loads shows up.
  pass.uniforms.tGlyphs.value = glyphs
  return pass
}
