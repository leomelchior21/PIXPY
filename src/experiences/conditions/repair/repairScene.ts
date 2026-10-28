import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { RepairMachineId } from '../../../data/repairShop'
import { createAsciiPass } from './asciiPass'
import { buildMachine, type MachineRig, type RigFrame, type StageMood } from './repairModels'

// The repair bay: one machine on a workshop floor, under a work lamp, in front of a pegboard.

export interface StageView {
  mood: StageMood
  /** Why the machine crashed: syntax = it never powered on, runtime = it blew up halfway. */
  fault: 'syntax' | 'runtime' | null
  /** Taped off as out of order. */
  broken: boolean
  variable: string
  input: string
  outputs: string[]
  error: string | null
  /** Small line at the top of the screen. */
  caption: string
}

export type StageStyle = 'ascii' | 'real'

export interface RepairSceneHandle {
  update(view: StageView): void
  setStyle(style: StageStyle): void
  resize(): void
  dispose(): void
}

const FOV = 30
const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')!]
}

function texture(canvas: HTMLCanvasElement, repeat?: [number, number]) {
  const result = new THREE.CanvasTexture(canvas)
  result.colorSpace = THREE.SRGBColorSpace
  result.anisotropy = 8
  if (repeat) { result.wrapS = result.wrapT = THREE.RepeatWrapping; result.repeat.set(...repeat) }
  return result
}

function concrete() {
  const [canvas, ctx] = canvas2d(512, 512)
  ctx.fillStyle = '#4a4744'
  ctx.fillRect(0, 0, 512, 512)
  const image = ctx.getImageData(0, 0, 512, 512)
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (random() - 0.5) * 26
    image.data[index] += noise; image.data[index + 1] += noise; image.data[index + 2] += noise
  }
  ctx.putImageData(image, 0, 0)
  for (let index = 0; index < 14; index += 1) {
    const x = random() * 512, y = random() * 512, radius = 30 + random() * 90
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, 'rgba(20,18,16,0.22)')
    gradient.addColorStop(1, 'rgba(20,18,16,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  return texture(canvas, [5, 5])
}

/** Pegboard with tools hanging on it and a neon sign. One texture for the whole 8 × 4 m wall. */
function pegboard() {
  const [canvas, ctx] = canvas2d(2048, 1024)
  ctx.fillStyle = '#5c4630'
  ctx.fillRect(0, 0, 2048, 1024)
  ctx.fillStyle = '#2a1e12'
  for (let y = 10; y < 1024; y += 20) for (let x = 10; x < 2048; x += 20) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill() }
  const tool = (x: number, y: number, draw: () => void) => {
    ctx.save(); ctx.translate(x, y)
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8
    draw(); ctx.restore()
  }
  const steel = (y0: number, y1: number) => { const g = ctx.createLinearGradient(-30, y0, 30, y1); g.addColorStop(0, '#d9dde2'); g.addColorStop(0.5, '#8d949c'); g.addColorStop(1, '#c4c9cf'); return g }
  // Wrenches, a hammer, a screwdriver and pliers, left and right of the machine.
  for (const [x, size] of [[380, 1], [440, 0.85], [495, 0.7]] as const) tool(x, 300, () => {
    ctx.scale(size, size); ctx.fillStyle = steel(0, 300)
    ctx.fillRect(-9, 0, 18, 250)
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(0, 262, 22, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5c4630'; ctx.fillRect(-9, -30, 18, 26)
  })
  tool(1610, 280, () => {
    ctx.fillStyle = '#8a5a35'; ctx.fillRect(-10, 0, 20, 260)
    ctx.fillStyle = steel(-20, 20); ctx.fillRect(-55, -26, 110, 40)
  })
  tool(1700, 260, () => {
    ctx.fillStyle = '#e8213c'; ctx.beginPath(); ctx.roundRect(-16, 0, 32, 120, 12); ctx.fill()
    ctx.fillStyle = steel(120, 300); ctx.fillRect(-5, 120, 10, 170)
  })
  tool(1790, 270, () => {
    ctx.fillStyle = '#2b6fd6'
    ctx.save(); ctx.rotate(0.12); ctx.beginPath(); ctx.roundRect(-8, 90, 18, 170, 9); ctx.fill(); ctx.restore()
    ctx.save(); ctx.rotate(-0.12); ctx.beginPath(); ctx.roundRect(-10, 90, 18, 170, 9); ctx.fill(); ctx.restore()
    ctx.fillStyle = steel(0, 100); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(10, 96); ctx.lineTo(-10, 96); ctx.fill()
  })
  return texture(canvas)
}

