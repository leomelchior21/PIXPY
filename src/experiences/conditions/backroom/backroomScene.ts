import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { corridorCenterAt, drillOut, drillStrike, drillWarn, holeHalfLength, mulberry32, sawEmerge, sawOut, sawReach, type CorridorObstacle } from './backroomEngine'
import type { BackroomRendererHandle, BackroomView, GateSignal } from './backroomRenderer'

// World units match the game: the corridor is 1.54 wide; one unit is roughly 2.4 m.
const HALF = 0.77
const HEIGHT = 1.25
const EYE = 0.62
const DOOR_TOP = 0.96
const SEG = 0.5
const AHEAD = 34
const BEHIND = 3
const SEGMENTS = Math.ceil((AHEAD + BEHIND) / SEG) + 1
const LIGHT_SPACING = 2.5
const FIXTURES = Math.ceil((AHEAD + BEHIND) / LIGHT_SPACING) + 2
const LAMPS = 4
const DUST = 260
// The door into Level 0 stands just ahead of where every run starts.
const ENTRY_Z = 0.9
const ENTRY_HALF = 0.36
const ENTRY_TOP = 0.98

type Signal = GateSignal | 'upcoming'
const signalColors: Record<Signal, number> = { true: 0x3dff86, false: 0xff3b4e, unknown: 0xffb43b, upcoming: 0x6fd6ff }

// ---------- Procedural textures ----------

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')!]
}

function grain(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number, strength: number, warm = 0.85) {
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  for (let index = 0; index < data.length; index += 4) {
    const noise = (random() - 0.5) * strength
    data[index] += noise
    data[index + 1] += noise
    data[index + 2] += noise * warm
  }
  ctx.putImageData(image, 0, 0)
}

// Draws at x and its wrapped copies so the texture tiles without seams.
function wrapped(width: number, height: number, x: number, y: number, draw: (x: number, y: number) => void) {
  for (const ox of [-width, 0, width]) for (const oy of [-height, 0, height]) draw(x + ox, y + oy)
}

function blotch(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`)
  gradient.addColorStop(0.6, `rgba(${rgb},${alpha * 0.5})`)
  gradient.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function wallpaper(random: () => number) {
  const W = 1024
  const H = 512
  const [color, ctx] = makeCanvas(W, H)
  const [height, hx] = makeCanvas(W, H)
  ctx.fillStyle = '#c9b462'
  ctx.fillRect(0, 0, W, H)
  hx.fillStyle = '#808080'
  hx.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = 'rgba(140,110,40,.32)'
    ctx.fillRect(x, 0, 2, H)
    ctx.fillRect(x + 7, 0, 1, H)
    hx.fillStyle = '#a0a0a0'
    hx.fillRect(x, 0, 2, H)
    hx.fillRect(x + 7, 0, 1, H)
  }
  const motif = (target: CanvasRenderingContext2D, x: number, y: number, fill: string) => {
    target.fillStyle = fill
    target.beginPath()
    target.moveTo(x, y - 11)
    target.lineTo(x + 6, y)
    target.lineTo(x, y + 11)
    target.lineTo(x - 6, y)
    target.closePath()
    target.fill()
    target.fillRect(x - 1, y - 18, 2, 4)
    target.fillRect(x - 1, y + 14, 2, 4)
  }
  for (let row = 0, y = 28; y < H; y += 56, row += 1) {
    for (let x = 36 + (row % 2) * 32; x < W + 32; x += 64) {
      motif(ctx, x, y, 'rgba(150,118,42,.26)')
      motif(hx, x, y, '#b0b0b0')
    }
  }
  grain(ctx, W, H, random, 16)
  for (let index = 0; index < 46; index += 1) {
    const light = random() < 0.45
    const x = random() * W
    const y = random() * H
    const radius = 30 + random() * 110
    wrapped(W, 0, x, y, (px, py) => blotch(ctx, px, py, radius, light ? '230,212,140' : '115,90,32', 0.05 + random() * 0.07))
  }
  // Water damage creeping down from the ceiling.
  for (let index = 0; index < 4; index += 1) {
    const x = random() * W
    const width = 24 + random() * 70
    const length = 90 + random() * 210
    for (let streak = 0; streak < 7; streak += 1) {
      const dx = (random() - 0.5) * width * 0.7
      const reach = length * (0.45 + random() * 0.55)
      const gradient = ctx.createLinearGradient(0, 0, 0, reach)
      gradient.addColorStop(0, 'rgba(92,66,18,.12)')
      gradient.addColorStop(0.85, 'rgba(92,66,18,.05)')
      gradient.addColorStop(1, 'rgba(92,66,18,0)')
      ctx.fillStyle = gradient
      wrapped(W, 0, x + dx, 0, (px) => {
        ctx.beginPath()
        ctx.ellipse(px, 0, width * (0.15 + random() * 0.25), reach, 0, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }
  const grime = ctx.createLinearGradient(0, H * 0.72, 0, H * 0.925)
  grime.addColorStop(0, 'rgba(70,52,16,0)')
  grime.addColorStop(1, 'rgba(70,52,16,.38)')
  ctx.fillStyle = grime
  ctx.fillRect(0, H * 0.72, W, H * 0.21)
  const shade = ctx.createLinearGradient(0, 0, 0, H * 0.14)
  shade.addColorStop(0, 'rgba(50,38,12,.4)')
  shade.addColorStop(1, 'rgba(50,38,12,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H * 0.14)
  const skirt = Math.round(H * 0.925)
  ctx.fillStyle = '#76602e'
  ctx.fillRect(0, skirt, W, H - skirt)
  ctx.fillStyle = '#a88d4a'
  ctx.fillRect(0, skirt, W, 3)
  ctx.fillStyle = 'rgba(0,0,0,.4)'
  ctx.fillRect(0, skirt - 2, W, 2)
  grain(ctx, W, H, random, 10)
  hx.fillStyle = '#c8c8c8'
  hx.fillRect(0, skirt, W, H - skirt)
  hx.fillStyle = '#e8e8e8'
  hx.fillRect(0, skirt, W, 3)
  grain(hx, W, H, random, 26, 1)
  return { color, height }
}

function carpet(random: () => number) {
  const S = 512
  const [color, ctx] = makeCanvas(S, S)
  const [height, hx] = makeCanvas(S, S)
  ctx.fillStyle = '#8b763c'
  ctx.fillRect(0, 0, S, S)
  for (let index = 0; index < 26; index += 1) {
    const x = random() * S
    const y = random() * S
    const radius = 30 + random() * 120
    const damp = random() < 0.65
    wrapped(S, S, x, y, (px, py) => blotch(ctx, px, py, radius, damp ? '62,48,16' : '170,150,92', damp ? 0.16 + random() * 0.18 : 0.08))
  }
  grain(ctx, S, S, random, 46)
  for (let index = 0; index < 9000; index += 1) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(40,30,10,.22)' : 'rgba(205,185,120,.16)'
    ctx.fillRect(random() * S, random() * S, 1, 1 + random() * 2)
  }
  hx.fillStyle = '#808080'
  hx.fillRect(0, 0, S, S)
  grain(hx, S, S, random, 120, 1)
  return { color, height }
}

function ceilingTiles(random: () => number) {
  const S = 512
  const tile = S / 4
  const [color, ctx] = makeCanvas(S, S)
  const [height, hx] = makeCanvas(S, S)
  ctx.fillStyle = '#d6cc9d'
  ctx.fillRect(0, 0, S, S)
  hx.fillStyle = '#707070'
  hx.fillRect(0, 0, S, S)
  for (let ty = 0; ty < 4; ty += 1) {
    for (let tx = 0; tx < 4; tx += 1) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '120,100,50' : '255,250,220'},${random() * 0.07})`
      ctx.fillRect(tx * tile, ty * tile, tile, tile)
      if (random() < 0.18) blotch(ctx, tx * tile + tile / 2, ty * tile + tile / 2, tile * (0.3 + random() * 0.3), '125,92,30', 0.22)
    }
  }
  for (let index = 0; index < 7000; index += 1) {
    ctx.fillStyle = random() < 0.75 ? 'rgba(110,98,66,.38)' : 'rgba(255,255,240,.3)'
    const size = random() < 0.85 ? 1 : 2
    ctx.fillRect(random() * S, random() * S, size, size)
    hx.fillStyle = 'rgba(40,40,40,.5)'
    hx.fillRect(random() * S, random() * S, 1, 1)
  }
  for (let index = 0; index <= 4; index += 1) {
    const at = index * tile
    ctx.fillStyle = '#ece6cb'
    ctx.fillRect(at - 4, 0, 8, S)
    ctx.fillRect(0, at - 4, S, 8)
    ctx.fillStyle = 'rgba(70,60,30,.45)'
    ctx.fillRect(at + 4, 0, 1, S)
    ctx.fillRect(0, at + 4, S, 1)
    hx.fillStyle = '#e0e0e0'
    hx.fillRect(at - 4, 0, 8, S)
    hx.fillRect(0, at - 4, S, 8)
  }
  grain(ctx, S, S, random, 8)
  return { color, height }
}

