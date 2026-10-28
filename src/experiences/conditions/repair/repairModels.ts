import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { RepairMachineId } from '../../../data/repairShop'

// The eight machines of the repair shop, built from primitives in metres (y up, the front faces +z).

export type StageMood = 'idle' | 'running' | 'ok' | 'wrong' | 'crash' | 'fixed'

export interface RigFrame {
  t: number
  dt: number
  mood: StageMood
  /** Seconds since the mood changed. */
  moodTime: number
  /** 0 = no power at all (syntax error), 1 = running normally. */
  power: number
  /** 0..1: how far the machine is into doing its job (door open, fan on…). */
  act: number
  outputs: string[]
  input: number | null
  /** Status light colour and brightness, set by the scene. */
  status: THREE.Color
  statusLevel: number
}

export interface MachineRig {
  root: THREE.Group
  screen: THREE.Mesh
  /** Where sparks and smoke come out. */
  sparkAt: THREE.Vector3
  /** Where the warning beacon sits. */
  beaconAt: THREE.Vector3
  /** True when these outputs make the machine do its job. */
  acts(outputs: string[]): boolean
  tick(frame: RigFrame): void
  /** Optional room brightness, 0..1 (the lamp uses the light level). */
  ambient?(frame: RigFrame): number
}

// ---------- Materials and shapes ----------

const paint = (color: THREE.ColorRepresentation, roughness = 0.36) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.22 })
const plastic = (color: THREE.ColorRepresentation, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
const metal = (color: THREE.ColorRepresentation = 0x9aa3ad, roughness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 1 })
const glow = (color: THREE.ColorRepresentation, intensity = 2, base: THREE.ColorRepresentation = 0x111111) => new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity, roughness: 0.35 })
const glass = (opacity = 0.16) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity, envMapIntensity: 1.6, depthWrite: false })

function rbox(width: number, height: number, depth: number, radius = 0.015) {
  return new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2 - 0.001, height / 2 - 0.001, depth / 2 - 0.001))
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function add(parent: THREE.Object3D, ...children: THREE.Object3D[]) {
  children.forEach((child) => parent.add(child))
  return parent
}

/** A flat panel lying between two (z, y) points of a side profile. */
function slab(a: [number, number], b: [number, number], width: number, thickness: number, material: THREE.Material) {
  const dz = b[0] - a[0], dy = b[1] - a[1]
  const mesh = part(new THREE.BoxGeometry(width, thickness, Math.hypot(dz, dy)), material, 0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2)
  mesh.rotation.x = -Math.atan2(dy, dz)
  return mesh
}

/** A point on that panel, pushed out along its outward normal, and the normal itself. */
function onSlab(a: [number, number], b: [number, number], s: number, out: number) {
  const dz = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dz, dy)
  let nz = dy / length, ny = -dz / length
  if (nz + ny < 0) { nz = -nz; ny = -ny }
  return { z: a[0] + dz * s + nz * out, y: a[1] + dy * s + ny * out, nz, ny }
}