function neonSign() {
  const [canvas, ctx] = canvas2d(1024, 256)
  ctx.font = '900 132px "IBM Plex Mono", monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ff4fa0'; ctx.shadowBlur = 26
  ctx.strokeStyle = '#ffb3d6'; ctx.lineWidth = 7
  ctx.strokeText('REPAIRS', 512, 132)
  return texture(canvas)
}

function bayLines(width: number, depth: number) {
  const [canvas, ctx] = canvas2d(512, 512)
  ctx.clearRect(0, 0, 512, 512)
  const band = 22
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, 512, 512); ctx.rect(band, band, 512 - band * 2, 512 - band * 2); ctx.clip('evenodd')
  for (let x = -512; x < 1024; x += 44) { ctx.fillStyle = '#b58a1c'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x + 22 + 512, 512); ctx.lineTo(x + 512, 512); ctx.fill() }
  ctx.restore()
  const result = texture(canvas)
  return new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: result, transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
}

function cautionTape() {
  const [canvas, ctx] = canvas2d(1024, 64)
  for (let x = -64; x < 1088; x += 48) { ctx.fillStyle = '#ffd21f'; ctx.fillRect(x, 0, 24, 64); ctx.fillStyle = '#16161a'; ctx.fillRect(x + 24, 0, 24, 64) }
  ctx.fillStyle = '#ffd21f'
  for (const x of [256, 768]) ctx.fillRect(x - 150, 10, 300, 44)
  ctx.fillStyle = '#16161a'; ctx.font = '900 32px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (const x of [256, 768]) ctx.fillText('OUT OF ORDER', x, 34)
  return texture(canvas)
}

function softDot() {
  const [canvas, ctx] = canvas2d(64, 64)
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// ---------- The machine's own screen ----------

const moodColors: Record<StageMood, { fg: string; bg: [string, string]; glow: string }> = {
  idle: { fg: '#9dffc0', bg: ['#0f3324', '#04110b'], glow: '#3dff8a' },
  running: { fg: '#9dffc0', bg: ['#0f3324', '#04110b'], glow: '#3dff8a' },
  ok: { fg: '#b5ffcf', bg: ['#0f3a26', '#04110b'], glow: '#3dff8a' },
  wrong: { fg: '#ffd27a', bg: ['#3d2b0c', '#140c02'], glow: '#ffb020' },
  crash: { fg: '#ffd0d8', bg: ['#5a0f1f', '#1a0307'], glow: '#ff3b5c' },
  fixed: { fg: '#d4ffe2', bg: ['#12542f', '#052012'], glow: '#5cff95' },
}

function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number) {
  let current = size
  ctx.font = `700 ${current}px "IBM Plex Mono", monospace`
  while (current > 10 && ctx.measureText(text).width > maxWidth) {
    current -= 2
    ctx.font = `700 ${current}px "IBM Plex Mono", monospace`
  }
  return current
}