function lensTexture() {
  const [canvas, ctx] = makeCanvas(256, 128)
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = 'rgba(200,190,160,.35)'
  for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 0, 1, 128)
  for (let y = 0; y < 128; y += 8) ctx.fillRect(0, y, 256, 1)
  const edge = ctx.createLinearGradient(0, 0, 0, 128)
  edge.addColorStop(0, 'rgba(120,110,90,.6)')
  edge.addColorStop(0.18, 'rgba(120,110,90,0)')
  edge.addColorStop(0.82, 'rgba(120,110,90,0)')
  edge.addColorStop(1, 'rgba(120,110,90,.6)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, 256, 128)
  return canvas
}

function metalTexture(random: () => number, base = '#5f6871') {
  const S = 256
  const [canvas, ctx] = makeCanvas(S, S)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  for (let y = 0; y < S; y += 1) {
    ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${random() * 0.08})`
    ctx.fillRect(0, y, S, 1)
  }
  for (let index = 0; index < 14; index += 1) wrapped(S, S, random() * S, random() * S, (x, y) => blotch(ctx, x, y, 12 + random() * 40, '40,32,20', 0.18))
  for (let index = 0; index < 40; index += 1) {
    ctx.strokeStyle = 'rgba(220,225,230,.18)'
    ctx.beginPath()
    const x = random() * S
    const y = random() * S
    ctx.moveTo(x, y)
    ctx.lineTo(x + (random() - 0.5) * 50, y + (random() - 0.5) * 10)
    ctx.stroke()
  }
  return canvas
}

function hazardTexture(random: () => number) {
  const S = 256
  const [canvas, ctx] = makeCanvas(S, S)
  ctx.fillStyle = '#1c1d1f'
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = '#e3a52c'
  for (let x = -S; x < S * 2; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 32, 0)
    ctx.lineTo(x + 32 + S, S)
    ctx.lineTo(x + S, S)
    ctx.closePath()
    ctx.fill()
  }
  grain(ctx, S, S, random, 30)
  for (let index = 0; index < 18; index += 1) wrapped(S, S, random() * S, random() * S, (x, y) => blotch(ctx, x, y, 8 + random() * 30, '30,24,12', 0.35))
  return canvas
}

function doorTexture(random: () => number) {
  const S = 512
  const [color, ctx] = makeCanvas(S, S)
  const [height, hx] = makeCanvas(S, S)
  hx.fillStyle = '#808080'
  hx.fillRect(0, 0, S, S)
  for (let x = 0; x < S; x += 32) {
    const rib = ctx.createLinearGradient(x, 0, x + 32, 0)
    rib.addColorStop(0, '#59626a')
    rib.addColorStop(0.5, '#8a939a')
    rib.addColorStop(1, '#4c545b')
    ctx.fillStyle = rib
    ctx.fillRect(x, 0, 32, S)
    const ribHeight = hx.createLinearGradient(x, 0, x + 32, 0)
    ribHeight.addColorStop(0, '#404040')
    ribHeight.addColorStop(0.5, '#d0d0d0')
    ribHeight.addColorStop(1, '#404040')
    hx.fillStyle = ribHeight
    hx.fillRect(x, 0, 32, S)
  }
  for (let index = 0; index < 22; index += 1) blotch(ctx, random() * S, S * (0.5 + random() * 0.5), 20 + random() * 60, '58,42,18', 0.25)
  const band = Math.round(S * 0.86)
  const hazard = hazardTexture(random)
  ctx.drawImage(hazard, 0, band, S, S - band)
  ctx.fillStyle = '#2a2d30'
  ctx.fillRect(0, band - 6, S, 6)
  ctx.fillStyle = '#e8c34a'
  ctx.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.11)
  ctx.fillStyle = '#16130c'
  ctx.font = '700 30px "Arial Black", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚠ CONDITION GATE', S * 0.5, S * 0.358)
  grain(ctx, S, S, random, 14)
  return { color, height }
}

function shutterTexture(random: () => number) {
  const S = 512
  const [color, ctx] = makeCanvas(S, S)
  const [height, hx] = makeCanvas(S, S)
  for (let y = 0; y < S; y += 24) {
    const slat = ctx.createLinearGradient(0, y, 0, y + 24)
    slat.addColorStop(0, '#8d969d')
    slat.addColorStop(0.55, '#6a737a')
    slat.addColorStop(1, '#3f464c')
    ctx.fillStyle = slat
    ctx.fillRect(0, y, S, 24)
    const slatHeight = hx.createLinearGradient(0, y, 0, y + 24)
    slatHeight.addColorStop(0, '#e0e0e0')
    slatHeight.addColorStop(1, '#303030')
    hx.fillStyle = slatHeight
    hx.fillRect(0, y, S, 24)
  }
  for (let index = 0; index < 20; index += 1) blotch(ctx, random() * S, random() * S, 20 + random() * 70, '58,42,18', 0.2)
  ctx.fillStyle = '#2b2f33'
  ctx.fillRect(0, S - 30, S, 30)
  ctx.drawImage(hazardTexture(random), 0, S - 26, S, 22)
  grain(ctx, S, S, random, 12)
  return { color, height }
}

function normalMap(source: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const width = source.width
  const height = source.height
  const pixels = source.getContext('2d')!.getImageData(0, 0, width, height).data
  const [canvas, ctx] = makeCanvas(width, height)
  const image = ctx.createImageData(width, height)
  const sample = (x: number, y: number) => pixels[(((y + height) % height) * width + ((x + width) % width)) * 4] / 255
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength
      const length = Math.hypot(dx, dy, 1)
      const index = (y * width + x) * 4
      image.data[index] = (-dx / length * 0.5 + 0.5) * 255
      image.data[index + 1] = (dy / length * 0.5 + 0.5) * 255
      image.data[index + 2] = (1 / length * 0.5 + 0.5) * 255
      image.data[index + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function signCanvas(text: string, color: string, width = 512, height = 128) {
  const [canvas, ctx] = makeCanvas(width, height)
  ctx.fillStyle = '#060807'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(255,255,255,.035)'
  for (let y = 3; y < height; y += 6) for (let x = 3; x < width; x += 6) ctx.fillRect(x, y, 2, 2)
  ctx.font = `700 ${Math.round(height * 0.62)}px "Backroom Pixel", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = height * 0.18
  ctx.fillStyle = color
  ctx.fillText(text, width / 2, height * 0.54)
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.12)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, width - 4, height - 4)
  return canvas
}

function plaqueCanvas(text: string, arrow: -1 | 0 | 1) {
  const [canvas, ctx] = makeCanvas(256, 128)
  ctx.fillStyle = arrow === 0 ? '#e7e1cf' : '#e6c04a'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = '#2a2516'
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, 240, 112)
  ctx.fillStyle = '#1d1a10'
  if (arrow === 0) {
    ctx.font = '700 44px "Arial Black", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 64)
  } else {
    ctx.save()
    ctx.translate(128, 64)
    // The path below points left; mirror it for a right turn.
    ctx.scale(-arrow, 1)
    ctx.beginPath()
    ctx.moveTo(-70, 0)
    ctx.lineTo(-10, -42)
    ctx.lineTo(-10, -18)
    ctx.lineTo(70, -18)
    ctx.lineTo(70, 18)
    ctx.lineTo(-10, 18)
    ctx.lineTo(-10, 42)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  return canvas
}

function dashCanvas() {
  const [canvas, ctx] = makeCanvas(32, 256)
  ctx.fillStyle = '#e0892f'
  for (let y = 0; y < 256; y += 64) ctx.fillRect(0, y, 32, 36)
  return canvas
}

function dotCanvas() {
  const [canvas, ctx] = makeCanvas(64, 64)
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return canvas
}

// ---------- Camcorder post-processing ----------

const FootageShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    night: { value: 0 },
    glitch: { value: 0 },
    alert: { value: 0 },
    aberration: { value: 0.0022 },
    grain: { value: 0.055 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, night, glitch, alert, aberration, grain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float tick = floor(time * 24.0);
      float band = floor(uv.y * 54.0);
      float slip = step(1.0 - glitch * 0.2, hash(vec2(band, tick)));
      uv.x += slip * (hash(vec2(tick, band + 7.0)) - 0.5) * 0.08 * glitch;
      uv.x += sin(uv.y * 240.0 + time * 50.0) * 0.0008 * glitch;
      vec2 dir = uv - 0.5;
      float dist = length(dir);
      float ab = aberration + glitch * 0.007;
      vec3 col = vec3(texture2D(tDiffuse, uv + dir * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ab).b);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, 0.9);
      col *= vec3(1.04, 1.0, 0.86);
      col = col * 0.95 + 0.018;
      float sensor = hash(uv * 640.0 + tick);
      vec3 nv = vec3(0.24, 1.0, 0.42) * (pow(luma, 0.75) * 2.3 + 0.04) + (sensor - 0.5) * 0.18;
      col = mix(col, nv, night);
      col = mix(col, col * vec3(1.35, 0.62, 0.62) + vec3(0.05, 0.0, 0.0), alert * 0.5);
      col += (hash(uv * vec2(1733.0, 977.0) + fract(time)) - 0.5) * (grain + night * 0.05);
      col *= 0.965 + 0.035 * sin(uv.y * 900.0);
      col *= mix(0.5, 1.0, smoothstep(0.9, 0.22, dist));
      float line = smoothstep(0.006, 0.0, abs(uv.y - fract(time * 0.11))) * glitch;
      col += line * 0.4;
      gl_FragColor = vec4(col, 1.0);
    }`,
}

// ---------- Helpers ----------

function hashTile(index: number, seed: number): number {
  const value = Math.imul(index + 1, 2654435761) ^ Math.imul(seed + 7, 40503)
  return (value >>> 0) % 1000
}

// Level 0 is dark now: most troffers are dead and the camcorder light does the work.
function fixtureLife(view: BackroomView, index: number): number {
  return hashTile(index, view.seed + 3) % 5 === 0 ? 0.55 : 0.1
}

function fixtureStrength(view: BackroomView, index: number): number {
  if (view.reduced || !view.lightsActive) return 1
  const character = hashTile(index, view.seed)
  if (character % 4 !== 0) return view.roomLight
  const cycle = 7 + character % 6
  const phase = (view.time + character * 0.017) % cycle
  if (phase > 0.34) return view.roomLight
  return view.roomLight * (phase < 0.07 || (phase > 0.15 && phase < 0.25) ? 0.14 : 0.72)
}

class Strip {
  readonly geometry = new THREE.BufferGeometry()
  private readonly positions: Float32Array
  private readonly normals: Float32Array
  private readonly uvs: Float32Array

  constructor(count: number) {
    this.positions = new Float32Array(count * 18)
    this.normals = new Float32Array(count * 18)
    this.uvs = new Float32Array(count * 12)
    for (const [name, array, size] of [['position', this.positions, 3], ['normal', this.normals, 3], ['uv', this.uvs, 2]] as const) {
      const attribute = new THREE.BufferAttribute(array, size)
      attribute.setUsage(THREE.DynamicDrawUsage)
      this.geometry.setAttribute(name, attribute)
    }
  }

  // Quad a-b-c-d (counter-clockwise from the visible side) with matching uvs.
  quad(index: number, a: number[], b: number[], c: number[], d: number[], ua: number[], ub: number[], uc: number[], ud: number[], normal: number[]) {
    const order = [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]
    for (let vertex = 0; vertex < 6; vertex += 1) {
      const [position, uv] = order[vertex]
      const p = (index * 6 + vertex) * 3
      const t = (index * 6 + vertex) * 2
      this.positions[p] = position[0]
      this.positions[p + 1] = position[1]
      this.positions[p + 2] = position[2]
      this.normals[p] = normal[0]
      this.normals[p + 1] = normal[1]
      this.normals[p + 2] = normal[2]
      this.uvs[t] = uv[0]
      this.uvs[t + 1] = uv[1]
    }
  }

  commit() {
    for (const name of ['position', 'normal', 'uv']) this.geometry.getAttribute(name).needsUpdate = true
  }
}

function box(width: number, height: number, depth: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  return mesh
}

// The red target a ceiling drill paints on the floor of its lane.
function drillMarkCanvas(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256)
  ctx.clearRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(255,40,40,.95)'
  ctx.shadowColor = '#ff2020'
  ctx.shadowBlur = 18
  ctx.lineWidth = 10
  for (const radius of [104, 66]) { ctx.beginPath(); ctx.arc(128, 128, radius, 0, Math.PI * 2); ctx.stroke() }
  ctx.lineWidth = 8
  for (const [x0, y0, x1, y1] of [[128, 8, 128, 60], [128, 196, 128, 248], [8, 128, 60, 128], [196, 128, 248, 128]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke() }
  ctx.fillStyle = 'rgba(255,60,60,.95)'
  ctx.beginPath(); ctx.arc(128, 128, 16, 0, Math.PI * 2); ctx.fill()
  return canvas
}

// Glowing cracks where a floor drill is about to burst through.
function drillCrackCanvas(random: () => number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256)
  ctx.clearRect(0, 0, 256, 256)
  ctx.lineCap = 'round'
  for (let crack = 0; crack < 9; crack += 1) {
    let x = 128
    let y = 128
    const angle = (crack / 9) * Math.PI * 2 + random() * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let step = 0; step < 6; step += 1) {
      x += Math.cos(angle + (random() - 0.5) * 0.9) * (14 + random() * 8)
      y += Math.sin(angle + (random() - 0.5) * 0.9) * (14 + random() * 8)
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(255,140,40,.9)'
    ctx.shadowColor = '#ff7a10'
    ctx.shadowBlur = 14
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,230,160,.95)'
    ctx.shadowBlur = 0
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 60)
  glow.addColorStop(0, 'rgba(255,150,50,.75)')
  glow.addColorStop(1, 'rgba(255,150,50,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 256, 256)
  return canvas
}

// A saw blade: brushed steel, a ring of hooked teeth, a dark hub and vent holes.
function sawCanvas(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 256)
  ctx.clearRect(0, 0, 256, 256)
  const teeth = 36
  ctx.beginPath()
  for (let index = 0; index <= teeth; index += 1) {
    const angle = (index / teeth) * Math.PI * 2
    const next = ((index + 0.6) / teeth) * Math.PI * 2
    ctx.lineTo(128 + Math.cos(angle) * 112, 128 + Math.sin(angle) * 112)
    ctx.lineTo(128 + Math.cos(next) * 127, 128 + Math.sin(next) * 127)
  }
  ctx.closePath()
  const steel = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  steel.addColorStop(0, '#d9dde0')
  steel.addColorStop(0.7, '#9aa2a8')
  steel.addColorStop(1, '#60686e')
  ctx.fillStyle = steel
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.18)'
  for (let ring = 30; ring < 105; ring += 6) { ctx.beginPath(); ctx.arc(128, 128, ring, 0, Math.PI * 2); ctx.stroke() }
  ctx.fillStyle = '#2b3034'
  ctx.beginPath(); ctx.arc(128, 128, 22, 0, Math.PI * 2); ctx.fill()
  for (let hole = 0; hole < 4; hole += 1) {
    const angle = (hole / 4) * Math.PI * 2
    ctx.beginPath(); ctx.arc(128 + Math.cos(angle) * 60, 128 + Math.sin(angle) * 60, 9, 0, Math.PI * 2); ctx.fill()
  }
  return canvas
}

// The edge of a hole: torn carpet fibres around pure black.
function holeCanvas(random: () => number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(256, 128)
  ctx.clearRect(0, 0, 256, 128)
  const gradient = ctx.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, '#000')
  gradient.addColorStop(0.5, '#000')
  gradient.addColorStop(1, '#000')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(0, 18)
  for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, 10 + random() * 14)
  ctx.lineTo(256, 118)
  for (let x = 256; x >= 0; x -= 8) ctx.lineTo(x, 104 + random() * 14)
  ctx.closePath()
  ctx.fill()
  // A torn lip of darker carpet around the opening.
  ctx.strokeStyle = 'rgba(48,34,16,.85)'
  ctx.lineWidth = 5
  ctx.stroke()
  return canvas
}

// ---------- Scene ----------

export function createBackroomScene(canvas: HTMLCanvasElement): BackroomRendererHandle | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  canvas.classList.remove('is-pixel')
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)
  let quality = touch ? 0.8 : 1
  const maxQuality = touch ? 1 : 1.25

  const random = mulberry32(20260214)
  const owned: Array<{ dispose(): void }> = []
  const track = <T extends { dispose(): void }>(item: T) => { owned.push(item); return item }
  const texture = (source: HTMLCanvasElement, srgb: boolean, repeatX = 1, repeatY = 1) => {
    const result = track(new THREE.CanvasTexture(source))
    result.wrapS = THREE.RepeatWrapping
    result.wrapT = THREE.RepeatWrapping
    result.repeat.set(repeatX, repeatY)
    result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    result.anisotropy = anisotropy
    return result
  }

  const scene = new THREE.Scene()
  const fogColor = new THREE.Color(0x0b0905)
  scene.background = fogColor
  scene.fog = new THREE.FogExp2(fogColor, 0.075)
  const camera = new THREE.PerspectiveCamera(70, 1, 0.04, 60)
  camera.rotation.order = 'YXZ'
  scene.add(camera)

  // Surfaces.
  const wall = wallpaper(random)
  const floor = carpet(random)
  const ceiling = ceilingTiles(random)
  const wallMaterial = track(new THREE.MeshStandardMaterial({ map: texture(wall.color, true), normalMap: texture(normalMap(wall.height, 2.2), false), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.86 }))
  const floorMaterial = track(new THREE.MeshStandardMaterial({ map: texture(floor.color, true), normalMap: texture(normalMap(floor.height, 3), false), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1 }))
  const ceilingMaterial = track(new THREE.MeshStandardMaterial({ map: texture(ceiling.color, true), normalMap: texture(normalMap(ceiling.height, 3.5), false), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.92 }))
  const strips = { floor: new Strip(SEGMENTS), ceiling: new Strip(SEGMENTS), left: new Strip(SEGMENTS), right: new Strip(SEGMENTS) }
  for (const [strip, material] of [[strips.floor, floorMaterial], [strips.ceiling, ceilingMaterial], [strips.left, wallMaterial], [strips.right, wallMaterial]] as const) {
    track(strip.geometry)
    const mesh = new THREE.Mesh(strip.geometry, material)
    mesh.frustumCulled = false
    scene.add(mesh)
  }

  // Fluorescent troffers: bright lenses for bloom, plus a few real lights.
  const lensMaterial = track(new THREE.MeshBasicMaterial({ map: texture(lensTexture(), true), toneMapped: false }))
  const lenses = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.46, 0.012, 0.21)), lensMaterial, FIXTURES)
  const housingMaterial = track(new THREE.MeshStandardMaterial({ color: 0xcfc8ad, roughness: 0.6, metalness: 0.2 }))
  const housings = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.54, 0.012, 0.29)), housingMaterial, FIXTURES)
  lenses.frustumCulled = false
  housings.frustumCulled = false
  scene.add(lenses, housings)
  // Troffers throw light downward; the ceiling only gets the warm bounce.
  const lamps = Array.from({ length: LAMPS }, () => {
    const lamp = new THREE.SpotLight(0xffefc6, 0, 0, 1.25, 0.9, 2)
    scene.add(lamp, lamp.target)
    return lamp
  })
  const hemisphere = new THREE.HemisphereLight(0xfff0c8, 0xa88f52, 0.55)
  scene.add(hemisphere)
  // The camcorder's infrared lamp: only on during NIGHTSHOT.
  const infrared = new THREE.SpotLight(0xffffff, 0, 14, 0.8, 0.7, 1.4)
  infrared.position.set(0, 0, 0)
  infrared.target.position.set(0, -0.15, -1)
  camera.add(infrared, infrared.target)
  // The camcorder's video light: the main light in Level 0, as bright as the batteries allow.
  const videoLight = new THREE.SpotLight(0xfff0d4, 11, 16, 0.62, 0.55, 1.4)
  videoLight.position.set(0.06, 0.05, 0)
  videoLight.target.position.set(0, -0.12, -1)
  camera.add(videoLight, videoLight.target)

  // Gate.
  const metalMaterial = track(new THREE.MeshStandardMaterial({ map: texture(metalTexture(random), true), color: 0xffffff, metalness: 0.75, roughness: 0.38 }))
  const darkMetal = track(new THREE.MeshStandardMaterial({ map: texture(metalTexture(random, '#2c3238'), true), metalness: 0.7, roughness: 0.45 }))
  const hazardSource = hazardTexture(random)
  const hazardMaterial = track(new THREE.MeshStandardMaterial({ map: texture(hazardSource, true, 1, 1), roughness: 0.65, metalness: 0.3 }))
  const hazardBoardMaterial = track(new THREE.MeshStandardMaterial({ map: texture(hazardSource, true, 6, 0.4), roughness: 0.6 }))
  const pillarMaterial = track(new THREE.MeshStandardMaterial({ map: texture(hazardSource, true, 0.6, 4), roughness: 0.6, metalness: 0.3 }))
  const door = doorTexture(random)
  const doorMaterial = track(new THREE.MeshStandardMaterial({ map: texture(door.color, true), normalMap: texture(normalMap(door.height, 4), false), metalness: 0.6, roughness: 0.48 }))
  const shutter = shutterTexture(random)
  const shutterMaps = { map: texture(shutter.color, true), normalMap: texture(normalMap(shutter.height, 4), false) }
  const shutterMaterials = [0, 1].map(() => track(new THREE.MeshStandardMaterial({ ...shutterMaps, metalness: 0.6, roughness: 0.5, emissive: 0xff2030, emissiveIntensity: 0 })))
  const ledMaterial = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))

  const gate = new THREE.Group()
  const postX = HALF - 0.07
  gate.add(box(0.14, HEIGHT, 0.22, metalMaterial, -postX, HEIGHT / 2), box(0.14, HEIGHT, 0.22, metalMaterial, postX, HEIGHT / 2))
  gate.add(box(HALF * 2, HEIGHT - DOOR_TOP, 0.24, darkMetal, 0, (HEIGHT + DOOR_TOP) / 2))
  gate.add(box(0.15, 0.22, 0.23, hazardMaterial, -postX, 0.11), box(0.15, 0.22, 0.23, hazardMaterial, postX, 0.11))
  const leds = [-1, 1].map((side) => box(0.02, 0.64, 0.02, ledMaterial, side * (HALF - 0.15), 0.5, 0.1))
  const beacons = [-1, 1].map((side) => {
    const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.032, 16, 12)), ledMaterial)
    beacon.position.set(side * postX, DOOR_TOP - 0.07, 0.12)
    return beacon
  })
  gate.add(...leds, ...beacons)
  const setDoors = [-1, 1].map((side) => box(0.63, DOOR_TOP, 0.05, doorMaterial, side * 0.315, DOOR_TOP / 2, 0))
  const pillar = box(0.12, DOOR_TOP, 0.16, pillarMaterial, 0, DOOR_TOP / 2, 0)
  const shutters = [-1, 1].map((side, index) => box(0.565, DOOR_TOP, 0.04, shutterMaterials[index], side * 0.3425, DOOR_TOP / 2, 0))
  gate.add(...setDoors, pillar, ...shutters)
  const signTextures = new Map<string, THREE.CanvasTexture>()
  const signTexture = (text: string, color: number) => {
    const key = `${text}|${color}`
    let cached = signTextures.get(key)
    if (!cached) {
      cached = texture(signCanvas(text, `#${color.toString(16).padStart(6, '0')}`), true)
      signTextures.set(key, cached)
    }
    return cached
  }
  const signMaterial = (map: THREE.Texture) => track(new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }))
  const topSign = new THREE.Mesh(track(new THREE.PlaneGeometry(1.0, 0.22)), signMaterial(signTexture('?  ?  ?', signalColors.unknown)))
  topSign.position.set(0, (HEIGHT + DOOR_TOP) / 2, 0.123)
  const doorSigns = [-1, 1].map((side) => {
    const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, 0.17)), signMaterial(signTexture('TRUE', signalColors.true)))
    sign.position.set(side * 0.33, (HEIGHT + DOOR_TOP) / 2, 0.123)
    return sign
  })
  gate.add(topSign, ...doorSigns)
  const gateLight = new THREE.PointLight(0xffffff, 0, 0, 2)
  gateLight.position.set(0, 0.55, 0.55)
  gate.add(gateLight)
  scene.add(gate)

  const laneTexture = texture(dashCanvas(), true, 1, 7)
  const lane = new THREE.Mesh(track(new THREE.PlaneGeometry(0.045, 7)), track(new THREE.MeshStandardMaterial({ map: laneTexture, alphaTest: 0.5, roughness: 0.8 })))
  lane.rotation.x = -Math.PI / 2
  scene.add(lane)

  // Wall plaques: the gate number, and arrows before each bend.
  const plaqueGeometry = track(new THREE.PlaneGeometry(0.28, 0.14))
  const gatePlaque = new THREE.Mesh(plaqueGeometry, track(new THREE.MeshStandardMaterial({ roughness: 0.7 })))
  let plaqueLabel = ''
  scene.add(gatePlaque)
  const arrowMaps = { [-1]: texture(plaqueCanvas('', -1), true), [1]: texture(plaqueCanvas('', 1), true) } as Record<-1 | 1, THREE.Texture>
  // Turn signs hang from the ceiling and face the runner, like real wayfinding signs.
  const rodGeometry = track(new THREE.BoxGeometry(0.008, 0.2, 0.008))
  const arrows = Array.from({ length: 3 }, () => {
    const sign = new THREE.Group()
    const plaque = new THREE.Mesh(plaqueGeometry, track(new THREE.MeshStandardMaterial({ map: arrowMaps[1], roughness: 0.7 })))
    const rods = [-0.11, 0.11].map((x) => {
      const rod = new THREE.Mesh(rodGeometry, darkMetal)
      rod.position.set(x, 0.17, 0)
      return rod
    })
    sign.add(plaque, ...rods)
    scene.add(sign)
    return sign
  })

  // Obstacles.
  const fabric = track(new THREE.MeshStandardMaterial({ color: 0x2e2a27, roughness: 0.95 }))
  const chrome = track(new THREE.MeshStandardMaterial({ color: 0x3c4146, metalness: 0.85, roughness: 0.3 }))
  const chair = new THREE.Group()
  chair.add(box(0.3, 0.06, 0.28, fabric, 0, 0.25, 0))
  const back = box(0.28, 0.32, 0.05, fabric, 0, 0.45, -0.13)
  back.rotation.x = -0.14
  chair.add(back, box(0.03, 0.09, 0.18, chrome, -0.16, 0.31, 0), box(0.03, 0.09, 0.18, chrome, 0.16, 0.31, 0))
  const column = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12)), chrome)
  column.position.y = 0.13
  chair.add(column)
  for (let spoke = 0; spoke < 5; spoke += 1) {
    const arm = box(0.17, 0.02, 0.025, chrome, 0, 0.045, 0)
    arm.geometry.translate(0.085, 0, 0)
    arm.rotation.y = (spoke / 5) * Math.PI * 2
    chair.add(arm)
    const wheel = new THREE.Mesh(track(new THREE.SphereGeometry(0.02, 10, 8)), fabric)
    wheel.position.set(Math.cos(arm.rotation.y) * 0.165, 0.02, -Math.sin(arm.rotation.y) * 0.165)
    chair.add(wheel)
  }
  chair.rotation.y = 0.5
  const bin = new THREE.Group()
  const binBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.09, 0.3, 24, 1, true)), track(new THREE.MeshStandardMaterial({ map: texture(metalTexture(random, '#59605f'), true), metalness: 0.7, roughness: 0.42, side: THREE.DoubleSide })))
  binBody.position.y = 0.15
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.11, 0.008, 8, 24)), chrome)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.3
  bin.add(binBody, rim)
  const paper = track(new THREE.MeshStandardMaterial({ color: 0xe6e0cc, roughness: 0.9, flatShading: true }))
  for (let index = 0; index < 4; index += 1) {
    const ball = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.04 + random() * 0.02, 0)), paper)
    ball.position.set((random() - 0.5) * 0.12, 0.29 + random() * 0.03, (random() - 0.5) * 0.12)
    bin.add(ball)
  }
  const barrier = new THREE.Group()
  barrier.add(box(1.36, 0.07, 0.03, hazardBoardMaterial, 0, 0.33, 0), box(1.36, 0.05, 0.03, hazardBoardMaterial, 0, 0.19, 0))
  for (const side of [-0.6, 0.6]) {
    for (const lean of [-1, 1]) {
      const leg = box(0.035, 0.38, 0.035, darkMetal, side, 0.18, lean * 0.06)
      leg.rotation.x = lean * 0.3
      barrier.add(leg)
    }
  }
  const barrierLampMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.3), toneMapped: false }))
  const barrierLamps = [-0.6, 0.6].map((side) => {
    const lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.026, 12, 10)), barrierLampMaterial)
    lamp.position.set(side, 0.4, 0)
    return lamp
  })
  barrier.add(...barrierLamps)
  // A hole: torn carpet around nothing, a shaft that never ends, and two red warning lights.
  const hole = new THREE.Group()
  const holeLength = holeHalfLength * 2
  const holeMaterial = track(new THREE.MeshBasicMaterial({ map: texture(holeCanvas(random), true), transparent: true, polygonOffset: true, polygonOffsetFactor: -4 }))
  const opening = new THREE.Mesh(track(new THREE.PlaneGeometry(HALF * 2 + 0.02, holeLength + 0.08)), holeMaterial)
  opening.rotation.x = -Math.PI / 2
  opening.position.y = 0.003
  const shaftMaterial = track(new THREE.MeshStandardMaterial({ color: 0x1a140c, roughness: 1, side: THREE.DoubleSide }))
  const shaftDepth = 8
  const shaftWalls = [
    box(HALF * 2, shaftDepth, 0.01, shaftMaterial, 0, -shaftDepth / 2, holeLength / 2),
    box(HALF * 2, shaftDepth, 0.01, shaftMaterial, 0, -shaftDepth / 2, -holeLength / 2),
    box(0.01, shaftDepth, holeLength, shaftMaterial, -HALF, -shaftDepth / 2, 0),
    box(0.01, shaftDepth, holeLength, shaftMaterial, HALF, -shaftDepth / 2, 0),
  ]
  const holeLampMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.2), toneMapped: false }))
  const holeLamps = [-1, 1].map((side) => {
    const lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 12, 10)), holeLampMaterial)
    lamp.position.set(side * (HALF - 0.06), 0.03, holeLength / 2 + 0.08)
    return lamp
  })
  hole.add(opening, ...shaftWalls, ...holeLamps)

  // A giant saw: a toothed steel disc spinning out of a slot in the wall, throwing sparks.
  const SAW_RADIUS = HALF + sawReach
  const bladeMaterial = track(new THREE.MeshStandardMaterial({ map: texture(sawCanvas(), true), alphaTest: 0.5, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide }))
  const slotMaterial = track(new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 1 }))
  const sparkMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4), toneMapped: false }))
  const makeSaw = () => {
    const group = new THREE.Group()
    // The disc faces the runner, so its teeth and its reach across the corridor read at a glance.
    const spinner = new THREE.Group()
    const blade = new THREE.Mesh(track(new THREE.CircleGeometry(SAW_RADIUS, 72)), bladeMaterial)
    spinner.add(blade)
    group.add(spinner)
    const slot = box(0.03, 1.15, 0.08, slotMaterial, 0, 0.58, 0)
    group.add(slot)
    const sparks = Array.from({ length: 6 }, () => {
      const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.012, 6, 4)), sparkMaterial)
      group.add(spark)
      return spark
    })
    const glow = new THREE.PointLight(0xff8a3a, 0, 2.2, 2)
    group.add(glow)
    return { group, spinner, blade, slot, sparks, glow }
  }
  const sawRigs = [makeSaw(), makeSaw()]
  const sawGroups = sawRigs.map((rig) => rig.group)

  // A giant electric drill: a gold twist bit with real flutes, a ribbed chuck, a yellow motor
  // crackling with blue arcs. It marks its lane first, then punches through the ceiling or the floor.
  const BIT_LENGTH = 1.0
  const bitCore = track(new THREE.MeshStandardMaterial({ color: 0x8a7a55, metalness: 0.9, roughness: 0.3 }))
  const bitFlute = track(new THREE.MeshStandardMaterial({ color: 0xe0b24a, metalness: 0.95, roughness: 0.22, emissive: 0x2a1a00 }))
  const motorPaint = track(new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5, metalness: 0.2 }))
  const arcMaterial = track(new THREE.LineBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4), toneMapped: false, transparent: true }))
  const markMaterial = track(new THREE.MeshBasicMaterial({ map: texture(drillMarkCanvas(), true), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }))
  const crackMaterial = track(new THREE.MeshBasicMaterial({ map: texture(drillCrackCanvas(random), true), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }))
  const chunkMaterial = track(new THREE.MeshStandardMaterial({ color: 0x9c8452, roughness: 0.9 }))
  const fluteGeometry = (phase: number) => {
    const points: THREE.Vector3[] = []
    for (let step = 0; step <= 80; step += 1) {
      const t = step / 80
      const radius = 0.03 + 0.17 * Math.min(1, t * 3.2)
      const angle = phase + t * Math.PI * 2 * 4.5
      points.push(new THREE.Vector3(Math.cos(angle) * radius, t * BIT_LENGTH * 0.92, Math.sin(angle) * radius))
    }
    return track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.042, 8, false))
  }
  const makeDrill = () => {
    const group = new THREE.Group()
    // Built tip-down from the origin; floor drills are flipped over.
    const rig = new THREE.Group()
    const spin = new THREE.Group()
    const core = new THREE.Mesh(track(new THREE.ConeGeometry(0.16, BIT_LENGTH, 28, 1)), bitCore)
    core.rotation.x = Math.PI
    core.position.y = BIT_LENGTH / 2
    spin.add(core, new THREE.Mesh(fluteGeometry(0), bitFlute), new THREE.Mesh(fluteGeometry(Math.PI), bitFlute))
    const chuck = new THREE.Group()
    const chuckBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.17, 0.22, 28)), darkMetal)
    chuckBody.position.y = BIT_LENGTH + 0.1
    chuck.add(chuckBody)
    for (let ring = 0; ring < 3; ring += 1) {
      const rib = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.012, 6, 28)), chrome)
      rib.rotation.x = Math.PI / 2
      rib.position.y = BIT_LENGTH + 0.03 + ring * 0.07
      chuck.add(rib)
    }
    spin.add(chuck)
    const motor = new THREE.Mesh(track(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 32)), motorPaint)
    motor.position.y = BIT_LENGTH + 0.46
    rig.add(spin, motor)
    // Electric arcs around the motor: jagged lines redrawn every frame.
    const arcs = Array.from({ length: 3 }, () => {
      const geometry = track(new THREE.BufferGeometry())
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3))
      const line = new THREE.Line(geometry, arcMaterial)
      rig.add(line)
      return line
    })
    group.add(rig)
    const mark = new THREE.Mesh(track(new THREE.PlaneGeometry(0.7, 0.7)), markMaterial)
    mark.rotation.x = -Math.PI / 2
    mark.position.y = 0.006
    const cracks = new THREE.Mesh(track(new THREE.PlaneGeometry(0.85, 0.85)), crackMaterial)
    cracks.rotation.x = -Math.PI / 2
    cracks.position.y = 0.007
    group.add(mark, cracks)
    const chunks = Array.from({ length: 9 }, (_, index) => {
      const chunk = box(0.05 + (index % 3) * 0.02, 0.02, 0.05, chunkMaterial)
      group.add(chunk)
      return { mesh: chunk, angle: (index / 9) * Math.PI * 2 + index * 0.37, speed: 0.6 + (index % 4) * 0.25 }
    })
    const flash = new THREE.PointLight(0xffa040, 0, 2.6, 2)
    const zap = new THREE.PointLight(0x6fb8ff, 0, 2.2, 2)
    group.add(flash, zap)
    scene.add(group)
    return { group, rig, spin, arcs, mark, cracks, chunks, flash, zap }
  }
  const drillRigs = [makeDrill(), makeDrill()]

  // A corridor can hold two hazards, so barriers, holes, saws and drills come in pairs.
  const obstaclePools: Record<CorridorObstacle['kind'], THREE.Group[]> = { chair: [chair], trash: [bin], barrier: [barrier, barrier.clone()], hole: [hole, hole.clone()], saw: sawGroups, drill: drillRigs.map((rig) => rig.group) }
  for (const pool of Object.values(obstaclePools)) scene.add(...pool)

  // Spare batteries: a white pack with four green charge LEDs, glowing on the carpet.
  const packMaterial = track(new THREE.MeshStandardMaterial({ color: 0xe9e7e0, roughness: 0.45, metalness: 0.1, emissive: 0x2a2a26 }))
  const packLedMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3, 1.1), toneMapped: false }))
  const packs = Array.from({ length: 2 }, () => {
    const pack = new THREE.Group()
    pack.add(box(0.17, 0.1, 0.11, packMaterial, 0, 0, 0))
    for (let led = 0; led < 4; led += 1) pack.add(box(0.018, 0.012, 0.012, packLedMaterial, -0.045 + led * 0.03, 0.03, 0.058))
    pack.add(box(0.06, 0.02, 0.06, darkMetal, 0, -0.06, 0))
    const glow = new THREE.PointLight(0x5dff9a, 0.9, 1.6, 2)
    glow.position.set(0, 0.05, 0.1)
    pack.add(glow)
    scene.add(pack)
    return pack
  })

  // The door into Level 0: a partition across the corridor with an office door that swings in.
  const entry = new THREE.Group()
  const doorPaint = track(new THREE.MeshStandardMaterial({ color: 0xb8a679, roughness: 0.62, metalness: 0.05 }))
  const sideWidth = HALF - ENTRY_HALF
  entry.add(
    box(sideWidth, HEIGHT, 0.08, wallMaterial, -HALF + sideWidth / 2, HEIGHT / 2, 0),
    box(sideWidth, HEIGHT, 0.08, wallMaterial, HALF - sideWidth / 2, HEIGHT / 2, 0),
    box(ENTRY_HALF * 2, HEIGHT - ENTRY_TOP, 0.08, wallMaterial, 0, (HEIGHT + ENTRY_TOP) / 2, 0),
    box(0.035, ENTRY_TOP, 0.1, darkMetal, -ENTRY_HALF, ENTRY_TOP / 2, 0),
    box(0.035, ENTRY_TOP, 0.1, darkMetal, ENTRY_HALF, ENTRY_TOP / 2, 0),
    box(ENTRY_HALF * 2 + 0.035, 0.035, 0.1, darkMetal, 0, ENTRY_TOP, 0),
  )
  const hingeGroup = new THREE.Group()
  hingeGroup.position.set(-ENTRY_HALF + 0.02, 0, 0)
  const leaf = box(ENTRY_HALF * 2 - 0.04, ENTRY_TOP - 0.02, 0.04, doorPaint, ENTRY_HALF - 0.02, (ENTRY_TOP - 0.02) / 2, 0)
  const handle = box(0.09, 0.018, 0.03, chrome, ENTRY_HALF * 2 - 0.13, 0.47, 0.035)
  const exitSign = new THREE.Mesh(track(new THREE.PlaneGeometry(0.3, 0.1)), track(new THREE.MeshBasicMaterial({ map: texture(plaqueCanvas('LEVEL 0', 0), true) })))
  exitSign.position.set(ENTRY_HALF - 0.02, 0.76, 0.022)
  hingeGroup.add(leaf, handle, exitSign)
  entry.add(hingeGroup)
  scene.add(entry)

  // The figure: never lit, only ever a silhouette.
  const shadowMaterial = track(new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, fog: false }))
  const figure = new THREE.Group()
  const limb = (radius: number, length: number, x: number, y: number) => {
    const mesh = new THREE.Mesh(track(new THREE.CylinderGeometry(radius, radius * 0.8, length, 8)), shadowMaterial)
    mesh.position.set(x, y, 0)
    return mesh
  }
  figure.add(limb(0.07, 0.48, 0, 0.66), limb(0.024, 0.44, -0.04, 0.22), limb(0.024, 0.44, 0.04, 0.22), limb(0.016, 0.56, -0.1, 0.56), limb(0.016, 0.56, 0.1, 0.56))
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.058, 12, 10)), shadowMaterial)
  head.position.y = 0.96
  head.scale.y = 1.25
  figure.add(head)
  scene.add(figure)

  // Dust drifting through the light.
  const dustPositions = new Float32Array(DUST * 3)
  const dustSeeds = Array.from({ length: DUST }, () => [random() * 1.5 - 0.75, 0.05 + random() * 1.15, random() * 12, random() * Math.PI * 2])
  const dustGeometry = track(new THREE.BufferGeometry())
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage))
  const dustMaterial = track(new THREE.PointsMaterial({ map: texture(dotCanvas(), true), color: 0xfff0c8, size: 0.014, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }))
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  dust.frustumCulled = false
  scene.add(dust)

  // Post-processing.
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 0.88)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const footage = new ShaderPass(FootageShader)
  composer.addPass(footage)

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * quality
    renderer.setPixelRatio(ratio)
    composer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()

  // Fonts can arrive after the first signs were drawn.
  void document.fonts?.load('700 40px "Backroom Pixel"').then(() => {
    signTextures.forEach((item) => item.dispose())
    signTextures.clear()
  }).catch(() => undefined)

  const matrix = new THREE.Matrix4()
  const tint = new THREE.Color()
  let lastFrame = performance.now()
  let slowFor = 0
  let fastFor = 0
  let disposed = false

  const center = (view: BackroomView, z: number) => corridorCenterAt(view.gateCenter, view.bends, z)

  const render = (view: BackroomView) => {
    if (disposed) return
    const now = performance.now()
    const frame = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    // Hold a steady frame rate on tablets by trading resolution.
    if (frame > 1 / 38) { slowFor += frame; fastFor = 0 } else if (frame < 1 / 57) { fastFor += frame; slowFor = 0 }
    if (slowFor > 1.5 && quality > 0.5) { quality = Math.max(0.5, quality - 0.1); slowFor = 0; resize() }
    if (fastFor > 5 && quality < maxQuality) { quality = Math.min(maxQuality, quality + 0.1); fastFor = 0; resize() }

    const origin = Math.floor(view.depth / 100) * 100
    const w = (z: number) => -(z - origin)

    // Corridor.
    const start = Math.floor((view.depth - BEHIND) / SEG) * SEG
    for (let index = 0; index < SEGMENTS; index += 1) {
      const z0 = start + index * SEG
      const z1 = z0 + SEG
      const c0 = center(view, z0)
      const c1 = center(view, z1)
      const w0 = w(z0)
      const w1 = w(z1)
      const v0 = z0 - origin
      const v1 = z1 - origin
      strips.floor.quad(index, [c0 - HALF, 0, w0], [c0 + HALF, 0, w0], [c1 + HALF, 0, w1], [c1 - HALF, 0, w1],
        [(c0 - HALF) / 2, v0 / 2], [(c0 + HALF) / 2, v0 / 2], [(c1 + HALF) / 2, v1 / 2], [(c1 - HALF) / 2, v1 / 2], [0, 1, 0])
      strips.ceiling.quad(index, [c0 - HALF, HEIGHT, w0], [c1 - HALF, HEIGHT, w1], [c1 + HALF, HEIGHT, w1], [c0 + HALF, HEIGHT, w0],
        [c0 - HALF, v0], [c1 - HALF, v1], [c1 + HALF, v1], [c0 + HALF, v0], [0, -1, 0])
      const dx = c1 - c0
      const length = Math.hypot(SEG, dx)
      strips.left.quad(index, [c0 - HALF, 0, w0], [c1 - HALF, 0, w1], [c1 - HALF, HEIGHT, w1], [c0 - HALF, HEIGHT, w0],
        [v0 / 4, 0], [v1 / 4, 0], [v1 / 4, 1], [v0 / 4, 1], [SEG / length, 0, dx / length])
      strips.right.quad(index, [c0 + HALF, 0, w0], [c0 + HALF, HEIGHT, w0], [c1 + HALF, HEIGHT, w1], [c1 + HALF, 0, w1],
        [-v0 / 4, 0], [-v0 / 4, 1], [-v1 / 4, 1], [-v1 / 4, 0], [-SEG / length, 0, -dx / length])
    }
    strips.floor.commit()
    strips.ceiling.commit()
    strips.left.commit()
    strips.right.commit()

    // Lights.
    const firstFixture = Math.floor((view.depth - BEHIND) / LIGHT_SPACING)
    for (let index = 0; index < FIXTURES; index += 1) {
      const fixture = firstFixture + index
      const z = fixture * LIGHT_SPACING + LIGHT_SPACING / 2
      const x = center(view, z)
      matrix.makeTranslation(x, HEIGHT - 0.013, w(z))
      lenses.setMatrixAt(index, matrix)
      matrix.makeTranslation(x, HEIGHT - 0.006, w(z))
      housings.setMatrixAt(index, matrix)
      const strength = fixtureStrength(view, fixture)
      tint.setRGB(1, 0.95, 0.82).multiplyScalar(0.05 + strength * 1.55 * fixtureLife(view, fixture))
      lenses.setColorAt(index, tint)
    }
    lenses.instanceMatrix.needsUpdate = true
    housings.instanceMatrix.needsUpdate = true
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true
    const nearestFixture = Math.ceil((view.depth - 0.6 - LIGHT_SPACING / 2) / LIGHT_SPACING)
    lamps.forEach((lamp, index) => {
      const fixture = nearestFixture + index
      const z = fixture * LIGHT_SPACING + LIGHT_SPACING / 2
      const distance = z - view.depth
      const fade = Math.min(1, Math.max(0, (distance + 0.6) / 0.8)) * Math.min(1, Math.max(0, (LAMPS * LIGHT_SPACING - distance) / 2))
      const x = center(view, z)
      lamp.position.set(x, HEIGHT - 0.03, w(z))
      lamp.target.position.set(x, 0, w(z))
      lamp.intensity = 7.5 * fixtureStrength(view, fixture) * fixtureLife(view, fixture) * fade
    })
    const room = view.reduced || !view.lightsActive ? 1 : view.roomLight
    const charge = view.cameraLight ?? 1
    // With the camera dead only the eyes are left: a faint glow near the floor.
    hemisphere.intensity = 0.02 + 0.12 * room * Math.max(0.15, charge)
    infrared.intensity = view.nightVision * 6
    videoLight.intensity = 11 * charge
    videoLight.distance = 3 + 13 * charge

    // Gate.
    const showGate = !view.hideGate && (view.phase === 'gate' ? view.gateZ - view.depth > -0.5 : view.depth >= (view.bends[view.bends.length - 1]?.endZ ?? 0) - 6)
    gate.visible = showGate
    lane.visible = false
    if (showGate) {
      const upcoming = view.phase === 'turn'
      const gateZ = upcoming ? view.nextGateZ : view.gateZ
      const fork = (upcoming ? view.nextGateKind : view.gateKind) === 'fork'
      const signal: Signal = upcoming ? 'upcoming' : view.signal
      const trueSide = upcoming ? view.nextTrueSide : view.trueSide
      const color = signalColors[signal]
      gate.position.set(upcoming ? view.nextGateCenter : view.gateCenter, 0, w(gateZ))
      const blinkOff = signal === 'false' && !view.reduced && Math.sin(view.time * (8 + view.falseIntensity * 10)) < -0.2
      ledMaterial.color.setHex(color).multiplyScalar(blinkOff ? 0.5 : 3.2)
      gateLight.color.setHex(color)
      gateLight.intensity = (signal === 'true' ? 2.4 : signal === 'upcoming' ? 0.7 : 1.5) * (blinkOff ? 0.4 : 1)
      setDoors.forEach((panel, index) => {
        panel.visible = !fork
        const side = index === 0 ? -1 : 1
        panel.position.x = side * (0.315 + (upcoming ? 0 : view.openAmount) * 0.64)
      })
      pillar.visible = fork
      shutters.forEach((panel, index) => {
        panel.visible = fork
        const open = upcoming ? 0 : view.doorOpen[index]
        panel.position.y = DOOR_TOP / 2 + open * DOOR_TOP
        const side = index === 0 ? -1 : 1
        const flash = !upcoming && view.flashSide === side ? (view.reduced ? 0.6 : 0.4 + 0.4 * Math.sin(view.time * 20)) : 0
        shutterMaterials[index].emissiveIntensity = flash
      })
      topSign.visible = !fork
      if (!fork) {
        const text = upcoming ? `GATE ${String(view.gateNumber + 1).padStart(2, '0')}` : signal === 'true' ? 'TRUE' : signal === 'false' ? 'FALSE' : '?  ?  ?'
        ;(topSign.material as THREE.MeshBasicMaterial).map = signTexture(text, color)
      }
      doorSigns.forEach((sign, index) => {
        sign.visible = fork
        const isTrue = (index === 0 ? -1 : 1) === trueSide
        ;(sign.material as THREE.MeshBasicMaterial).map = signTexture(isTrue ? 'TRUE' : 'FALSE', isTrue ? signalColors.true : signalColors.false)
      })
      if (fork && !upcoming) {
        lane.visible = true
        lane.position.set(view.gateCenter, 0.004, w(view.gateZ - 3.5))
      }
    }

    // Plaques.
    const plaqueZ = view.gateZ - 4
    gatePlaque.visible = !view.hideGate && view.phase === 'gate' && plaqueZ - view.depth > 1
    if (gatePlaque.visible) {
      const label = `GATE ${String(view.gateNumber).padStart(2, '0')}`
      if (label !== plaqueLabel) {
        const material = gatePlaque.material as THREE.MeshStandardMaterial
        material.map?.dispose()
        material.map = texture(plaqueCanvas(label, 0), true)
        material.needsUpdate = true
        plaqueLabel = label
      }
      gatePlaque.position.set(center(view, plaqueZ) - HALF + 0.004, 0.74, w(plaqueZ))
      gatePlaque.rotation.y = Math.PI / 2
    }
    arrows.forEach((sign, index) => {
      const bend = view.phase === 'turn' ? view.bends[index] : undefined
      sign.visible = !!bend && !view.hideGate
      if (!bend) return
      const z = bend.startZ - 1.4
      const side = bend.dir
      sign.position.set(center(view, z) + side * (HALF - 0.2), HEIGHT - 0.27, w(z))
      const material = (sign.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (material.map !== arrowMaps[side]) { material.map = arrowMaps[side]; material.needsUpdate = true }
    })

    // Obstacles.
    for (const pool of Object.values(obstaclePools)) pool.forEach((mesh) => { mesh.visible = false })
    const used: Partial<Record<CorridorObstacle['kind'], number>> = {}
    for (const obstacle of view.obstacles) {
      const distance = obstacle.z - view.depth
      if (view.hideGate || distance < -1 || distance > AHEAD) continue
      const mesh = obstaclePools[obstacle.kind][used[obstacle.kind] ?? 0]
      if (!mesh) continue
      used[obstacle.kind] = (used[obstacle.kind] ?? 0) + 1
      mesh.visible = true
      mesh.position.set(obstacle.kind === 'barrier' || obstacle.kind === 'hole' ? center(view, obstacle.z) : obstacle.x, 0, w(obstacle.z))
      if (obstacle.kind === 'drill') {
        const rig = drillRigs[drillRigs.findIndex((item) => item.group === mesh)]
        const fromCeiling = obstacle.side > 0
        // warn: 0..1 while the lane is marked; strike: 0..1 as the bit comes through (with a little overshoot).
        const warn = Math.min(1, Math.max(0, (drillWarn - distance) / (drillWarn - drillStrike)))
        const strike = Math.min(1, Math.max(0, (drillStrike - distance) / (drillStrike - drillOut)))
        const reach = strike >= 1 ? 1 : 1 + 2.7 * (strike - 1) ** 3 + 1.7 * (strike - 1) ** 2
        const after = Math.max(0, drillStrike - distance)
        if (fromCeiling) {
          rig.rig.rotation.z = 0
          rig.rig.position.y = HEIGHT + 0.1 - reach * (HEIGHT + 0.08)
        } else {
          rig.rig.rotation.z = Math.PI
          rig.rig.position.y = -0.1 + reach * (HEIGHT - 0.15)
        }
        rig.rig.position.x = view.reduced || strike <= 0 ? 0 : (Math.random() - 0.5) * 0.012
        rig.spin.rotation.y = view.reduced ? 0 : view.time * (strike > 0 ? 34 : 6)
        const pulse = view.reduced ? 1 : 0.55 + 0.45 * Math.sin(view.time * 14)
        rig.mark.visible = fromCeiling && warn > 0 && strike < 1
        ;(rig.mark.material as THREE.MeshBasicMaterial).opacity = warn * pulse
        rig.cracks.visible = !fromCeiling && warn > 0
        ;(rig.cracks.material as THREE.MeshBasicMaterial).opacity = Math.min(1, warn * (strike > 0 ? 1 : pulse))
        // Debris: ceiling tiles fall, carpet and concrete burst up.
        rig.chunks.forEach((chunk) => {
          chunk.mesh.visible = strike > 0 && after < 2.4
          const t = after * 0.55 * chunk.speed
          const r = 0.08 + t * 0.55
          chunk.mesh.position.set(Math.cos(chunk.angle) * r, fromCeiling ? HEIGHT - 0.05 - t * t * 2.2 : Math.max(0.01, 0.03 + t * 1.5 - t * t * 2.6), Math.sin(chunk.angle) * r)
          chunk.mesh.rotation.set(t * 6, t * 4, 0)
        })
        rig.flash.position.set(0, fromCeiling ? 0.05 : 0.1, 0)
        rig.flash.intensity = strike > 0 && after < 1.2 ? 3.2 * (1 - after / 1.2) + (view.reduced ? 0 : Math.random() * 0.8) : 0
        // Blue arcs crackle around the motor while it runs.
        const crackling = warn > 0 && !view.reduced
        rig.zap.position.set(0, fromCeiling ? Math.min(HEIGHT - 0.1, rig.rig.position.y + BIT_LENGTH + 0.3) : Math.max(0.1, rig.rig.position.y - BIT_LENGTH - 0.3), 0)
        rig.zap.intensity = crackling ? 0.6 + Math.random() * 1.6 : 0
        rig.arcs.forEach((line, index) => {
          line.visible = crackling && Math.random() > 0.35
          if (!line.visible) return
          const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute
          const start = (index / rig.arcs.length) * Math.PI * 2 + view.time * 3
          for (let point = 0; point < 8; point += 1) {
            const angle = start + point * 0.32
            const radius = 0.31 + Math.random() * 0.07
            positions.setXYZ(point, Math.cos(angle) * radius, BIT_LENGTH + 0.25 + (Math.random() - 0.5) * 0.4, Math.sin(angle) * radius)
          }
          positions.needsUpdate = true
        })
      }
      if (obstacle.kind === 'saw') {
        // The blade slides out of the wall as the runner closes in.
        const rig = sawRigs[sawGroups.indexOf(mesh)]
        const out = Math.min(1, Math.max(0, (sawEmerge - distance) / (sawEmerge - sawOut)))
        const wallX = center(view, obstacle.z) + obstacle.side * HALF
        mesh.position.x = wallX
        rig.slot.position.x = 0
        rig.spinner.position.set(obstacle.side * SAW_RADIUS * (1 - out), 0.5, 0)
        rig.blade.rotation.z = view.reduced ? 0 : -view.time * 26 * obstacle.side
        rig.glow.intensity = out > 0 ? 1.6 + (view.reduced ? 0 : Math.random() * 1.4) : 0
        rig.glow.position.set(-obstacle.side * 0.05, 0.12, 0)
        rig.sparks.forEach((spark, index) => {
          spark.visible = out > 0.2
          const t = (view.time * 3 + index / rig.sparks.length) % 1
          spark.position.set(-obstacle.side * (0.05 + t * 0.35), 0.06 + t * 0.25 - t * t * 0.35, (index % 2 ? 1 : -1) * t * 0.25)
        })
      }
    }
    barrierLampMaterial.color.setRGB(3, 1.6, 0.3).multiplyScalar(view.reduced || Math.sin(view.time * 7) > 0 ? 1 : 0.2)
    holeLampMaterial.color.setRGB(3, 0.25, 0.2).multiplyScalar(view.reduced || Math.sin(view.time * 4) > -0.3 ? 1 : 0.25)

    // Spare batteries bob and turn so they catch the eye in the dark.
    packs.forEach((pack, index) => {
      const pickup = view.pickups?.[index]
      const distance = pickup ? pickup.z - view.depth : -1
      pack.visible = !!pickup && !view.hideGate && distance > -0.5 && distance < AHEAD
      if (!pickup || !pack.visible) return
      pack.position.set(pickup.x, 0.09 + (view.reduced ? 0 : Math.sin(view.time * 3 + index) * 0.025), w(pickup.z))
      pack.rotation.y = view.reduced ? 0.4 : view.time * 1.4
    })

    // The entry door, only near the start of a run.
    const entryOpen = view.entry ?? -1
    entry.visible = entryOpen >= 0 && view.depth < ENTRY_Z + 3
    if (entry.visible) {
      entry.position.set(center(view, ENTRY_Z), 0, w(ENTRY_Z))
      // The free edge swings away from the camera, into Level 0.
      hingeGroup.rotation.y = entryOpen * 1.8
    }

    // Figure.
    const entity = view.entity
    figure.visible = !!entity && entity.alpha > 0.01
    if (entity && figure.visible) {
      const jitter = view.reduced ? 0 : (hashTile(Math.floor(view.time * 18), view.seed) % 100 - 50) / 2400
      figure.position.set(entity.x + jitter, 0, w(entity.z))
      shadowMaterial.opacity = Math.min(1, entity.alpha)
    }

    // Dust.
    for (let index = 0; index < DUST; index += 1) {
      const [x, y, z, phase] = dustSeeds[index]
      // Kept out of the lens: dust starts just ahead of the camera.
      const worldZ = view.depth + 0.8 + ((z - view.depth) % 12 + 12) % 12
      const drift = view.reduced ? 0 : Math.sin(view.time * 0.3 + phase) * 0.04
      dustPositions[index * 3] = center(view, worldZ) + x + drift
      dustPositions[index * 3 + 1] = y + (view.reduced ? 0 : Math.sin(view.time * 0.21 + phase * 2) * 0.03)
      dustPositions[index * 3 + 2] = w(worldZ)
    }
    dustGeometry.getAttribute('position').needsUpdate = true
    dustMaterial.opacity = 0.55 * Math.max(0.12, room)

    // Camera: head bob, lean into steering, a wider lens as the pace climbs.
    const ahead = center(view, view.depth + 4)
    const bob = view.reduced ? 0 : Math.sin(view.depth * 6.2) * 0.008 * (view.jump > 0 ? 0 : 1)
    const shake = view.reduced ? 0 : view.shake
    const fall = view.fall ?? 0
    camera.position.set(view.playerX + (Math.random() - 0.5) * shake * 0.03, EYE + view.jump - fall + bob + (Math.random() - 0.5) * shake * 0.03, w(view.depth))
    camera.rotation.y = -Math.atan2(ahead - view.playerX, 4) * 0.35
    camera.rotation.x = -0.035 - view.jump * 0.08 - Math.min(1.2, fall * 0.45)
    camera.rotation.z = view.reduced ? 0 : -view.steer * 0.035
    const fov = 70 + Math.min(12, Math.max(0, view.pace - 1) * 6)
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix() }

    const uniforms = footage.uniforms
    uniforms.time.value = view.time
    uniforms.night.value = view.nightVision
    uniforms.glitch.value = view.reduced ? 0 : view.glitch
    uniforms.alert.value = view.falseIntensity
    uniforms.grain.value = view.reduced ? 0.03 : 0.055
    bloom.strength = 0.42 + view.nightVision * 0.2
    composer.render()
  }

  return {
    render,
    resize,
    dispose: () => {
      disposed = true
      scene.traverse((item) => { if (item instanceof THREE.Mesh) item.geometry.dispose() })
      signTextures.forEach((item) => item.dispose())
      owned.forEach((item) => item.dispose())
      lenses.dispose()
      housings.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
}