function screenMesh(width: number, height: number) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x000000 }))
  mesh.userData.screen = { width, height }
  return mesh
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function label(text: string, width: number, height: number, options: { bg: string; fg: string; font?: string; glow?: string; size?: number }) {
  return canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = options.bg
    ctx.fillRect(0, 0, width, height)
    ctx.font = `900 ${options.size ?? Math.round(height * 0.56)}px ${options.font ?? '"IBM Plex Mono", monospace'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (options.glow) { ctx.shadowColor = options.glow; ctx.shadowBlur = height * 0.18 }
    ctx.fillStyle = options.fg
    ctx.fillText(text, width / 2, height / 2 + height * 0.03, width * 0.92)
  })
}

export function woodTexture(base = '#8a5a35', grain = '#5e3a1f') {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 512, 512)
    for (let row = 0; row < 90; row += 1) {
      const y = (row * 37) % 512
      ctx.strokeStyle = grain
      ctx.globalAlpha = 0.12 + ((row * 13) % 7) / 40
      ctx.lineWidth = 1 + (row % 3)
      ctx.beginPath()
      for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x / 60 + row) * 4 + Math.sin(x / 23 + row * 2) * 1.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

function setGlow(material: THREE.MeshStandardMaterial, intensity: number) {
  material.emissiveIntensity = Math.max(0, intensity)
}

// ---------- 1. Arcade cabinet ----------

function arcade(): MachineRig {
  const root = new THREE.Group()
  const W = 0.62
  const profile: Array<[number, number]> = [[-0.42, 0], [0.34, 0], [0.34, 0.8], [0.5, 0.9], [0.48, 0.98], [0.18, 1.06], [0.08, 1.54], [0.32, 1.6], [0.32, 1.88], [-0.42, 1.88]]
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)))
  const sideGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 })
  sideGeometry.rotateY(-Math.PI / 2)
  const art = canvasTexture(512, 1024, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 1024)
    gradient.addColorStop(0, '#ff5c9a')
    gradient.addColorStop(0.55, '#c02d7a')
    gradient.addColorStop(1, '#46155f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 512, 1024)
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.moveTo(300, 120); ctx.lineTo(170, 470); ctx.lineTo(270, 470); ctx.lineTo(190, 860); ctx.lineTo(380, 400); ctx.lineTo(280, 400); ctx.lineTo(360, 120)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    for (let index = 0; index < 40; index += 1) ctx.fillRect((index * 97) % 512, (index * 233) % 1024, 4, 4)
  })
  art.repeat.set(1 / 0.92, 1 / 1.88)
  art.offset.set(0.42 / 0.92, 0)
  const sideMaterials = [new THREE.MeshPhysicalMaterial({ map: art, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }), plastic(0x111114, 0.4)]
  add(root, part(sideGeometry, sideMaterials, -W / 2), part(sideGeometry, sideMaterials, W / 2 + 0.035))

  const black = paint(0x17171d, 0.45)
  add(root,
    part(new THREE.BoxGeometry(W, 1.88, 0.42), black, 0, 0.94, -0.21),
    part(new THREE.BoxGeometry(W, 0.8, 0.04), black, 0, 0.4, 0.32),
    part(new THREE.BoxGeometry(W, 0.02, 0.34), black, 0, 1.87, 0.15),
    slab([0.34, 0.8], [0.5, 0.9], W, 0.02, black),
    slab([0.5, 0.9], [0.48, 0.98], W, 0.02, black),
    slab([0.08, 1.54], [0.32, 1.6], W, 0.02, black),
  )
  // Control panel with its art, joystick and buttons.
  const panelArt = canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#1d1630'
    ctx.fillRect(0, 0, 512, 256)
    ctx.strokeStyle = '#ff5c9a'
    ctx.lineWidth = 6
    for (let x = -256; x < 512; x += 48) { ctx.beginPath(); ctx.moveTo(x, 256); ctx.lineTo(x + 256, 0); ctx.stroke() }
  })
  const panelA: [number, number] = [0.48, 0.98], panelB: [number, number] = [0.18, 1.06]
  add(root, slab(panelA, panelB, W, 0.025, new THREE.MeshPhysicalMaterial({ map: panelArt, roughness: 0.3, clearcoat: 1 })))
  const controls = new THREE.Group()
  const spot = onSlab(panelA, panelB, 0.5, 0.013)
  controls.position.set(0, spot.y, spot.z)
  controls.rotation.x = Math.atan2(spot.nz, spot.ny)
  const stick = new THREE.Group()
  stick.position.set(-0.16, 0, 0)
  add(stick, part(new THREE.CylinderGeometry(0.032, 0.036, 0.012, 32), plastic(0x0c0c0f)), part(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 12), metal(0xd8dce2, 0.2), 0, 0.04, 0), part(new THREE.SphereGeometry(0.024, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xe8213c, roughness: 0.15, clearcoat: 1 }), 0, 0.085, 0))
  controls.add(stick)
  const buttonColors = [0xff3b5c, 0xffd23f, 0x3ec7ff, 0x5ce07a]
  const buttons = buttonColors.map((color, index) => {
    const material = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.2, clearcoat: 1 })
    const button = part(new THREE.CylinderGeometry(0.019, 0.021, 0.014, 28), material, -0.02 + index * 0.06, 0.006, index % 2 === 0 ? 0.012 : -0.012)
    controls.add(button, part(new THREE.CylinderGeometry(0.025, 0.025, 0.004, 28), plastic(0x0c0c0f), button.position.x, 0, button.position.z))
    return material
  })
  root.add(controls)

  // Screen in its bezel, behind glass.
  const screenA: [number, number] = [0.18, 1.06], screenB: [number, number] = [0.08, 1.54]
  add(root, slab(screenA, screenB, W, 0.03, paint(0x050507, 0.25)))
  const screenSpot = onSlab(screenA, screenB, 0.5, 0.017)
  const screen = screenMesh(0.46, 0.345)
  screen.position.set(0, screenSpot.y, screenSpot.z)
  screen.rotation.x = Math.atan2(-screenSpot.ny, screenSpot.nz)
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.42), glass(0.05))
  cover.position.set(0, screenSpot.y + screenSpot.ny * 0.006, screenSpot.z + screenSpot.nz * 0.006)
  cover.rotation.x = screen.rotation.x
  add(root, screen, cover)

  // Marquee.
  const marqueeTexture = label('ARCADE·3000', 1024, 256, { bg: '#1b0f2a', fg: '#ffe25c', glow: '#ff5c9a' })
  const marquee = new THREE.MeshStandardMaterial({ map: marqueeTexture, emissive: 0xffffff, emissiveMap: marqueeTexture, emissiveIntensity: 1.2, roughness: 0.3 })
  add(root, part(new THREE.BoxGeometry(W, 0.24, 0.05), [black, black, black, black, marquee, black], 0, 1.74, 0.3))

  // Coin door with lit slots.
  const coinLight = glow(0xff2a2a, 2.5)
  add(root, part(rbox(0.28, 0.32, 0.02, 0.008), metal(0x3a3d44, 0.45), 0, 0.5, 0.345))
  for (const x of [-0.065, 0.065]) add(root, part(rbox(0.07, 0.1, 0.016, 0.006), metal(0x6c717a, 0.3), x, 0.56, 0.356), part(new THREE.BoxGeometry(0.008, 0.05, 0.006), coinLight, x, 0.565, 0.366))
  add(root, part(new THREE.BoxGeometry(0.2, 0.05, 0.01), plastic(0x0b0b0d), 0, 0.4, 0.358))

  return {
    root, screen,
    sparkAt: new THREE.Vector3(0.1, 1.0, 0.45),
    beaconAt: new THREE.Vector3(0.22, 1.88, 0.1),
    acts: (outputs) => outputs.includes('Game start!'),
    tick: ({ t, power, act, mood }) => {
      setGlow(marquee, power * (1.1 + Math.sin(t * 2) * 0.1))
      setGlow(coinLight, power * 2.5)
      buttons.forEach((material, index) => {
        const chase = mood === 'running' ? (Math.floor(t * 8) % buttons.length === index ? 1.6 : 0.2) : 0.35
        const party = act > 0.5 ? 0.6 + Math.sin(t * 9 + index * 1.7) * 0.8 : chase
        setGlow(material, power * party)
      })
      stick.rotation.z = Math.sin(t * 7) * 0.3 * act
      stick.rotation.x = Math.cos(t * 5) * 0.2 * act
    },
  }
}

// ---------- 2. Safe door ----------

function safeDoor(): MachineRig {
  const root = new THREE.Group()
  const steel = metal(0x5c636c, 0.42)
  const bright = metal(0xa8b0b8, 0.26)
  const chrome = metal(0xe3e7ec, 0.14)
  const frameShape = new THREE.Shape()
  frameShape.moveTo(-0.95, 0); frameShape.lineTo(0.95, 0); frameShape.lineTo(0.95, 1.95); frameShape.lineTo(-0.95, 1.95); frameShape.lineTo(-0.95, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 0.98, 0.6, 0, Math.PI * 2, true)
  frameShape.holes.push(hole)
  const frame = part(new THREE.ExtrudeGeometry(frameShape, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 64 }), steel, 0, 0, -0.2)
  root.add(frame)
  // Rivets on the frame.
  const rivet = new THREE.SphereGeometry(0.014, 12, 8)
  for (let index = 0; index < 18; index += 1) {
    const x = -0.88 + (index % 9) * 0.22
    root.add(part(rivet, bright, x, index < 9 ? 0.08 : 1.87, 0.13))
  }
  // Inside the vault: a dark tunnel, a shelf and gold.
  const tunnel = part(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, metalness: 0.6, side: THREE.BackSide }), 0, 0.98, -0.5)
  tunnel.rotation.x = Math.PI / 2
  const backPlate = part(new THREE.CircleGeometry(0.6, 48), new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.8 }), 0, 0.98, -0.79)
  const gold = metal(0xffc246, 0.22)
  add(root, tunnel, backPlate, part(new THREE.BoxGeometry(0.9, 0.025, 0.4), steel, 0, 0.72, -0.6))
  const bar = rbox(0.15, 0.05, 0.07, 0.008)
  ;[[-0.17, 0], [0, 0], [0.17, 0], [-0.085, 1], [0.085, 1], [0, 2]].forEach(([x, row]) => root.add(part(bar, gold, x, 0.758 + row * 0.052, -0.6)))
  const vaultLight = new THREE.PointLight(0xffc56b, 0, 1.6, 2)
  vaultLight.position.set(0, 1.25, -0.5)
  root.add(vaultLight)

  // The door swings on a hinge at the right.
  const hinge = new THREE.Group()
  hinge.position.set(0.6, 0.98, 0.12)
  const door = new THREE.Group()
  door.position.set(-0.6, 0, 0)
  const slabDoor = part(new THREE.CylinderGeometry(0.585, 0.585, 0.2, 64), bright, 0, 0, -0.07)
  slabDoor.rotation.x = Math.PI / 2
  door.add(slabDoor)
  for (const radius of [0.5, 0.33]) door.add(part(new THREE.TorusGeometry(radius, 0.012, 12, 72), steel, 0, 0, 0.032))
  const bolt = new THREE.CylinderGeometry(0.022, 0.022, 0.024, 16)
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2
    const head = part(bolt, chrome, Math.cos(angle) * 0.545, Math.sin(angle) * 0.545, 0.035)
    head.rotation.x = Math.PI / 2
    door.add(head)
  }
  const hub = part(new THREE.CylinderGeometry(0.085, 0.095, 0.07, 40), chrome, 0, 0, 0.06)
  hub.rotation.x = Math.PI / 2
  door.add(hub)
  const wheel = new THREE.Group()
  wheel.position.z = 0.1
  wheel.add(part(new THREE.TorusGeometry(0.2, 0.016, 16, 64), chrome))
  for (let index = 0; index < 4; index += 1) {
    const spoke = part(new THREE.CylinderGeometry(0.011, 0.011, 0.4, 12), chrome)
    spoke.rotation.z = (index * Math.PI) / 4
    wheel.add(spoke)
    const angle = (index * Math.PI) / 4 + Math.PI / 2
    wheel.add(part(new THREE.SphereGeometry(0.024, 16, 12), plastic(0x1b1c20, 0.3), Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, 0))
    wheel.add(part(new THREE.SphereGeometry(0.024, 16, 12), plastic(0x1b1c20, 0.3), -Math.cos(angle) * 0.2, -Math.sin(angle) * 0.2, 0))
  }
  door.add(wheel)
  hinge.add(door)
  root.add(hinge)
  for (const y of [0.6, 1.36]) root.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 24), steel, 0.66, y, 0.17))

  // Display above the door, keypad to the left.
  add(root, part(rbox(0.62, 0.26, 0.04, 0.012), plastic(0x111215, 0.4), 0, 1.75, 0.14))
  const screen = screenMesh(0.54, 0.19)
  screen.position.set(0, 1.75, 0.162)
  root.add(screen)
  const keypadTexture = canvasTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#1b1d22'
    ctx.fillRect(0, 0, 256, 384)
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
    keys.forEach((key, index) => {
      const x = 22 + (index % 3) * 76, y = 26 + Math.floor(index / 3) * 88
      const gradient = ctx.createLinearGradient(0, y, 0, y + 70)
      gradient.addColorStop(0, '#d9dde3'); gradient.addColorStop(1, '#9aa0a8')
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.roundRect(x, y, 64, 70, 10); ctx.fill()
      ctx.fillStyle = '#20232a'
      ctx.font = '700 34px "IBM Plex Mono", monospace'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(key, x + 32, y + 37)
    })
  })
  const keypadMaterial = new THREE.MeshStandardMaterial({ map: keypadTexture, roughness: 0.45, emissive: 0x6fd6ff, emissiveIntensity: 0 })
  add(root, part(rbox(0.25, 0.36, 0.04, 0.012), plastic(0x0f1013, 0.4), -0.78, 1.05, 0.14), part(new THREE.PlaneGeometry(0.2, 0.3), keypadMaterial, -0.78, 1.05, 0.161))
  const led = glow(0xff3b4e, 2)
  root.add(part(new THREE.SphereGeometry(0.014, 16, 12), led, -0.78, 1.26, 0.16))

  return {
    root, screen,
    sparkAt: new THREE.Vector3(-0.78, 1.05, 0.2),
    beaconAt: new THREE.Vector3(0.7, 1.95, 0),
    acts: (outputs) => outputs.includes('Door open'),
    tick: ({ t, power, act, mood, moodTime, status, statusLevel }) => {
      const spin = Math.min(1, act / 0.4)
      const swing = THREE.MathUtils.smoothstep(act, 0.4, 1)
      const jiggle = mood === 'wrong' ? Math.sin(moodTime * 40) * 0.06 * Math.max(0, 1 - moodTime / 0.8) : 0
      wheel.rotation.z = -spin * Math.PI * 1.5 + jiggle
      hinge.rotation.y = swing * 1.45
      vaultLight.intensity = swing * 2.2 * power
      setGlow(keypadMaterial, mood === 'running' ? power * (0.25 + (Math.sin(t * 14) > 0 ? 0.25 : 0)) : power * 0.06)
      led.emissive.copy(status)
      setGlow(led, 2.5 * statusLevel * power)
    },
  }
}

// ---------- 3. Phone dock (a charging kiosk) ----------

function phoneDock(): MachineRig {
  const root = new THREE.Group()
  const shell = paint(0xc9cdd3, 0.34)
  const accent = paint(0x8fd12d, 0.32)
  add(root,
    part(rbox(0.62, 0.06, 0.46, 0.02), metal(0x34383f, 0.5), 0, 0.03, 0),
    part(rbox(0.2, 1.0, 0.15, 0.03), accent, 0, 0.55, -0.04),
    part(rbox(0.74, 0.5, 0.12, 0.03), shell, 0, 1.3, -0.04),
    part(rbox(0.66, 0.035, 0.24, 0.012), shell, 0, 0.93, 0.08),
    part(rbox(0.66, 0.08, 0.02, 0.008), shell, 0, 0.965, 0.195),
  )
  const screen = screenMesh(0.62, 0.35)
  screen.position.set(0, 1.32, 0.022)
  root.add(screen)
  const logo = label('CHARGE+', 512, 96, { bg: '#c9cdd3', fg: '#3f7a0c' })
  root.add(part(new THREE.PlaneGeometry(0.22, 0.04), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.4 }), 0, 1.105, 0.0205))
  const ring = glow(0x9cff3c, 0)
  const ringMesh = part(new THREE.TorusGeometry(0.05, 0.008, 12, 40), ring, 0, 0.72, 0.037)
  root.add(ringMesh)

  // Three phones in their docks, cables running to the column.
  let batteryDrawn = ''
  const batteryCanvas = document.createElement('canvas')
  batteryCanvas.width = 128
  batteryCanvas.height = 256
  const batteryTexture = new THREE.CanvasTexture(batteryCanvas)
  batteryTexture.colorSpace = THREE.SRGBColorSpace
  const phoneScreen = new THREE.MeshBasicMaterial({ map: batteryTexture, toneMapped: false })
  const drawBattery = (level: number | null, charging: boolean, power: number) => {
    const key = `${level}-${charging}-${power > 0.5}`
    if (key === batteryDrawn) return
    batteryDrawn = key
    const ctx = batteryCanvas.getContext('2d')!
    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, 128, 256)
    if (power > 0.5) {
      const value = level === null ? 50 : Math.max(0, Math.min(100, level))
      const color = value <= 20 ? '#ff4d5e' : value <= 50 ? '#ffc23f' : '#5ce07a'
      ctx.strokeStyle = '#e8edf3'; ctx.lineWidth = 6
      ctx.beginPath(); ctx.roundRect(34, 52, 60, 120, 8); ctx.stroke()
      ctx.fillStyle = '#e8edf3'; ctx.fillRect(52, 40, 24, 10)
      ctx.fillStyle = color
      const height = Math.max(4, (value / 100) * 108)
      ctx.fillRect(40, 166 - height, 48, height)
      if (charging) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.moveTo(70, 70); ctx.lineTo(48, 118); ctx.lineTo(64, 118); ctx.lineTo(56, 156); ctx.lineTo(82, 100); ctx.lineTo(66, 100); ctx.lineTo(74, 70); ctx.fill()
      }
      ctx.fillStyle = '#e8edf3'; ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'
      ctx.fillText(level === null ? '--%' : `${Math.round(value)}%`, 64, 214)
    }
    batteryTexture.needsUpdate = true
  }
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, emissive: 0x9cff3c, emissiveIntensity: 0 })
  const phoneColors = [0x22252b, 0xd9dde3, 0x3a6bd8]
  phoneColors.forEach((color, index) => {
    const x = -0.22 + index * 0.22
    root.add(part(rbox(0.11, 0.03, 0.08, 0.01), plastic(0x24272d, 0.35), x, 0.962, 0.1))
    const phone = new THREE.Group()
    phone.position.set(x, 1.05, 0.09)
    phone.rotation.x = -0.2
    add(phone, part(rbox(0.082, 0.168, 0.01, 0.009), new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.4, clearcoat: 1 })))
    const glassFace = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.152), phoneScreen)
    glassFace.position.z = 0.0052
    phone.add(glassFace)
    root.add(phone)
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.96, 0.06), new THREE.Vector3(x * 0.8, 0.9, 0.0), new THREE.Vector3(x * 0.4, 0.8, 0.04), new THREE.Vector3(0, 0.72, 0.03)])
    root.add(part(new THREE.TubeGeometry(curve, 32, 0.006, 8), cableMaterial))
  })

  return {
    root, screen,
    sparkAt: new THREE.Vector3(0, 0.75, 0.08),
    beaconAt: new THREE.Vector3(0.28, 1.55, -0.04),
    acts: (outputs) => outputs.includes('Plug in the charger'),
    tick: ({ t, power, act, input, mood }) => {
      drawBattery(input, act > 0.5, power)
      setGlow(cableMaterial, act * power * (0.4 + Math.max(0, Math.sin(t * 6)) * 1.2))
      ring.emissive.set(act > 0.5 ? 0x9cff3c : mood === 'running' ? 0xffc23f : 0x6fd6ff)
      setGlow(ring, power * (act > 0.5 ? 2 + Math.sin(t * 6) : mood === 'running' ? 1.6 : 0.6))
    },
  }
}

// ---------- 4. Ride gate ----------

function rideGate(): MachineRig {
  const root = new THREE.Group()
  // The height board, 1 unit = 1 metre, with its "you must be this tall" hand at 130 cm.
  const boardTexture = canvasTexture(256, 1024, (ctx) => {
    const px = 1024 / 2
    ctx.fillStyle = '#ddd5c0'
    ctx.fillRect(0, 0, 256, 1024)
    const yOf = (cm: number) => 1024 - (cm / 100) * px
    ctx.fillStyle = '#ff6b7f'; ctx.fillRect(0, yOf(130), 54, yOf(0) - yOf(130))
    ctx.fillStyle = '#5cd17d'; ctx.fillRect(0, yOf(195), 54, yOf(130) - yOf(195))
    ctx.fillStyle = '#1b1d24'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    for (let cm = 0; cm <= 190; cm += 5) {
      const y = yOf(cm)
      const long = cm % 10 === 0
      ctx.fillRect(54, y - 1.5, long ? 70 : 36, 3)
      if (long && cm >= 50) { ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.fillText(String(cm), 132, y) }
    }
    ctx.fillRect(0, yOf(130) - 4, 256, 8)
    ctx.fillStyle = '#1b1d24'
    ctx.fillRect(0, 0, 256, 92)
    ctx.fillStyle = '#ffd23f'
    ctx.font = '900 30px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'
    ctx.fillText('YOU MUST BE', 128, 32); ctx.fillText('THIS TALL', 128, 68)
  })
  const boardX = -0.62
  add(root,
    part(rbox(0.4, 2.04, 0.05, 0.015), paint(0x2b6fd6, 0.35), boardX, 1.02, -0.02),
    part(new THREE.PlaneGeometry(0.34, 1.96), new THREE.MeshStandardMaterial({ map: boardTexture, roughness: 0.6 }), boardX, 1.0, 0.0055),
    part(rbox(0.5, 0.04, 0.34, 0.01), metal(0x3a3e45, 0.5), boardX, 0.02, 0),
  )
  const arm = new THREE.Group()
  arm.position.set(boardX + 0.17, 1.3, 0.02)
  add(arm, part(rbox(0.22, 0.045, 0.03, 0.012), paint(0xffd23f, 0.3), 0.11, 0, 0), part(new THREE.SphereGeometry(0.05, 24, 16), paint(0xffd23f, 0.3), 0.24, 0, 0))
  arm.children[1].scale.set(1, 0.7, 0.45)
  root.add(arm)

  // The rider: a cardboard cut-out as tall as the height being tested.
  const kid = new THREE.Shape()
  const right: Array<[number, number]> = [[0.025, 0], [0.095, 0], [0.1, 0.44], [0.115, 0.7], [0.12, 0.46], [0.165, 0.46], [0.17, 0.76], [0.12, 0.82], [0.04, 0.84]]
  kid.moveTo(0, 0.42)
  right.forEach(([x, y]) => kid.lineTo(x, y))
  kid.absarc(0, 0.925, 0.075, -Math.PI / 2 + 0.48, Math.PI * 1.5 - 0.48, false)
  ;[...right].reverse().forEach(([x, y]) => kid.lineTo(-x, y))
  kid.lineTo(0, 0.42)
  const rider = part(new THREE.ExtrudeGeometry(kid, { depth: 0.012, bevelEnabled: false, curveSegments: 24 }), paint(0x2c3e66, 0.5), -0.22, 0, 0.1)
  root.add(rider)
  const laserMaterial = glow(0xff4d5e, 3)
  const laser = part(new THREE.BoxGeometry(0.62, 0.006, 0.006), laserMaterial, -0.45, 1, 0.02)
  laser.castShadow = false
  root.add(laser)

  // The gate: a cabinet with a striped boom, a screen and a traffic light.
  const yellow = paint(0xffc21f, 0.3)
  add(root,
    part(rbox(0.38, 1.12, 0.32, 0.03), yellow, 0.26, 0.56, 0),
    part(rbox(0.4, 0.04, 0.34, 0.012), paint(0x1b1d22, 0.4), 0.26, 1.13, 0),
  )
  add(root, part(rbox(0.32, 0.22, 0.02, 0.012), plastic(0x111215, 0.4), 0.26, 0.9, 0.165))
  const screen = screenMesh(0.28, 0.16)
  screen.position.set(0.26, 0.9, 0.1765)
  root.add(screen)
  const stripes = canvasTexture(512, 32, (ctx) => {
    for (let x = 0; x < 512; x += 64) { ctx.fillStyle = '#e8213c'; ctx.fillRect(x, 0, 32, 32); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 32, 0, 32, 32) }
  })
  const boom = new THREE.Group()
  boom.position.set(0.45, 1.0, 0.0)
  boom.add(part(rbox(1.3, 0.06, 0.05, 0.02), new THREE.MeshPhysicalMaterial({ map: stripes, roughness: 0.3, clearcoat: 0.6 }), 0.65, 0, 0))
  boom.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 24), metal(0x8b929a, 0.3), 0, 0, 0))
  boom.children[1].rotation.x = Math.PI / 2
  root.add(boom)
  const head = new THREE.Group()
  head.position.set(0.26, 1.33, 0)
  const red = glow(0xff2a3a, 0)
  const green = glow(0x3dff7a, 0)
  add(head, part(rbox(0.14, 0.32, 0.12, 0.02), plastic(0x15161a, 0.45)), part(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12), metal(0x5a6068), 0, -0.2, 0))
  const lens = new THREE.CircleGeometry(0.042, 32)
  add(head, part(lens, red, 0, 0.07, 0.062), part(lens, green, 0, -0.07, 0.062))
  root.add(head)
  let shown = 1

  return {
    root, screen,
    sparkAt: new THREE.Vector3(0.26, 0.95, 0.2),
    beaconAt: new THREE.Vector3(0.26, 1.5, 0),
    acts: (outputs) => outputs.includes('Enjoy the ride!'),
    tick: ({ t, dt, power, act, input, mood, moodTime }) => {
      const height = input === null ? 1 : Math.max(0.6, Math.min(1.95, input / 100))
      shown += (height - shown) * Math.min(1, dt * 6)
      rider.scale.set(0.82 + shown * 0.18, shown, 1)
      laser.position.y = shown
      const tall = shown >= 1.295
      laserMaterial.emissive.set(tall ? 0x3dff7a : 0xff4d5e)
      setGlow(laserMaterial, 3 * power)
      boom.rotation.z = THREE.MathUtils.smoothstep(act, 0, 1) * 1.38 + (mood === 'wrong' ? Math.sin(moodTime * 30) * 0.03 * Math.max(0, 1 - moodTime) : 0)
      const blink = mood === 'wrong' && Math.sin(t * 12) < 0 ? 0.15 : 1
      setGlow(red, power * (act > 0.5 ? 0.05 : 2.6 * blink))
      setGlow(green, power * (act > 0.5 ? 2.6 : 0.05))
    },
  }
}

// ---------- 5. Thermo fan ----------

function thermoFan(): MachineRig {
  const root = new THREE.Group()
  const body = paint(0x7fc8f0, 0.3)
  const chrome = metal(0xe1e5ea, 0.14)
  const base = part(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.25, 0), new THREE.Vector2(0.26, 0.02), new THREE.Vector2(0.22, 0.055), new THREE.Vector2(0.06, 0.075), new THREE.Vector2(0, 0.075)], 64), plastic(0x23262c, 0.35), -0.15, 0, 0)
  add(root, base, part(new THREE.CylinderGeometry(0.022, 0.026, 1.0, 24), chrome, -0.15, 0.57, 0))
  // Control box on the stand.
  add(root, part(rbox(0.34, 0.22, 0.08, 0.02), body, -0.15, 0.72, 0.06))
  add(root, part(rbox(0.3, 0.17, 0.01, 0.01), plastic(0x0d0e11, 0.3), -0.15, 0.72, 0.1))
  const screen = screenMesh(0.27, 0.14)
  screen.position.set(-0.15, 0.72, 0.1055)
  root.add(screen)

  const head = new THREE.Group()
  head.position.set(-0.15, 1.13, 0)
  const motor = part(new THREE.CapsuleGeometry(0.085, 0.12, 8, 24), body, 0, 0, -0.1)
  motor.rotation.x = Math.PI / 2
  head.add(motor)
  const cage = new THREE.Group()
  cage.position.z = 0.06
  const wire = metal(0xdfe3e8, 0.22)
  for (const [radius, z] of [[0.33, -0.055], [0.33, 0.055], [0.27, 0.075], [0.19, 0.088], [0.11, 0.095]] as const) cage.add(part(new THREE.TorusGeometry(radius, 0.004, 8, 80), wire, 0, 0, z))
  const band = part(new THREE.CylinderGeometry(0.335, 0.335, 0.03, 80, 1, true), new THREE.MeshStandardMaterial({ color: 0x7fc8f0, roughness: 0.3, side: THREE.DoubleSide }), 0, 0, 0)
  band.rotation.x = Math.PI / 2
  cage.add(band)
  const spokeGeometry = new THREE.CylinderGeometry(0.0025, 0.0025, 0.33, 6)
  spokeGeometry.translate(0, 0.165, 0)
  for (let index = 0; index < 24; index += 1) {
    for (const z of [-0.055, 0.075]) {
      const spoke = part(spokeGeometry, wire, 0, 0, z)
      spoke.rotation.z = (index / 24) * Math.PI * 2
      cage.add(spoke)
    }
  }
  const badgeTexture = label('LAB', 128, 128, { bg: '#7fc8f0', fg: '#0d3550' })
  const badge = part(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 40), [plastic(0x7fc8f0), new THREE.MeshStandardMaterial({ map: badgeTexture, roughness: 0.4 }), plastic(0x7fc8f0)], 0, 0, 0.1)
  badge.rotation.x = Math.PI / 2
  cage.add(badge)
  const rotor = new THREE.Group()
  rotor.position.z = 0.0
  const blade = new THREE.Shape()
  blade.moveTo(0.03, -0.02)
  blade.bezierCurveTo(0.12, -0.08, 0.27, -0.07, 0.29, 0.0)
  blade.bezierCurveTo(0.3, 0.06, 0.15, 0.08, 0.03, 0.02)
  blade.lineTo(0.03, -0.02)
  const bladeGeometry = new THREE.ShapeGeometry(blade, 24)
  const bladeMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9fe2ff, roughness: 0.15, transparent: true, opacity: 0.78, side: THREE.DoubleSide, clearcoat: 1 })
  for (let index = 0; index < 5; index += 1) {
    const holder = new THREE.Group()
    holder.rotation.z = (index / 5) * Math.PI * 2
    const mesh = part(bladeGeometry, bladeMaterial)
    mesh.rotation.x = 0.4
    holder.add(mesh)
    rotor.add(holder)
  }
  const spinner = part(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 32), body, 0, 0, 0.0)
  spinner.rotation.x = Math.PI / 2
  rotor.add(spinner)
  cage.add(rotor)
  head.add(cage)
  root.add(head)

  // A thermometer whose red line rises with the temperature.
  const scale = canvasTexture(128, 512, (ctx) => {
    ctx.fillStyle = '#d9d3c4'
    ctx.fillRect(0, 0, 128, 512)
    ctx.fillStyle = '#1b1d24'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '700 22px "IBM Plex Mono", monospace'
    for (let degrees = 0; degrees <= 50; degrees += 5) {
      const y = 470 - degrees * 8.6
      ctx.fillRect(84, y - 1, degrees % 10 === 0 ? 30 : 16, 2)
      if (degrees % 10 === 0) ctx.fillText(`${degrees}°`, 78, y)
    }
    ctx.fillStyle = '#2b8fd6'
    ctx.fillRect(0, 470 - 30 * 8.6 - 3, 128, 6)
  })
  const thermo = new THREE.Group()
  thermo.position.set(0.42, 0, 0)
  add(thermo,
    part(rbox(0.3, 0.04, 0.22, 0.01), plastic(0x23262c, 0.4), 0, 0.02, 0),
    part(rbox(0.16, 1.1, 0.025, 0.01), paint(0xb9bcc2, 0.4), 0, 0.6, -0.02),
    part(new THREE.PlaneGeometry(0.14, 0.56), new THREE.MeshStandardMaterial({ map: scale, roughness: 0.6 }), 0, 0.62, -0.006),
    part(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 20, 1, true), glass(0.3), 0.0, 0.62, 0.02),
  )
  const mercury = glow(0xff2a3a, 0.6, 0xc8102e)
  const bulb = part(new THREE.SphereGeometry(0.035, 24, 16), mercury, 0, 0.3, 0.02)
  const columnGeometry = new THREE.CylinderGeometry(0.009, 0.009, 1, 12)
  columnGeometry.translate(0, 0.5, 0)
  const column = part(columnGeometry, mercury, 0, 0.32, 0.02)
  add(thermo, bulb, column)
  root.add(thermo)
  let speed = 0
  let level = 0.2

  return {
    root, screen,
    sparkAt: new THREE.Vector3(-0.15, 1.13, -0.1),
    beaconAt: new THREE.Vector3(0.42, 1.15, -0.02),
    acts: (outputs) => outputs.includes('Fan ON'),
    tick: ({ t, dt, power, act, input, mood, moodTime }) => {
      const stutter = mood === 'crash' && moodTime < 2 ? (Math.sin(moodTime * 9) > 0 ? 1 : 0) * 10 * (1 - moodTime / 2) : 0
      const target = (act * 28 + (mood === 'running' ? 3 : 0)) * power + stutter
      speed += (target - speed) * Math.min(1, dt * 1.8)
      rotor.rotation.z -= speed * dt
      head.rotation.y = Math.sin(t * 0.7) * 0.45 * act
      const degrees = input === null ? 22 : Math.max(0, Math.min(50, input))
      level += ((degrees * 8.6) / 512 * 0.56 - level) * Math.min(1, dt * 4)
      column.scale.y = level + 0.066
    },
  }
}

// ---------- 6. Quiz show podium ----------

function quizShow(): MachineRig {
  const root = new THREE.Group()
  const front = new THREE.Shape()
  front.moveTo(-0.4, 0); front.lineTo(0.4, 0); front.lineTo(0.5, 1.05); front.lineTo(-0.5, 1.05); front.lineTo(-0.4, 0)
  const purple = paint(0x7b5cf0, 0.3)
  const podium = part(new THREE.ExtrudeGeometry(front, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), purple, 0, 0, -0.3)
  root.add(podium)
  add(root, part(rbox(1.1, 0.05, 0.64, 0.015), paint(0x141418, 0.25), 0, 1.08, -0.02))
  // Light bulbs around the front face.
  const bulbOn = glow(0xffe08a, 3.2, 0xffe08a)
  const bulbOff = new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.3, emissive: 0xffe08a, emissiveIntensity: 0.08 })
  const bulbs: THREE.Mesh[] = []
  const bulbGeometry = new THREE.SphereGeometry(0.016, 16, 12)
  const outline: Array<[number, number]> = [[-0.37, 0.06], [0.37, 0.06], [0.46, 1.0], [-0.46, 1.0]]
  for (let side = 0; side < 4; side += 1) {
    const [ax, ay] = outline[side], [bx, by] = outline[(side + 1) % 4]
    const count = side % 2 === 0 ? 9 : 10
    for (let index = 0; index < count; index += 1) {
      const s = index / count
      const bulb = part(bulbGeometry, bulbOff, ax + (bx - ax) * s, ay + (by - ay) * s, 0.27)
      bulb.castShadow = false
      bulbs.push(bulb)
      root.add(bulb)
    }
  }
  add(root, part(rbox(0.62, 0.36, 0.02, 0.012), plastic(0x0e0f12, 0.35), 0, 0.6, 0.265))
  const screen = screenMesh(0.56, 0.3)
  screen.position.set(0, 0.6, 0.2765)
  root.add(screen)
  // The buzzer.
  const domeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe8213c, roughness: 0.12, clearcoat: 1, emissive: 0xff2a3a, emissiveIntensity: 0.1 })
  add(root,
    part(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, 0), new THREE.Vector2(0.13, 0.03), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0, 0.05)], 48), metal(0xd5dae0, 0.18), 0, 1.105, -0.02),
    part(new THREE.SphereGeometry(0.095, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMaterial, 0, 1.15, -0.02),
  )
  // A sign behind the podium.
  const signTexture = label('QUIZ SHOW', 1024, 256, { bg: '#1a1033', fg: '#ffe08a', glow: '#ff8ad8' })
  const sign = new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0xffffff, emissiveMap: signTexture, emissiveIntensity: 1.1, roughness: 0.35 })
  add(root,
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 12), metal(0x9aa3ad), -0.38, 1.3, -0.25),
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 12), metal(0x9aa3ad), 0.38, 1.3, -0.25),
    part(new THREE.BoxGeometry(0.98, 0.26, 0.04), [purple, purple, purple, purple, sign, purple], 0, 1.58, -0.25),
  )

  return {
    root, screen,
    sparkAt: new THREE.Vector3(0, 0.6, 0.32),
    beaconAt: new THREE.Vector3(0.42, 1.71, -0.25),
    acts: (outputs) => outputs.includes('You win!'),
    tick: ({ t, power, act, mood }) => {
      const step = Math.floor(t * (mood === 'running' ? 14 : act > 0.5 ? 18 : 3))
      bulbs.forEach((bulb, index) => {
        const lit = power > 0.3 && (act > 0.5 ? (index + step) % 2 === 0 : mood === 'running' ? (index + step) % 6 < 2 : (index + step) % 10 < 7)
        bulb.material = lit ? bulbOn : bulbOff
      })
      setGlow(sign, power * 1.1)
      setGlow(domeMaterial, power * (act > 0.5 ? 1.4 + Math.sin(t * 10) * 0.8 : mood === 'running' ? 0.8 : 0.12))
    },
  }
}

// ---------- 7. Night lamp ----------

function nightLamp(): MachineRig {
  const root = new THREE.Group()
  const wood = new THREE.MeshPhysicalMaterial({ map: woodTexture('#9a6a42', '#5e3a1f'), roughness: 0.5, clearcoat: 0.4 })
  const lightWood = new THREE.MeshPhysicalMaterial({ map: woodTexture('#b8875a', '#7a5233'), roughness: 0.45, clearcoat: 0.4 })
  add(root,
    part(rbox(0.56, 0.5, 0.42, 0.015), wood, 0, 0.32, 0),
    part(rbox(0.6, 0.035, 0.46, 0.012), lightWood, 0, 0.585, 0),
    part(rbox(0.48, 0.17, 0.02, 0.01), lightWood, 0, 0.44, 0.215),
    part(rbox(0.48, 0.17, 0.02, 0.01), lightWood, 0, 0.24, 0.215),
    part(new THREE.SphereGeometry(0.018, 16, 12), metal(0xd9a441, 0.25), 0, 0.44, 0.235),
    part(new THREE.SphereGeometry(0.018, 16, 12), metal(0xd9a441, 0.25), 0, 0.24, 0.235),
  )
  for (const [x, z] of [[-0.24, -0.17], [0.24, -0.17], [-0.24, 0.17], [0.24, 0.17]]) root.add(part(new THREE.CylinderGeometry(0.018, 0.012, 0.07, 12), wood, x, 0.035, z))
  // The lamp.
  const lampX = -0.11
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x2f6f8f, roughness: 0.18, clearcoat: 1 })
  add(root,
    part(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.075, 0), new THREE.Vector2(0.09, 0.03), new THREE.Vector2(0.085, 0.1), new THREE.Vector2(0.055, 0.19), new THREE.Vector2(0.02, 0.23), new THREE.Vector2(0, 0.23)], 48), ceramic, lampX, 0.603, 0),
    part(new THREE.CylinderGeometry(0.007, 0.007, 0.18, 12), metal(0xd9a441, 0.25), lampX, 0.92, 0),
  )
  const bulbMaterial = glow(0xffd28a, 0, 0xfff4dc)
  root.add(part(new THREE.SphereGeometry(0.035, 24, 16), bulbMaterial, lampX, 1.02, 0))
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e2c4, roughness: 0.92, side: THREE.DoubleSide, emissive: 0xffb45c, emissiveIntensity: 0 })
  root.add(part(new THREE.CylinderGeometry(0.11, 0.19, 0.22, 64, 1, true), shadeMaterial, lampX, 1.06, 0))
  const lampLight = new THREE.PointLight(0xffb45c, 0, 3.2, 1.6)
  lampLight.position.set(lampX, 1.0, 0.02)
  root.add(lampLight)
  // A small smart display with the light sensor on top.
  const display = new THREE.Group()
  display.position.set(0.15, 0.7, 0.02)
  display.rotation.x = -0.18
  add(display, part(rbox(0.26, 0.18, 0.04, 0.015), plastic(0xbdb8ae, 0.35)), part(new THREE.SphereGeometry(0.018, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass(0.5), 0, 0.09, 0))
  const screen = screenMesh(0.22, 0.135)
  screen.position.z = 0.0205
  display.add(screen)
  add(root, display, part(rbox(0.1, 0.06, 0.08, 0.01), plastic(0xd5d0c6, 0.4), 0.15, 0.63, 0.0))
  add(root, part(rbox(0.16, 0.03, 0.22, 0.004), paint(0xc23b4f, 0.5), 0.17, 0.62, -0.08))
  let level = 0

  return {
    root, screen,
    sparkAt: new THREE.Vector3(lampX, 1.0, 0.05),
    beaconAt: new THREE.Vector3(0.24, 0.6, -0.15),
    acts: (outputs) => outputs.includes('Lamp ON'),
    ambient: ({ input, mood }) => mood === 'idle' && input === null ? 1 : Math.max(0.45, Math.min(1, (input ?? 100) / 80)),
    tick: ({ t, dt, power, act, outputs }) => {
      const both = outputs.includes('Lamp ON') && outputs.includes('Lamp OFF')
      const target = both ? (Math.sin(t * 22) > 0 ? 1 : 0.05) : act
      level += (target - level) * Math.min(1, dt * (both ? 30 : 5))
      const on = level * power
      setGlow(bulbMaterial, on * 4)
      setGlow(shadeMaterial, on * 0.9)
      lampLight.intensity = on * 2.2
    },
  }
}

// ---------- 8. Snack machine ----------

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private radius: number, private length: number, private turns: number) { super() }
  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * this.turns
    return target.set(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius, (t - 0.5) * this.length)
  }
}

function snackMachine(): MachineRig {
  const root = new THREE.Group()
  const W = 0.9, H = 1.85, D = 0.76
  const shell = paint(0xff6b3d, 0.32)
  const dark = paint(0x1a1b20, 0.45)
  add(root,
    part(new THREE.BoxGeometry(0.04, H, D), shell, -W / 2 + 0.02, H / 2, 0),
    part(new THREE.BoxGeometry(0.04, H, D), shell, W / 2 - 0.02, H / 2, 0),
    part(new THREE.BoxGeometry(W, 0.04, D), shell, 0, H - 0.02, 0),
    part(new THREE.BoxGeometry(W, 0.06, D), dark, 0, 0.03, 0),
    part(new THREE.BoxGeometry(W - 0.08, H - 0.1, 0.03), dark, 0, H / 2, -D / 2 + 0.015),
    // Front frame around the window, the control column and the bottom panel.
    part(new THREE.BoxGeometry(W - 0.08, 0.5, 0.03), shell, 0, 0.3, D / 2 - 0.015),
    part(new THREE.BoxGeometry(0.28, H - 0.6, 0.04), shell, 0.29, 0.55 + (H - 0.6) / 2, D / 2 - 0.02),
    part(new THREE.BoxGeometry(W - 0.08, 0.1, 0.04), shell, 0, H - 0.07, D / 2 - 0.02),
  )
  const windowLeft = -0.41, windowRight = 0.15, windowWidth = windowRight - windowLeft, windowMid = (windowLeft + windowRight) / 2
  const shelves = [0.66, 0.92, 1.18, 1.44]
  const steel = metal(0xb8bfc7, 0.3)
  const helix = new THREE.TubeGeometry(new Helix(0.042, 0.42, 7), 160, 0.0035, 6)
  const snackColors = [0xe8213c, 0xffc21f, 0x2b8fd6, 0x5cd17d, 0xff8a3d, 0x9b59d0, 0xf05aa0, 0x1fb5a8]
  const bag = new THREE.SphereGeometry(1, 20, 14)
  const can = new THREE.CylinderGeometry(0.03, 0.03, 0.11, 24)
  const bar = rbox(0.1, 0.035, 0.035, 0.008)
  let dropper: THREE.Mesh | null = null
  let dropperHome = new THREE.Vector3()
  let dropperCoil: THREE.Mesh | null = null
  shelves.forEach((y, row) => {
    root.add(part(new THREE.BoxGeometry(windowWidth, 0.012, D - 0.1), steel, windowMid, y, 0.02))
    for (let slot = 0; slot < 4; slot += 1) {
      const x = windowLeft + windowWidth * ((slot + 0.5) / 4)
      const coil = part(helix, steel, x, y + 0.05, 0.05)
      root.add(coil)
      const color = snackColors[(row * 3 + slot) % snackColors.length]
      const material = new THREE.MeshPhysicalMaterial({ color, roughness: row % 2 ? 0.35 : 0.2, clearcoat: 0.8, metalness: row === 2 ? 0.5 : 0 })
      for (let index = 0; index < 3; index += 1) {
        const z = 0.2 - index * 0.13
        let item: THREE.Mesh
        if (row === 2) item = part(can, material, x, y + 0.062, z)
        else if (row === 1) { item = part(bar, material, x, y + 0.03, z); item.rotation.y = Math.PI / 2 }
        else { item = part(bag, material, x, y + 0.075, z); item.scale.set(0.045, 0.065, 0.025) }
        root.add(item)
        if (row === 3 && slot === 1 && index === 0) { dropper = item; dropperHome = item.position.clone(); dropperCoil = coil }
      }
    }
  })
  const strip = glow(0xe6f4ff, 2.2)
  root.add(part(new THREE.BoxGeometry(windowWidth - 0.04, 0.015, 0.02), strip, windowMid, H - 0.14, D / 2 - 0.06))
  const inside = new THREE.PointLight(0xdfefff, 0.6, 1.6, 2)
  inside.position.set(windowMid, 1.5, 0.2)
  root.add(inside)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(windowWidth, H - 0.66), glass(0.14))
  front.position.set(windowMid, 0.55 + (H - 0.66) / 2, D / 2 - 0.005)
  root.add(front)
  // Pick-up flap.
  add(root, part(rbox(0.5, 0.16, 0.03, 0.01), plastic(0x0b0b0e, 0.3), -0.13, 0.24, D / 2 + 0.002), part(rbox(0.46, 0.12, 0.01, 0.01), new THREE.MeshPhysicalMaterial({ color: 0x222831, roughness: 0.1, transparent: true, opacity: 0.7 }), -0.13, 0.24, D / 2 + 0.02))
  // Control column: screen, keypad, coin slot.
  add(root, part(rbox(0.22, 0.13, 0.015, 0.008), plastic(0x0d0e11, 0.3), 0.29, 1.5, D / 2 + 0.008))
  const screen = screenMesh(0.2, 0.11)
  screen.position.set(0.29, 1.5, D / 2 + 0.0165)
  root.add(screen)
  const keys = canvasTexture(192, 256, (ctx) => {
    ctx.fillStyle = '#2a2c33'
    ctx.fillRect(0, 0, 192, 256)
    'ABC123456789'.split('').forEach((key, index) => {
      const x = 14 + (index % 3) * 60, y = 12 + Math.floor(index / 3) * 61
      ctx.fillStyle = '#d6dae0'; ctx.beginPath(); ctx.roundRect(x, y, 48, 50, 8); ctx.fill()
      ctx.fillStyle = '#1a1b20'; ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(key, x + 24, y + 26)
    })
  })
  root.add(part(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshStandardMaterial({ map: keys, roughness: 0.45 }), 0.29, 1.22, D / 2 + 0.002))
  const coin = glow(0x6fd6ff, 1.8)
  add(root, part(rbox(0.1, 0.07, 0.02, 0.008), metal(0x6c717a, 0.3), 0.29, 1.0, D / 2 + 0.008), part(new THREE.BoxGeometry(0.008, 0.045, 0.006), coin, 0.29, 1.0, D / 2 + 0.02))
  const marqueeTexture = label('SNACK-O-MAT', 1024, 160, { bg: '#1a1b20', fg: '#ffd23f', glow: '#ff6b3d' })
  const marquee = new THREE.MeshStandardMaterial({ map: marqueeTexture, emissive: 0xffffff, emissiveMap: marqueeTexture, emissiveIntensity: 1.1, roughness: 0.3 })
  root.add(part(new THREE.PlaneGeometry(W - 0.12, 0.09), marquee, 0, H - 0.07, D / 2 + 0.001))

  return {
    root, screen,
    sparkAt: new THREE.Vector3(0.29, 1.3, D / 2 + 0.05),
    beaconAt: new THREE.Vector3(0.3, H, 0),
    acts: (outputs) => outputs.includes('Here is your snack'),
    tick: ({ power, act }) => {
      setGlow(strip, power * 2.2)
      setGlow(marquee, power * 1.1)
      setGlow(coin, power * 1.8)
      inside.intensity = power * 0.6
      if (dropper && dropperCoil) {
        const slide = THREE.MathUtils.smoothstep(act, 0, 0.35)
        const fall = THREE.MathUtils.clamp((act - 0.35) / 0.45, 0, 1)
        dropperCoil.rotation.z = -slide * Math.PI * 2
        dropper.position.set(dropperHome.x, dropperHome.y - fall * fall * (dropperHome.y - 0.25), dropperHome.z + slide * 0.12)
        dropper.rotation.x = fall * 2.4
      }
    },
  }
}

const builders: Record<RepairMachineId, () => MachineRig> = {
  arcade, door: safeDoor, charger: phoneDock, ride: rideGate, fan: thermoFan, quiz: quizShow, lamp: nightLamp, snack: snackMachine,
}

export function buildMachine(machine: RepairMachineId): MachineRig {
  return builders[machine]()
}