function drawScreen(ctx: CanvasRenderingContext2D, width: number, height: number, view: StageView, t: number, power: number) {
  const colors = moodColors[view.mood]
  const unit = Math.min(height, width * 0.56)
  if (power < 0.05) {
    // Dead: a syntax error means the program never started.
    ctx.fillStyle = '#030304'
    ctx.fillRect(0, 0, width, height)
    const sheen = ctx.createLinearGradient(0, 0, width, height)
    sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, width, height)
    if (Math.sin(t * 5) > -0.2) {
      ctx.fillStyle = '#ff4d5e'
      ctx.font = `700 ${Math.round(unit * 0.12)}px "IBM Plex Mono", monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`NO BOOT · ${view.error ?? 'SyntaxError'}`, width / 2, height * 0.5, width * 0.9)
    }
    return
  }
  const background = ctx.createRadialGradient(width / 2, height * 0.42, 0, width / 2, height / 2, width * 0.62)
  background.addColorStop(0, colors.bg[0]); background.addColorStop(1, colors.bg[1])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.shadowColor = colors.glow; ctx.shadowBlur = unit * 0.06
  ctx.fillStyle = colors.fg
  ctx.globalAlpha = 0.75
  ctx.font = `700 ${Math.round(unit * 0.1)}px "IBM Plex Mono", monospace`
  ctx.fillText(view.caption.toUpperCase(), width * 0.06, height * 0.16, width * 0.88)
  ctx.globalAlpha = 1
  const left = width * 0.06, maxWidth = width * 0.88
  const big = (text: string, y: number, size: number, color = colors.fg) => {
    ctx.fillStyle = color
    fitText(ctx, text, Math.round(size), maxWidth)
    ctx.fillText(text, left, y)
  }
  if (view.mood === 'idle') {
    const text = `${view.variable} = ${view.input || '?'}`
    big(text, height * 0.56, unit * 0.26)
    if (Math.sin(t * 6) > 0) { const w = ctx.measureText(text).width; ctx.fillRect(left + w + unit * 0.03, height * 0.44, unit * 0.1, unit * 0.22) }
  } else if (view.mood === 'running') {
    big(`RUNNING${'.'.repeat(1 + (Math.floor(t * 4) % 3))}`, height * 0.55, unit * 0.24)
    const bar = (t * 0.9) % 1
    ctx.fillStyle = colors.fg
    ctx.globalAlpha = 0.25; ctx.fillRect(left, height * 0.8, maxWidth, unit * 0.04)
    ctx.globalAlpha = 1; ctx.fillRect(left, height * 0.8, maxWidth * bar, unit * 0.04)
  } else if (view.mood === 'crash') {
    const jitter = () => (Math.random() - 0.5) * unit * 0.05
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.8; big('ERROR', height * 0.56 + jitter(), unit * 0.34, '#3ef0ff')
    ctx.globalAlpha = 0.8; ctx.fillText('ERROR', left + jitter() * 2, height * 0.56 + jitter())
    ctx.fillStyle = '#ff3bd0'; ctx.fillText('ERROR', left + jitter() * 2, height * 0.56)
    ctx.globalAlpha = 1; ctx.fillStyle = colors.fg; ctx.fillText('ERROR', left, height * 0.56)
    for (let index = 0; index < 5; index += 1) {
      const y = Math.random() * height
      const slice = ctx.getImageData(0, y, width, Math.max(2, Math.random() * height * 0.06))
      ctx.putImageData(slice, (Math.random() - 0.5) * width * 0.08, y)
    }
    for (let index = 0; index < 220; index += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2)
    }
  } else if (view.mood === 'fixed') {
    big('WORKING!', height * 0.56, unit * 0.3)
  } else {
    const lines = view.outputs.length ? view.outputs : ['(nothing)']
    const size = lines.length > 1 ? unit * 0.2 : unit * 0.26
    lines.slice(0, 3).forEach((line, index) => {
      ctx.globalAlpha = view.outputs.length ? 1 : 0.55
      big(line, height * (lines.length > 1 ? 0.44 + index * 0.24 : 0.56), size)
    })
    ctx.globalAlpha = 1
  }
  ctx.shadowBlur = 0
  // Scanlines and a vignette, like real glass.
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1.5)
  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.7)
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

// ---------- Particles ----------

interface Particle { position: THREE.Vector3; velocity: THREE.Vector3; life: number; age: number; spin: number }

function particlePool(count: number) {
  return Array.from({ length: count }, (): Particle => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, age: 1, spin: 0 }))
}

export function createRepairScene(canvas: HTMLCanvasElement, machine: RepairMachineId, initialStyle: StageStyle = 'ascii'): RepairSceneHandle | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const background = new THREE.Color(0x1a1714)
  const black = new THREE.Color(0x000000)
  const fog = new THREE.Fog(background, 7, 16)
  scene.background = background
  scene.fog = fog
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.5

  const rig: MachineRig = buildMachine(machine)
  scene.add(rig.root)
  const bounds = new THREE.Box3().setFromObject(rig.root)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())

  // Room.
  const floorMaterial = new THREE.MeshStandardMaterial({ map: concrete(), roughness: 0.88, metalness: 0 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  const bay = bayLines(size.x + 0.7, size.z + 0.8)
  bay.rotation.x = -Math.PI / 2
  bay.position.set(center.x, 0.002, center.z)
  const wallZ = bounds.min.z - 0.9
  const wallMaterial = new THREE.MeshStandardMaterial({ map: pegboard(), roughness: 0.85 })
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMaterial)
  wall.position.set(center.x, 2, wallZ)
  wall.receiveShadow = true
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: neonSign(), transparent: true, toneMapped: false, depthWrite: false }))
  neon.position.set(center.x + size.x / 2 + 0.75, Math.max(1.2, bounds.max.y * 0.82), wallZ + 0.02)
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 }))
  skirting.position.set(center.x, 0.06, wallZ + 0.02)
  const room = [floor, bay, wall, neon, skirting]
  scene.add(...room)

  // Lights: a warm work lamp, a cool rim, and coloured lights the machine can flash.
  const hemisphere = new THREE.HemisphereLight(0xfff1dc, 0x2a2420, 0.55)
  const key = new THREE.SpotLight(0xffecd2, 60, 0, 0.5, 0.6, 2)
  key.position.set(center.x - 1.4, bounds.max.y + 2.2, bounds.max.z + 2.2)
  key.target.position.copy(center)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  key.shadow.radius = 4
  const rim = new THREE.SpotLight(0x8fb8ff, 30, 0, 0.7, 0.8, 2)
  rim.position.set(center.x + 1.8, bounds.max.y + 1.2, wallZ + 0.4)
  rim.target.position.copy(center)
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35)
  fill.position.set(3, 2, 4)
  const statusLight = new THREE.PointLight(0xff3b4e, 0, 3, 2)
  const sparkLight = new THREE.PointLight(0xffa040, 0, 2.5, 2)
  sparkLight.position.copy(rig.sparkAt)
  scene.add(hemisphere, key, key.target, rim, rim.target, fill, statusLight, sparkLight)

  // Warning beacon on top of the machine.
  const beacon = new THREE.Group()
  beacon.position.copy(rig.beaconAt)
  const beaconGlow = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3b4e, emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.92 })
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.4 }))
  beaconBase.position.y = 0.02
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), beaconGlow)
  const domeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24, 1, true), beaconGlow)
  domeLower.position.y = 0.04
  dome.position.y = 0.06
  beacon.add(beaconBase, domeLower, dome)
  statusLight.position.copy(rig.beaconAt).add(new THREE.Vector3(0, 0.12, 0.15))
  scene.add(beacon)

  // Glass and other see-through parts cast no shadow.
  rig.root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.transparent) mesh.castShadow = false
  })

  // The screen texture, sized to the screen's shape.
  const screenSize = rig.screen.userData.screen as { width: number; height: number }
  const [screenCanvas, screenContext] = canvas2d(512, Math.round(512 * (screenSize.height / screenSize.width)))
  const screenTexture = new THREE.CanvasTexture(screenCanvas)
  screenTexture.colorSpace = THREE.SRGBColorSpace
  ;(rig.screen.material as THREE.Material).dispose()
  rig.screen.material = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) })
  rig.screen.castShadow = false

  // Out-of-order tape, in an X across the lower front.
  const tapeTexture = cautionTape()
  const tapeMaterial = new THREE.MeshStandardMaterial({ map: tapeTexture, side: THREE.DoubleSide, roughness: 0.55 })
  const tapeWidth = Math.max(0.9, size.x * 1.15)
  const tapes = [0.2, -0.17].map((angle, index) => {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(tapeWidth, 0.085), tapeMaterial)
    tape.position.set(center.x, bounds.min.y + size.y * 0.24 + index * 0.02, bounds.max.z + 0.03 + index * 0.004)
    tape.rotation.z = angle
    tape.castShadow = true
    tape.visible = false
    scene.add(tape)
    return tape
  })

  // Sparks, smoke and confetti.
  const sparks = particlePool(120)
  const sparkPositions = new Float32Array(sparks.length * 3)
  const sparkGeometry = new THREE.BufferGeometry()
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
  const sparkPoints = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: 0xffc46b, size: 0.03, map: softDot(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  sparkPoints.frustumCulled = false
  const smokeTexture = softDot()
  const smoke = particlePool(16).map((particle) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, color: 0x55575c, transparent: true, opacity: 0, depthWrite: false }))
    scene.add(sprite)
    return { ...particle, sprite }
  })
  const confettiCount = 140
  const confetti = particlePool(confettiCount)
  const confettiMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.018), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 }), confettiCount)
  confettiMesh.frustumCulled = false
  const confettiColors = [0x5ce07a, 0xffd23f, 0x6fd6ff, 0xff7aa2, 0xb49cff]
  for (let index = 0; index < confettiCount; index += 1) confettiMesh.setColorAt(index, new THREE.Color(confettiColors[index % confettiColors.length]))
  scene.add(sparkPoints, confettiMesh)
  const helper = new THREE.Object3D()
  const burstSparks = (count: number) => {
    let made = 0
    for (const spark of sparks) {
      if (spark.age < spark.life) continue
      spark.position.copy(rig.sparkAt)
      spark.velocity.set((Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 2.2, 0.4 + Math.random() * 1.6)
      spark.life = 0.35 + Math.random() * 0.55
      spark.age = 0
      if (++made >= count) break
    }
  }
  const burstConfetti = () => {
    confetti.forEach((piece) => {
      piece.position.set(center.x + (Math.random() - 0.5) * size.x * 0.6, bounds.max.y + 0.1, center.z + (Math.random() - 0.5) * 0.4 + 0.2)
      piece.velocity.set((Math.random() - 0.5) * 2.4, 1.4 + Math.random() * 2.2, (Math.random() - 0.2) * 1.6)
      piece.life = 2.6 + Math.random() * 1.2
      piece.age = 0
      piece.spin = (Math.random() - 0.5) * 14
    })
  }

  // Camera, framed on the machine; drag to turn around it.
  const clock = new THREE.Clock()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40)
  const target = center.clone()
  // Aim a little above the middle: the top of the panel sits under the story text.
  target.y = center.y + size.y * 0.05
  let yaw = 0.32, pitch = 0.12, yawGoal = yaw, pitchGoal = pitch, distance = 4
  let lastTouch = -10
  let dragging: { x: number; y: number; yaw: number; pitch: number } | null = null
  const onDown = (event: PointerEvent) => {
    dragging = { x: event.clientX, y: event.clientY, yaw: yawGoal, pitch: pitchGoal }
    canvas.setPointerCapture?.(event.pointerId)
  }
  const onMove = (event: PointerEvent) => {
    if (!dragging) return
    yawGoal = THREE.MathUtils.clamp(dragging.yaw - (event.clientX - dragging.x) * 0.006, -0.85, 0.85)
    pitchGoal = THREE.MathUtils.clamp(dragging.pitch + (event.clientY - dragging.y) * 0.004, -0.04, 0.5)
    lastTouch = clock.elapsedTime
  }
  const onUp = () => { dragging = null; lastTouch = clock.elapsedTime }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 1.1)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const ascii = createAsciiPass()
  composer.addPass(ascii)
  // Surface directions of the scene, for the ASCII outlines.
  const normals = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  const normalMaterial = new THREE.MeshNormalMaterial()
  ascii.uniforms.tNormal.value = normals.texture
  const effects: THREE.Object3D[] = [sparkPoints, confettiMesh, ...smoke.map((puff) => puff.sprite)]
  let style = initialStyle
  let asciiMix = style === 'ascii' ? 1 : 0

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height))
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    // Cells about 1/92 of the width, in device pixels, with the tall shape of a text character.
    const ratio = renderer.getPixelRatio()
    const cell = THREE.MathUtils.clamp(width / 92, 4.2, 8) * ratio
    ascii.uniforms.uResolution.value.set(width * ratio, height * ratio)
    normals.setSize(Math.round(width * ratio), Math.round(height * ratio))
    ascii.uniforms.uCell.value.set(cell, cell * 1.6)
    camera.aspect = width / height
    const vertical = THREE.MathUtils.degToRad(FOV) / 2
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    // Framed close: the machine fills the panel.
    distance = Math.max((size.y * 0.5 + 0.07) / Math.tan(vertical), (size.x * 0.5 + 0.06) / Math.tan(horizontal)) * 0.98 + size.z * 0.5
    camera.updateProjectionMatrix()
  }
  resize()

  let view: StageView = { mood: 'idle', fault: null, broken: false, variable: '', input: '', outputs: [], error: null, caption: 'READY' }
  let moodSince = 0
  let act = 0
  let power = 1
  let tapeShown = 0
  let lastScreen = -1
  let nextSpark = 0
  const status = new THREE.Color()
  const statusColors: Record<StageMood, number> = { idle: 0x6fd6ff, running: 0xffb020, ok: 0x3dff86, wrong: 0xffb020, crash: 0xff3b4e, fixed: 0x3dff86 }
  const calm = reducedMotion()
  let frame = 0
  let disposed = false

  const loop = () => {
    if (disposed) return
    frame = requestAnimationFrame(loop)
    const dt = Math.min(0.05, clock.getDelta())
    const t = clock.elapsedTime
    const moodTime = t - moodSince
    const runtime = view.mood === 'crash' && view.fault === 'runtime'

    // Power: dead on a syntax error, stuttering after a runtime crash.
    const powerGoal = view.mood === 'crash' && view.fault === 'syntax' ? 0 : runtime ? (Math.random() > 0.12 ? 0.75 : 0.1) : 1
    power += (powerGoal - power) * Math.min(1, dt * (runtime ? 30 : 8))
    // A repaired machine still follows its program: a rider who is too short stays behind the barrier.
    const acting = (view.mood === 'ok' || view.mood === 'wrong' || view.mood === 'fixed') && rig.acts(view.outputs)
    act = THREE.MathUtils.clamp(act + (acting ? dt / 1.3 : -dt / 0.5), 0, 1)
    const input = Number.parseFloat(view.input)

    // Status beacon.
    status.set(statusColors[view.mood])
    const alarm = view.mood === 'crash' || view.mood === 'wrong'
    const statusLevel = view.mood === 'idle' ? 0.35 : alarm ? (Math.sin(t * (view.mood === 'crash' ? 14 : 8)) > 0 ? 1 : 0.12) : view.mood === 'running' ? 0.6 + Math.sin(t * 10) * 0.4 : 1
    beaconGlow.emissive.copy(status)
    beaconGlow.emissiveIntensity = statusLevel * 3
    statusLight.color.copy(status)
    statusLight.intensity = alarm || view.mood === 'fixed' ? statusLevel * 1.6 : 0
    beacon.rotation.y += dt * 4

    const rigFrame: RigFrame = { t, dt, mood: view.mood, moodTime, power, act, outputs: view.outputs, input: Number.isFinite(input) ? input : null, status, statusLevel }
    rig.tick(rigFrame)
    const ambient = rig.ambient?.(rigFrame) ?? 1
    // ASCII needs even, bright light so every part of the machine gets its own shade.
    hemisphere.intensity = 0.55 * ambient * (1 + asciiMix * 1.6)
    key.intensity = 60 * (0.3 + 0.7 * ambient) * (1 + asciiMix * 0.5)
    fill.intensity = 0.35 + asciiMix * 1.4
    scene.environmentIntensity = 0.5 * (0.35 + 0.65 * ambient) * (1 + asciiMix * 0.8)

    // Screen: redrawn about 20 times a second.
    if (t - lastScreen > 0.05) {
      lastScreen = t
      drawScreen(screenContext, screenCanvas.width, screenCanvas.height, view, t, power)
      screenTexture.needsUpdate = true
    }

    // Tape.
    tapeShown = THREE.MathUtils.clamp(tapeShown + (view.broken ? dt * 3 : -dt * 4), 0, 1)
    tapes.forEach((tape, index) => {
      const shown = THREE.MathUtils.smoothstep(tapeShown, index * 0.3, 0.7 + index * 0.3)
      tape.visible = shown > 0.01
      tape.scale.x = shown
    })

    // Sparks and smoke while a runtime crash is fresh.
    if (runtime && moodTime < 6 && t > nextSpark) { burstSparks(14 + Math.floor(Math.random() * 16)); sparkLight.intensity = 4; nextSpark = t + 0.35 + Math.random() * 0.9 }
    sparkLight.intensity *= Math.exp(-dt * 12)
    sparks.forEach((spark, index) => {
      if (spark.age < spark.life) {
        spark.age += dt
        spark.velocity.y -= 6 * dt
        spark.position.addScaledVector(spark.velocity, dt)
        if (spark.position.y < 0.01) { spark.position.y = 0.01; spark.velocity.y *= -0.35; spark.velocity.x *= 0.6 }
      } else spark.position.set(0, -10, 0)
      sparkPositions.set([spark.position.x, spark.position.y, spark.position.z], index * 3)
    })
    sparkGeometry.attributes.position.needsUpdate = true
    smoke.forEach((puff, index) => {
      if (puff.age >= puff.life && (runtime || view.broken && view.fault === 'runtime') && Math.random() < dt * (runtime ? 6 : 1.2) && index % (runtime ? 1 : 3) === 0) {
        puff.position.copy(rig.sparkAt).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0, 0))
        puff.velocity.set((Math.random() - 0.5) * 0.12, 0.25 + Math.random() * 0.2, 0.05)
        puff.life = 2.2 + Math.random()
        puff.age = 0
      }
      const material = puff.sprite.material
      if (puff.age < puff.life) {
        puff.age += dt
        puff.position.addScaledVector(puff.velocity, dt)
        const k = puff.age / puff.life
        puff.sprite.position.copy(puff.position)
        puff.sprite.scale.setScalar(0.12 + k * 0.6)
        material.opacity = Math.sin(Math.PI * k) * 0.5
      } else material.opacity = 0
    })

    // Confetti after a successful repair.
    let live = 0
    confetti.forEach((piece, index) => {
      if (piece.age < piece.life) {
        piece.age += dt
        piece.velocity.y -= 3.2 * dt
        piece.velocity.multiplyScalar(1 - dt * 0.9)
        piece.position.addScaledVector(piece.velocity, dt)
        if (piece.position.y < 0.01) { piece.position.y = 0.01; piece.velocity.set(0, 0, 0) }
        helper.position.copy(piece.position)
        helper.rotation.set(piece.age * piece.spin, piece.age * piece.spin * 0.7, piece.age * 2)
        helper.scale.setScalar(piece.age > piece.life - 0.4 ? (piece.life - piece.age) / 0.4 : 1)
        live += 1
      } else helper.scale.setScalar(0)
      helper.updateMatrix()
      confettiMesh.setMatrixAt(index, helper.matrix)
    })
    confettiMesh.visible = live > 0
    confettiMesh.instanceMatrix.needsUpdate = true

    // Machine shake and camera.
    const shake = calm ? 0 : runtime ? Math.max(0, 1 - moodTime / 0.7) * 0.012 : view.mood === 'running' ? 0.0012 : 0
    rig.root.position.set((Math.random() - 0.5) * shake, 0, (Math.random() - 0.5) * shake)
    const idle = !dragging && t - lastTouch > 3
    // ASCII looks at the machine almost head-on, where its shape is clearest.
    const restYaw = THREE.MathUtils.lerp(0.3, 0.16, asciiMix), restPitch = THREE.MathUtils.lerp(0.12, 0.06, asciiMix)
    const sway = idle && !calm ? Math.sin(t * 0.25) * THREE.MathUtils.lerp(0.12, 0.05, asciiMix) : 0
    yaw += ((idle ? restYaw + sway : yawGoal) - yaw) * Math.min(1, dt * (idle ? 0.8 : 8))
    pitch += ((idle ? restPitch : pitchGoal) - pitch) * Math.min(1, dt * (idle ? 0.8 : 8))
    if (idle) { yawGoal = yaw; pitchGoal = pitch }
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance)
    camera.lookAt(target)

    asciiMix += ((style === 'ascii' ? 1 : 0) - asciiMix) * Math.min(1, dt * 6)
    ascii.uniforms.uMix.value = asciiMix
    ascii.enabled = asciiMix > 0.002
    // In ASCII the room disappears: the machine stands alone on black.
    room.forEach((object) => { object.visible = asciiMix < 0.5 })
    // Bloom haze would turn the black background into dots, so the ASCII view goes without it.
    bloom.enabled = asciiMix < 0.5
    if (ascii.enabled) {
      effects.forEach((object) => { object.userData.shown = object.visible; object.visible = false })
      scene.overrideMaterial = normalMaterial
      renderer.setRenderTarget(normals)
      renderer.setClearColor(0x000000, 1)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      scene.overrideMaterial = null
      effects.forEach((object) => { object.visible = object.userData.shown })
    }
    scene.background = asciiMix < 0.5 ? background : black
    scene.fog = asciiMix < 0.5 ? fog : null
    composer.render()
  }
  frame = requestAnimationFrame(loop)

  return {
    update(next) {
      if (next.mood !== view.mood) {
        moodSince = clock.elapsedTime
        if (next.mood === 'fixed' || next.mood === 'ok' && rig.acts(next.outputs) && machine === 'quiz') burstConfetti()
        if (next.mood === 'crash' && next.fault === 'runtime') nextSpark = 0
      }
      view = next
    },
    setStyle(next) { style = next },
    resize,
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
        materials.forEach((material) => {
          Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) value.dispose() })
          material.dispose()
        })
      })
      normals.dispose()
      environment.dispose()
      pmrem.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
