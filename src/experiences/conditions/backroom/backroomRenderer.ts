import { corridorCenterAt, drillOut, drillStrike, holeHalfLength, sawEmerge, sawOut, sawReach, type CorridorBend, type CorridorObstacle, type CorridorPickup, type GateKind } from './backroomEngine'

export type GateSignal = 'true' | 'false' | 'unknown'

export interface BackroomEntity {
  z: number
  x: number
  alpha: number
}

export interface BackroomView {
  depth: number
  gateZ: number
  gateCenter: number
  bends: CorridorBend[]
  obstacles: CorridorObstacle[]
  nextGateZ: number
  nextGateCenter: number
  phase: 'gate' | 'turn'
  playerX: number
  gateKind: GateKind
  nextGateKind: GateKind
  signal: GateSignal
  trueSide: -1 | 1
  nextTrueSide: -1 | 1
  openAmount: number
  doorOpen: [number, number]
  flashSide: -1 | 0 | 1
  falseIntensity: number
  time: number
  roomLight: number
  lightsActive: boolean
  nightVision: number
  entity: BackroomEntity | null
  glitch: number
  gateNumber: number
  seed: number
  reduced: boolean
  shake: number
  // -1..1 steering input, for camera lean.
  steer: number
  // Height of the current jump above the floor.
  jump: number
  // Current speed relative to the opening pace.
  pace: number
  hideGate?: boolean
  // Spare batteries on the floor.
  pickups?: CorridorPickup[]
  // The door into Level 0 at the start of a run: 0 shut, 1 open, -1 not drawn.
  entry?: number
  // The camcorder's video light, 0 (dead) to 1 (full charge).
  cameraLight?: number
  // How far the camera has dropped into a hole.
  fall?: number
}

export interface BackroomRendererHandle {
  render(view: BackroomView): void
  resize(): void
  dispose(): void
}

function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

// The flat canvas renderer: used where WebGL is unavailable.
function createCanvasRenderer(canvas: HTMLCanvasElement): BackroomRendererHandle | null {
  const context = canvas.getContext('2d')
  if (!context) return null
  canvas.classList.add('is-pixel')
  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(240, Math.round(rect.width / 3))
    canvas.height = Math.max(140, Math.round(rect.height / 3))
  }
  resize()
  return { render: (view) => drawBackroom(context, canvas.width, canvas.height, view), resize, dispose: () => undefined }
}

// The 3D scene loads as its own chunk; until it is ready nothing is drawn.
export function createBackroomRenderer(canvas: HTMLCanvasElement): BackroomRendererHandle {
  let active: BackroomRendererHandle | null = null
  let disposed = false
  const fallback = () => { if (!disposed && !active) active = createCanvasRenderer(canvas) }
  if (supportsWebGL()) {
    import('./backroomScene')
      .then((module) => {
        if (disposed) return
        active = module.createBackroomScene(canvas)
        if (!active) fallback()
      })
      .catch(fallback)
  } else fallback()
  return {
    render: (view) => active?.render(view),
    resize: () => active?.resize(),
    dispose: () => { disposed = true; active?.dispose(); active = null },
  }
}

const palette = {
  ceiling: '#78653d',
  ceilingAlt: '#806b40',
  ceilingLine: '#554624',
  light: '#fff6b3',
  lightGlow: '#f7db74',
  floor: '#aa8d50',
  floorAlt: '#af9457',
  floorLine: '#79633a',
  wall: '#c8a342',
  wallAlt: '#c19b3b',
  wallMotif: '#a7812f',
  wallLine: '#8f6d28',
  wainscot: '#a88335',
  outline: '#2b2513',
  steel: '#46505c',
  steelDark: '#192632',
  steelLight: '#697987',
  hazard: '#e0892f',
  green: '#39fa70',
  greenDark: '#1c6f3f',
  red: '#ff5560',
  redDark: '#8f1c27',
  amber: '#ffb43b',
  amberDark: '#7a4a10',
  cyan: '#73d5ff',
  cyanDark: '#346785',
  sign: '#12161f',
  void: '#080b0d',
}

interface Projector {
  focal: number
  cx: number
  horizon: number
  half: number
  eye: number
  playerX: number
}

function makeProjector(width: number, height: number, playerX: number): Projector {
  return { focal: Math.min(width * 3.25, height * 4.6) * (4 / 3), cx: width / 2, horizon: height * 0.4, half: 0.77, eye: 0.52, playerX }
}

function perspectiveDistance(distance: number): number {
  return Math.max(distance + 3, 0.08)
}

function project(p: Projector, distance: number, center: number) {
  const d = perspectiveDistance(distance)
  return {
    left: p.cx + ((center - p.half - p.playerX) * p.focal) / d,
    right: p.cx + ((center + p.half - p.playerX) * p.focal) / d,
    floor: p.horizon + (p.focal * 0.83 * p.eye) / d,
    ceiling: p.horizon - (p.focal * 0.83 * (1 - p.eye)) / d,
  }
}

function wallY(p: Projector, distance: number, v: number) {
  return p.horizon - (p.focal * 0.83 * (v - p.eye)) / perspectiveDistance(distance)
}

function screenX(p: Projector, distance: number, worldX: number) {
  return p.cx + ((worldX - p.playerX) * p.focal) / perspectiveDistance(distance)
}

function hashTile(index: number, seed: number): number {
  const value = Math.imul(index + 1, 2654435761) ^ Math.imul(seed + 7, 40503)
  return (value >>> 0) % 1000
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

type Point = { x: number; y: number }

function quad(ctx: CanvasRenderingContext2D, a: Point, b: Point, c: Point, d: Point, fill: string, outline?: string) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(c.x, c.y)
  ctx.lineTo(d.x, d.y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (outline) {
    ctx.strokeStyle = outline
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function centerAt(view: BackroomView, worldZ: number): number {
  return corridorCenterAt(view.gateCenter, view.bends, worldZ)
}

function wallX(p: Projector, view: BackroomView, side: 'left' | 'right', worldZ: number): number {
  const distance = perspectiveDistance(worldZ - view.depth)
  const center = centerAt(view, worldZ)
  return p.cx + ((center + (side === 'left' ? -p.half : p.half) - p.playerX) * p.focal) / distance
}

function centerX(p: Projector, view: BackroomView, distance: number): number {
  const d = perspectiveDistance(distance)
  return p.cx + ((centerAt(view, view.depth + distance) - p.playerX) * p.focal) / d
}

function drawWallpaper(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, side: 'left' | 'right', zNear: number, zFar: number, index: number) {
  const xAt = (worldZ: number) => wallX(p, view, side, worldZ)
  const zAt = (u: number) => zNear + (zFar - zNear) * u
  const yAt = (worldZ: number, v: number) => wallY(p, worldZ - view.depth, v)
  ctx.globalAlpha = 0.28
  for (let col = 0; col < 2; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      if (hashTile(index * 17 + col * 7 + row * 13, view.seed) % 4 === 0) continue
      const u0 = col / 2 + 0.12
      const u1 = u0 + 0.1
      const v0 = 0.15 + row * 0.2
      const v1 = v0 + 0.08
      const z0 = zAt(u0)
      const z1 = zAt(u1)
      if (z0 - view.depth < 0.3) continue
      quad(ctx,
        { x: xAt(z0), y: yAt(z0, v0) },
        { x: xAt(z1), y: yAt(z1, v0) },
        { x: xAt(z1), y: yAt(z1, v1) },
        { x: xAt(z0), y: yAt(z0, v1) },
        palette.wallMotif,
      )
    }
  }
  ctx.globalAlpha = 1
  const z0 = zAt(0)
  const z1 = zAt(1)
  if (z0 - view.depth > 0.3) {
    quad(ctx,
      { x: xAt(z0), y: yAt(z0, 0) },
      { x: xAt(z1), y: yAt(z1, 0) },
      { x: xAt(z1), y: yAt(z1, 0.09) },
      { x: xAt(z0), y: yAt(z0, 0.09) },
      palette.wainscot,
      'rgba(122,96,28,.45)',
    )
    ctx.globalAlpha = 0.24
    quad(ctx,
      { x: xAt(z0), y: yAt(z0, 0.5) },
      { x: xAt(z1), y: yAt(z1, 0.5) },
      { x: xAt(z1), y: yAt(z1, 0.52) },
      { x: xAt(z0), y: yAt(z0, 0.52) },
      palette.wallLine,
    )
    ctx.globalAlpha = 1
  }
}

// Water damage creeping down from the ceiling line.
function drawWallStain(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, side: 'left' | 'right', zNear: number, character: number) {
  const z0 = zNear + 0.1 + (character % 30) / 100
  const z1 = z0 + 0.35 + (character % 17) / 100
  if (z0 - view.depth < 0.35) return
  const reach = 0.62 + (character % 23) / 100
  const xAt = (worldZ: number) => wallX(p, view, side, worldZ)
  ctx.globalAlpha = 0.16
  quad(ctx,
    { x: xAt(z0), y: wallY(p, z0 - view.depth, 1) },
    { x: xAt(z1), y: wallY(p, z1 - view.depth, 1) },
    { x: xAt(z1), y: wallY(p, z1 - view.depth, reach + 0.1) },
    { x: xAt(z0), y: wallY(p, z0 - view.depth, reach) },
    '#5c4413',
  )
  ctx.globalAlpha = 0.1
  quad(ctx,
    { x: xAt(z0 + 0.06), y: wallY(p, z0 + 0.06 - view.depth, reach) },
    { x: xAt(z0 + 0.12), y: wallY(p, z0 + 0.12 - view.depth, reach) },
    { x: xAt(z0 + 0.12), y: wallY(p, z0 + 0.12 - view.depth, reach - 0.24) },
    { x: xAt(z0 + 0.06), y: wallY(p, z0 + 0.06 - view.depth, reach - 0.18) },
    '#4a360d',
  )
  ctx.globalAlpha = 1
}

// An open doorway into another empty room: the Backrooms go on in every direction.
function drawSideDoorway(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, side: 'left' | 'right', zNear: number) {
  const z0 = zNear + 0.18
  const z1 = zNear + 0.82
  if (z0 - view.depth < 0.4) return
  const x0 = wallX(p, view, side, z0)
  const x1 = wallX(p, view, side, z1)
  const top = 0.8
  const a = { x: x0, y: wallY(p, z0 - view.depth, 0) }
  const b = { x: x1, y: wallY(p, z1 - view.depth, 0) }
  const c = { x: x1, y: wallY(p, z1 - view.depth, top) }
  const d = { x: x0, y: wallY(p, z0 - view.depth, top) }
  quad(ctx, a, b, c, d, '#2a2210')
  // The far room is lit a little, as if its own fluorescent is still on.
  ctx.globalAlpha = 0.55
  const inset = 0.22
  const lerp = (from: Point, to: Point, t: number) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  quad(ctx, lerp(a, b, inset), lerp(b, a, inset), lerp(c, d, inset), lerp(d, c, inset), '#5d4b20')
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#7d5f22'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(d.x, d.y)
  ctx.lineTo(c.x, c.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawFloorStain(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, zNear: number, character: number) {
  const z0 = zNear + 0.15
  const z1 = zNear + 0.7 + (character % 20) / 100
  const near = z0 - view.depth
  if (near < 0.35) return
  const far = z1 - view.depth
  const start = -0.75 + (character % 90) / 100
  const end = start + 0.32 + (character % 13) / 100
  const xAt = (distance: number, fraction: number) => screenX(p, distance, centerAt(view, view.depth + distance) + fraction * p.half)
  const yAt = (distance: number) => wallY(p, distance, 0)
  ctx.globalAlpha = 0.2
  quad(ctx,
    { x: xAt(near, start), y: yAt(near) },
    { x: xAt(near, end), y: yAt(near) },
    { x: xAt(far, end - 0.08), y: yAt(far) },
    { x: xAt(far, start + 0.06), y: yAt(far) },
    '#5a4518',
  )
  ctx.globalAlpha = 1
}

function drawTurnSign(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  const bend = view.phase === 'turn' ? view.bends.find((item) => item.endZ > view.depth && item.startZ - view.depth < 16) : undefined
  if (!bend) return
  const direction = bend.dir
  const signZ = bend.startZ - 1.4
  const distance = signZ - view.depth
  if (distance < 2.5 || distance > 16) return
  const side: 'left' | 'right' = direction < 0 ? 'left' : 'right'
  const x = wallX(p, view, side, signZ)
  const size = Math.max(8, (p.focal * 0.34) / distance)
  const y = wallY(p, distance, 0.6)
  ctx.fillStyle = 'rgba(40,34,14,.22)'
  ctx.fillRect(x - size / 2 + 1, y + 1, size, size * 0.66)
  ctx.fillStyle = 'rgba(58,48,18,.88)'
  ctx.font = `bold ${Math.max(7, Math.round(size * 0.52))}px "IBM Plex Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(direction < 0 ? '←' : '→', x, y + size * 0.32)
}

function drawCorridor(ctx: CanvasRenderingContext2D, width: number, height: number, view: BackroomView, p: Projector) {
  const near = 0.28
  const far = 26
  const lateral = view.playerX - centerAt(view, view.depth)
  const backing = ctx.createLinearGradient(0, 0, width, 0)
  backing.addColorStop(0, lateral < -0.25 ? '#856c31' : palette.wallAlt)
  backing.addColorStop(0.5, palette.wallAlt)
  backing.addColorStop(1, lateral > 0.25 ? '#856c31' : palette.wallAlt)
  ctx.fillStyle = backing
  ctx.fillRect(0, 0, width, height)
  ctx.save()
  ctx.globalAlpha = 0.14
  ctx.fillStyle = palette.wallMotif
  for (let y = 7; y < height; y += 24) {
    for (let x = 9; x < width; x += 22) {
      if (hashTile(Math.floor(x / 22) + Math.floor(y / 24) * 31, view.seed) % 4 === 0) ctx.fillRect(x, y, 4, 9)
    }
  }
  ctx.strokeStyle = palette.wallLine
  ctx.lineWidth = 1
  for (let x = 0; x < width; x += Math.max(30, width / 10)) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  ctx.restore()
  const farOpening = project(p, far, centerAt(view, view.depth + far))
  ctx.fillStyle = palette.void
  ctx.fillRect(farOpening.left, farOpening.ceiling, farOpening.right - farOpening.left, farOpening.floor - farOpening.ceiling)
  const first = Math.floor(view.depth + near)
  const last = Math.ceil(view.depth + far)

  for (let index = last; index >= first; index -= 1) {
    const zNear = index
    const zFar = index + 1
    const nearDistance = zNear - view.depth
    const farDistance = zFar - view.depth
    if (farDistance <= near) continue
    const cn = centerAt(view, zNear)
    const cf = centerAt(view, zFar)
    const pn = project(p, Math.max(nearDistance, near), cn)
    const pf = project(p, farDistance, cf)
    const shade = index % 2 === 0
    const size = pn.floor - pn.ceiling
    const character = hashTile(index * 3 + 1, view.seed)

    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, shade ? palette.floorAlt : palette.floor)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, shade ? palette.ceilingAlt : palette.ceiling)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, shade ? palette.wallAlt : palette.wall)
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, shade ? palette.wallAlt : palette.wall)

    if (size > 12) {
      drawWallpaper(ctx, p, view, 'left', zNear, zFar, index)
      drawWallpaper(ctx, p, view, 'right', zNear, zFar, index)
      if (character % 6 === 0) drawFloorStain(ctx, p, view, zNear, character)
      if (character % 7 === 3) drawWallStain(ctx, p, view, character % 2 === 0 ? 'left' : 'right', zNear, character)
      if (character % 13 === 5 && Math.abs(cn - cf) < 0.05) drawSideDoorway(ctx, p, view, character % 2 === 0 ? 'right' : 'left', zNear)
    }

    const fade = Math.max(0.1, Math.min(0.65, 10 / Math.max(farDistance, 1)))
    ctx.globalAlpha = fade
    ctx.strokeStyle = palette.floorLine
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pn.left, pn.floor)
    ctx.lineTo(pn.right, pn.floor)
    ctx.stroke()
    ctx.strokeStyle = palette.ceilingLine
    ctx.beginPath()
    ctx.moveTo(pn.left, pn.ceiling)
    ctx.lineTo(pn.right, pn.ceiling)
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.lineWidth = 1
    for (const fraction of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
      const nearX = p.cx + ((cn + fraction * p.half - p.playerX) * p.focal) / perspectiveDistance(Math.max(nearDistance, near))
      const farX = p.cx + ((cf + fraction * p.half - p.playerX) * p.focal) / perspectiveDistance(farDistance)
      ctx.globalAlpha = 0.34
      ctx.strokeStyle = palette.ceilingLine
      ctx.beginPath()
      ctx.moveTo(nearX, pn.ceiling)
      ctx.lineTo(farX, pf.ceiling)
      ctx.stroke()
      ctx.globalAlpha = 0.22
      ctx.strokeStyle = palette.floorLine
      ctx.beginPath()
      ctx.moveTo(nearX, pn.floor)
      ctx.lineTo(farX, pf.floor)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    const fog = Math.min(0.9, 0.1 + Math.pow(Math.max(0, farDistance - 3) / 23, 1.35) * 0.82)
    ctx.globalAlpha = fog
    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, palette.void)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, palette.void)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, palette.void)
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, palette.void)
    ctx.globalAlpha = 1

    const nearestLight = Math.round((index - 2) / 5) * 5 + 2
    const lightDistance = Math.abs(index - nearestLight)
    // A failing fixture also removes its light from the nearby room surfaces.
    const localStrength = view.roomLight > 0 ? fixtureStrength(view, nearestLight) / view.roomLight : 1
    ctx.globalAlpha = (1 - localStrength) * 0.62
    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, palette.void)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, palette.void)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, palette.void)
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, palette.void)
    ctx.globalAlpha = 1
    if (lightDistance <= 2 && nearDistance > 0.3) {
      const strength = fixtureStrength(view, nearestLight)
      ctx.globalAlpha = (0.11 - lightDistance * 0.035) * strength
      quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, '#ffe29a')
      ctx.globalAlpha = (0.08 - lightDistance * 0.025) * strength
      quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, '#fff1b8')
      quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, '#fff1b8')
      ctx.globalAlpha = 1
    }

    if (index % 5 === 2 && size > 10) {
      const strength = fixtureStrength(view, index)
      const lightZ0 = Math.max(nearDistance, 0.9)
      const lightZ1 = farDistance
      if (lightZ1 > lightZ0 + 0.12) {
        const cx0 = centerX(p, view, lightZ0)
        const cx1 = centerX(p, view, lightZ1)
        const half0 = Math.min((0.1 * p.focal) / perspectiveDistance(lightZ0), width * 0.25)
        const half1 = Math.min((0.1 * p.focal) / perspectiveDistance(lightZ1), width * 0.25)
        ctx.globalAlpha = 0.32 * strength
        quad(ctx,
          { x: cx1 - half1 - 1.5, y: wallY(p, lightZ1, 1) },
          { x: cx1 + half1 + 1.5, y: wallY(p, lightZ1, 1) },
          { x: cx0 + half0 + 1.5, y: wallY(p, lightZ0, 1) },
          { x: cx0 - half0 - 1.5, y: wallY(p, lightZ0, 1) },
          palette.lightGlow,
        )
        ctx.globalAlpha = strength
        quad(ctx,
          { x: cx0 - half0, y: wallY(p, lightZ0, 1) + 0.5 },
          { x: cx0 + half0, y: wallY(p, lightZ0, 1) + 0.5 },
          { x: cx1 + half1, y: wallY(p, lightZ1, 1) + 0.5 },
          { x: cx1 - half1, y: wallY(p, lightZ1, 1) + 0.5 },
          palette.light,
          'rgba(122,96,28,.5)',
        )
        ctx.globalAlpha = 1
      }
    }

    if (index % 9 === 6 && size > 10) {
      const strength = fixtureStrength(view, index)
      const lightNear = Math.max(nearDistance, 0.9)
      const lightFar = farDistance
      for (const side of [-0.52, 0.52]) {
        const x = (distance: number, offset: number) => p.cx + ((centerAt(view, view.depth + distance) + offset - p.playerX) * p.focal) / perspectiveDistance(distance)
        ctx.save()
        ctx.globalAlpha = strength
        ctx.shadowColor = palette.lightGlow
        ctx.shadowBlur = 12
        quad(ctx,
          { x: x(lightNear, side - 0.09), y: wallY(p, lightNear, 1) },
          { x: x(lightFar, side - 0.09), y: wallY(p, lightFar, 1) },
          { x: x(lightFar, side + 0.09), y: wallY(p, lightFar, 1) },
          { x: x(lightNear, side + 0.09), y: wallY(p, lightNear, 1) },
          palette.light,
          '#fff0a2',
        )
        ctx.restore()
      }
    }
  }
}

// Dust hangs in the fluorescent light, fixed in the world so it drifts past.
function drawDust(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  const band = 14
  const base = Math.floor(view.depth / band) * band
  ctx.fillStyle = '#fff3c4'
  for (let index = 0; index < 56; index += 1) {
    const cycle = Math.floor(index / 28)
    const z = base + cycle * band + (hashTile(index + cycle * 97, view.seed) % 1400) / 100
    const distance = z - view.depth
    if (distance < 0.5 || distance > 13) continue
    const drift = view.reduced ? 0 : Math.sin(view.time * 0.35 + index) * 0.03
    const x = centerAt(view, z) + ((hashTile(index * 7, view.seed) % 140) / 100 - 0.7) * 0.95 + drift
    const v = 0.08 + (hashTile(index * 13, view.seed) % 88) / 100 + (view.reduced ? 0 : Math.sin(view.time * 0.22 + index * 1.7) * 0.02)
    const sx = screenX(p, distance, x)
    const sy = wallY(p, distance, v)
    const size = Math.max(0.7, 2.2 / perspectiveDistance(distance) * 3)
    ctx.globalAlpha = 0.22 * (1 - distance / 13) * Math.max(0.15, view.roomLight)
    ctx.fillRect(sx, sy, size, size)
  }
  ctx.globalAlpha = 1
}

function drawBarrier(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, z: number) {
  const distance = z - view.depth
  if (distance <= 0.2 || distance > 20) return
  const center = centerAt(view, z)
  const left = screenX(p, distance, center - p.half * 0.92)
  const right = screenX(p, distance, center + p.half * 0.92)
  for (const [v, thickness] of [[0.34, 0.07], [0.2, 0.05]] as const) {
    const top = wallY(p, distance, v)
    const bottom = wallY(p, distance, v - thickness)
    ctx.fillStyle = palette.hazard
    ctx.fillRect(left, top, right - left, bottom - top)
    ctx.fillStyle = palette.steelDark
    const step = Math.max(4, (right - left) / 12)
    for (let x = left; x < right; x += step * 2) ctx.fillRect(x, top, step, bottom - top)
  }
  ctx.fillStyle = palette.steelDark
  for (const side of [-0.85, 0.85]) {
    const x = screenX(p, distance, center + side * p.half)
    ctx.fillRect(x - 1, wallY(p, distance, 0.36), Math.max(2, (right - left) * 0.02), wallY(p, distance, 0) - wallY(p, distance, 0.36))
  }
}

const floorAt = (p: Projector, distance: number) => p.horizon + (p.focal * 0.83 / perspectiveDistance(distance)) * p.eye

// A hole: the carpet simply stops, and below it there is nothing.
function drawHole(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, z: number) {
  const near = Math.max(0.2, z - holeHalfLength - view.depth)
  const far = z + holeHalfLength - view.depth
  if (far <= 0.2 || near > 20) return
  const center = centerAt(view, z)
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.moveTo(screenX(p, near, center - p.half), floorAt(p, near))
  ctx.lineTo(screenX(p, near, center + p.half), floorAt(p, near))
  ctx.lineTo(screenX(p, far, center + p.half), floorAt(p, far))
  ctx.lineTo(screenX(p, far, center - p.half), floorAt(p, far))
  ctx.closePath()
  ctx.fill()
}

// A saw: a steel half-disc out of one wall.
function drawSaw(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, z: number, side: -1 | 1) {
  const distance = z - view.depth
  if (distance <= 0.2 || distance > 18) return
  const out = Math.min(1, Math.max(0, (sawEmerge - distance) / (sawEmerge - sawOut)))
  if (out <= 0) return
  const center = centerAt(view, z)
  const wallX = screenX(p, distance, center + side * p.half)
  const tipX = screenX(p, distance, center - side * sawReach * out + side * p.half * (1 - out))
  const radius = Math.abs(tipX - wallX)
  const y = wallY(p, distance, 0.5)
  ctx.fillStyle = '#9aa3aa'
  ctx.beginPath()
  ctx.arc(wallX, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3b4247'
  ctx.beginPath()
  ctx.arc(wallX, y, radius * 0.25, 0, Math.PI * 2)
  ctx.fill()
}

// A drill: a tapering bit from the ceiling or the floor in one lane.
function drawDrill(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, obstacle: CorridorObstacle) {
  const distance = obstacle.z - view.depth
  if (distance <= 0.2 || distance > 18) return
  const out = Math.min(1, Math.max(0, (drillStrike - distance) / (drillStrike - drillOut)))
  const x = screenX(p, distance, obstacle.x)
  const half = Math.abs(screenX(p, distance, obstacle.x + 0.18) - x)
  const floor = wallY(p, distance, 0)
  const ceiling = wallY(p, distance, 1.25)
  ctx.fillStyle = '#c9a24a'
  ctx.beginPath()
  if (obstacle.side > 0) {
    const tip = ceiling + (floor - ceiling) * out
    ctx.moveTo(x - half, ceiling); ctx.lineTo(x + half, ceiling); ctx.lineTo(x, tip)
  } else {
    const tip = floor - (floor - ceiling) * 0.9 * out
    ctx.moveTo(x - half, floor); ctx.lineTo(x + half, floor); ctx.lineTo(x, tip)
  }
  ctx.closePath()
  ctx.fill()
}

function drawPickups(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  for (const pickup of view.pickups ?? []) {
    const distance = pickup.z - view.depth
    if (distance <= 0.2 || distance > 18) continue
    const unit = p.focal * 0.83 / perspectiveDistance(distance)
    const x = screenX(p, distance, pickup.x)
    const floor = floorAt(p, distance)
    const width = unit * 0.18
    ctx.fillStyle = '#e8e6df'
    ctx.fillRect(x - width / 2, floor - width * 0.6, width, width * 0.55)
    ctx.fillStyle = '#4dff8a'
    for (let led = 0; led < 4; led += 1) ctx.fillRect(x - width * 0.38 + led * width * 0.2, floor - width * 0.45, width * 0.12, width * 0.12)
  }
}

function drawObstacles(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  for (const obstacle of view.obstacles) if (obstacle.kind === 'hole') drawHole(ctx, p, view, obstacle.z)
  for (const obstacle of view.obstacles) if (obstacle.kind === 'barrier') drawBarrier(ctx, p, view, obstacle.z)
  for (const obstacle of view.obstacles) if (obstacle.kind === 'saw') drawSaw(ctx, p, view, obstacle.z, obstacle.side)
  for (const obstacle of view.obstacles) if (obstacle.kind === 'drill') drawDrill(ctx, p, view, obstacle)
  drawPickups(ctx, p, view)
  if (view.phase !== 'turn') return
  const lastBend = view.bends[view.bends.length - 1]
  if (!lastBend || view.depth < lastBend.endZ - 4) return
  for (const obstacle of view.obstacles) {
    const distance = obstacle.z - view.depth
    if (obstacle.kind === 'barrier' || obstacle.kind === 'hole' || obstacle.kind === 'saw' || obstacle.kind === 'drill' || distance <= 0.2 || distance > 18) continue
    const unit = p.focal * 0.83 / perspectiveDistance(distance)
    const x = screenX(p, distance, obstacle.x)
    const floor = p.horizon + unit * p.eye
    const width = unit * 0.36
    const height = unit * 0.5
    if (width < 3) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, (view.depth - lastBend.endZ + 4) / 3)
    ctx.fillStyle = 'rgba(6,8,10,.52)'
    ctx.fillRect(x - width * 0.75, floor - height * 0.07, width * 1.5, height * 0.12)
    if (obstacle.kind === 'chair') {
      ctx.fillStyle = '#201b18'
      ctx.fillRect(x - width * 0.43, floor - height * 0.55, width * 0.16, height * 0.54)
      ctx.fillRect(x + width * 0.27, floor - height * 0.55, width * 0.16, height * 0.54)
      ctx.fillRect(x - width * 0.43, floor - height, width * 0.15, height * 0.5)
      ctx.fillRect(x + width * 0.28, floor - height, width * 0.15, height * 0.5)
      ctx.fillStyle = '#6a5437'
      ctx.fillRect(x - width * 0.4, floor - height * 0.94, width * 0.8, height * 0.37)
      ctx.fillStyle = '#9a7649'
      ctx.fillRect(x - width * 0.37, floor - height * 0.89, width * 0.69, height * 0.08)
      ctx.fillStyle = '#483827'
      ctx.fillRect(x - width * 0.52, floor - height * 0.58, width * 1.04, height * 0.17)
      ctx.fillStyle = '#ac8550'
      ctx.fillRect(x - width * 0.48, floor - height * 0.58, width * 0.96, height * 0.06)
    } else {
      ctx.fillStyle = '#172025'
      ctx.fillRect(x - width * 0.42, floor - height * 0.77, width * 0.84, height * 0.72)
      ctx.fillStyle = '#495961'
      ctx.fillRect(x - width * 0.36, floor - height * 0.71, width * 0.7, height * 0.61)
      ctx.fillStyle = '#7a8a87'
      ctx.fillRect(x - width * 0.49, floor - height * 0.83, width * 0.98, height * 0.1)
      ctx.fillStyle = '#29383c'
      ctx.fillRect(x - width * 0.36, floor - height * 0.88, width * 0.72, height * 0.06)
      ctx.fillStyle = '#9faa9f'
      ctx.fillRect(x - width * 0.27, floor - height * 0.62, width * 0.09, height * 0.45)
      ctx.fillStyle = '#d2b873'
      ctx.fillRect(x + width * 0.04, floor - height * 0.52, width * 0.22, height * 0.17)
    }
    ctx.restore()
  }
}

// A tall, thin figure at the end of the corridor, only ever seen in failing light.
function drawEntity(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  const entity = view.entity
  if (!entity || entity.alpha <= 0.01) return
  const distance = entity.z - view.depth
  if (distance < 2 || distance > 25) return
  const fog = Math.min(0.9, 0.1 + Math.pow(Math.max(0, distance - 3) / 23, 1.35) * 0.82)
  const jitter = view.reduced ? 0 : (hashTile(Math.floor(view.time * 18), view.seed) % 100 - 50) / 2400
  const x = screenX(p, distance, entity.x + jitter)
  const feet = wallY(p, distance, 0)
  const head = wallY(p, distance, 0.94)
  const height = feet - head
  const width = height * 0.17
  ctx.save()
  ctx.globalAlpha = entity.alpha * (1 - fog * 0.55)
  ctx.fillStyle = '#050403'
  ctx.fillRect(x - width * 0.5, head + height * 0.16, width, height * 0.5)
  ctx.fillRect(x - width * 0.44, head + height * 0.6, width * 0.32, height * 0.4)
  ctx.fillRect(x + width * 0.12, head + height * 0.6, width * 0.32, height * 0.4)
  ctx.fillRect(x - width * 0.78, head + height * 0.2, width * 0.24, height * 0.5)
  ctx.fillRect(x + width * 0.54, head + height * 0.2, width * 0.24, height * 0.5)
  ctx.beginPath()
  ctx.ellipse(x, head + height * 0.08, width * 0.36, height * 0.085, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

interface GateLook {
  signal: GateSignal | 'upcoming'
  fork: boolean
  trueSide: -1 | 1
  open: number
  doorOpen: [number, number]
  flashSide: -1 | 0 | 1
  label: string
  blinkRate: number
}

function signalColor(signal: GateLook['signal']): [string, string] {
  switch (signal) {
    case 'true': return [palette.green, palette.greenDark]
    case 'false': return [palette.red, palette.redDark]
    case 'unknown': return [palette.amber, palette.amberDark]
    case 'upcoming': return [palette.cyan, palette.cyanDark]
  }
}

function drawShutter(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number, open: number, post: number) {
  const width = right - left
  const visible = (bottom - top) * (1 - open)
  if (width < 1 || visible < 0.6) return
  ctx.fillStyle = palette.steel
  ctx.fillRect(left, top, width, visible)
  ctx.fillStyle = palette.steelDark
  const slat = Math.max(2, (bottom - top) / 11)
  for (let y = top + slat; y < top + visible; y += slat) ctx.fillRect(left, y, width, Math.max(1, slat * 0.18))
  ctx.fillStyle = palette.steelLight
  ctx.fillRect(left, top, width, Math.max(1, slat * 0.3))
  const stripe = Math.max(1, (bottom - top) * 0.1)
  ctx.fillStyle = palette.hazard
  ctx.fillRect(left, top + visible - stripe, width, stripe)
  ctx.fillStyle = palette.steelDark
  const step = Math.max(4, post * 0.9)
  for (let x = left; x < right; x += step) ctx.fillRect(x, top + visible - stripe, Math.max(1.5, post * 0.32), stripe)
  ctx.strokeStyle = palette.outline
  ctx.lineWidth = Math.max(1, post * 0.08)
  ctx.strokeRect(left, top, width, visible)
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, color: string, border: string) {
  ctx.fillStyle = palette.steelDark
  ctx.fillRect(x - width / 2 - 1.5, y - 1.5, width + 3, height + 3)
  ctx.fillStyle = palette.sign
  ctx.fillRect(x - width / 2, y, width, height)
  ctx.strokeStyle = border
  ctx.lineWidth = Math.max(1, height * 0.08)
  ctx.strokeRect(x - width / 2 + 1, y + 1, width - 2, height - 2)
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = Math.max(2, height * 0.35)
  ctx.fillStyle = color
  ctx.font = `bold ${Math.max(6, Math.round(height * 0.62))}px "Backroom Pixel", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + height * 0.54)
  ctx.restore()
}

function drawGateStructure(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, distance: number, center: number, look: GateLook) {
  const proj = project(p, distance, center)
  const span = proj.right - proj.left
  const gateHeight = proj.floor - proj.ceiling
  if (span < 6 || gateHeight < 4) return
  const post = Math.max(2, span * 0.13)
  const beam = Math.max(2.5, gateHeight * 0.16)
  const xLeft = proj.left
  const xRight = proj.right
  const innerLeft = xLeft + post
  const innerRight = xRight - post
  const top = proj.ceiling
  const doorTop = top + beam
  const doorBottom = proj.floor
  const [color, dark] = signalColor(look.signal)

  // Light spills through the doorway; it fades as the doors open so the corridor beyond shows.
  const opened = look.fork ? Math.max(look.doorOpen[0], look.doorOpen[1]) : look.open
  const glow = ctx.createRadialGradient((innerLeft + innerRight) / 2, doorBottom, 1, (innerLeft + innerRight) / 2, doorBottom, Math.max(6, span))
  const strength = 1 - opened * 0.8
  glow.addColorStop(0, look.signal === 'true' ? `rgba(92,232,127,${0.55 * strength})` : look.signal === 'false' ? `rgba(255,85,96,${0.3 * strength})` : look.signal === 'unknown' ? `rgba(255,180,59,${0.3 * strength})` : 'rgba(83,191,245,.25)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(innerLeft, doorTop, innerRight - innerLeft, doorBottom - doorTop)

  if (look.fork) {
    const mid = (innerLeft + innerRight) / 2
    const pillar = Math.max(2, post * 0.8)
    const doors: Array<[number, number, -1 | 1]> = [[innerLeft, mid - pillar / 2, -1], [mid + pillar / 2, innerRight, 1]]
    for (const [left, right, side] of doors) {
      const open = side === -1 ? look.doorOpen[0] : look.doorOpen[1]
      drawShutter(ctx, left, right, doorTop, doorBottom, open, post)
      if (look.flashSide === side) {
        const blink = view.reduced || Math.sin(view.time * 22) > -0.3
        ctx.globalAlpha = blink ? 0.45 : 0.2
        ctx.fillStyle = palette.red
        ctx.fillRect(left, doorTop, right - left, doorBottom - doorTop)
        ctx.globalAlpha = 1
      }
    }
    ctx.fillStyle = palette.steel
    ctx.fillRect(mid - pillar / 2, doorTop, pillar, doorBottom - doorTop)
    ctx.fillStyle = palette.hazard
    const band = Math.max(2, pillar * 0.9)
    for (let y = doorTop + band; y < doorBottom; y += band * 2) ctx.fillRect(mid - pillar / 2, y, pillar, band)
    ctx.strokeStyle = palette.outline
    ctx.lineWidth = Math.max(1, post * 0.08)
    ctx.strokeRect(mid - pillar / 2, doorTop, pillar, doorBottom - doorTop)
  } else {
    const halfDoor = ((innerRight - innerLeft) / 2) * (1 - look.open)
    if (halfDoor > 0.6) {
      ctx.fillStyle = palette.steel
      ctx.fillRect(innerLeft, doorTop, halfDoor, doorBottom - doorTop)
      ctx.fillRect(innerRight - halfDoor, doorTop, halfDoor, doorBottom - doorTop)
      ctx.fillStyle = palette.steelDark
      for (let g = 1; g < 3; g += 1) {
        const gx = innerLeft + (halfDoor * g) / 3
        ctx.fillRect(gx, doorTop + gateHeight * 0.05, Math.max(1, post * 0.1), (doorBottom - doorTop) * 0.9)
        ctx.fillRect(innerRight - (halfDoor * g) / 3, doorTop + gateHeight * 0.05, Math.max(1, post * 0.1), (doorBottom - doorTop) * 0.9)
      }
      ctx.fillStyle = palette.steelLight
      ctx.fillRect(innerLeft, doorTop, halfDoor, Math.max(1, gateHeight * 0.05))
      ctx.fillRect(innerRight - halfDoor, doorTop, halfDoor, Math.max(1, gateHeight * 0.05))
      ctx.fillStyle = palette.hazard
      const stripeHeight = Math.max(1, (doorBottom - doorTop) * 0.13)
      ctx.fillRect(innerLeft, doorBottom - stripeHeight, halfDoor, stripeHeight)
      ctx.fillRect(innerRight - halfDoor, doorBottom - stripeHeight, halfDoor, stripeHeight)
      ctx.fillStyle = palette.steelDark
      const step = Math.max(4, post * 0.9)
      for (let x = innerLeft; x < innerLeft + halfDoor; x += step) ctx.fillRect(x, doorBottom - stripeHeight, Math.max(1.5, post * 0.32), stripeHeight)
      for (let x = innerRight - halfDoor; x < innerRight; x += step) ctx.fillRect(x, doorBottom - stripeHeight, Math.max(1.5, post * 0.32), stripeHeight)
      ctx.strokeStyle = palette.outline
      ctx.lineWidth = Math.max(1, post * 0.08)
      ctx.strokeRect(innerLeft, doorTop, halfDoor, doorBottom - doorTop)
      ctx.strokeRect(innerRight - halfDoor, doorTop, halfDoor, doorBottom - doorTop)
    }
  }

  ctx.fillStyle = palette.steel
  ctx.fillRect(xLeft, top, post, proj.floor - top)
  ctx.fillRect(xRight - post, top, post, proj.floor - top)
  ctx.fillRect(xLeft, top, span, beam)
  ctx.fillStyle = palette.steelDark
  ctx.fillRect(xLeft, top, span, Math.max(1, beam * 0.28))
  ctx.fillRect(xLeft, top, Math.max(1, post * 0.22), proj.floor - top)
  ctx.fillRect(xRight - Math.max(1, post * 0.22), top, Math.max(1, post * 0.22), proj.floor - top)
  ctx.strokeStyle = palette.outline
  ctx.lineWidth = Math.max(1, post * 0.09)
  ctx.strokeRect(xLeft, top, post, proj.floor - top)
  ctx.strokeRect(xRight - post, top, post, proj.floor - top)
  ctx.strokeRect(xLeft, top, span, beam)

  if (look.fork) {
    // Door labels sit on the beam, so they are drawn after it.
    const mid = (innerLeft + innerRight) / 2
    const pillar = Math.max(2, post * 0.8)
    for (const [left, right, side] of [[innerLeft, mid - pillar / 2, -1], [mid + pillar / 2, innerRight, 1]] as Array<[number, number, -1 | 1]>) {
      const isTrueDoor = side === look.trueSide
      const labelWidth = (right - left) * 0.9
      const labelHeight = Math.max(7, beam * 1.25)
      if (labelWidth > 10) drawLabel(ctx, isTrueDoor ? 'TRUE' : 'FALSE', (left + right) / 2, top - labelHeight * 0.32, labelWidth, labelHeight, isTrueDoor ? palette.green : palette.red, isTrueDoor ? palette.greenDark : palette.redDark)
    }
  }

  const stripHeight = gateHeight * 0.52
  const stripY = top + gateHeight * 0.24
  const stripWidth = Math.max(1.5, post * 0.24)
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = Math.max(5, stripWidth * 2)
  ctx.fillStyle = color
  ctx.fillRect(innerLeft - stripWidth * 1.1, stripY, stripWidth, stripHeight)
  ctx.fillRect(innerRight + stripWidth * 0.1, stripY, stripWidth, stripHeight)
  ctx.restore()

  const hazardHeight = Math.max(2, gateHeight * 0.16)
  ctx.fillStyle = palette.hazard
  ctx.fillRect(xLeft, proj.floor - hazardHeight, post, hazardHeight)
  ctx.fillRect(xRight - post, proj.floor - hazardHeight, post, hazardHeight)
  ctx.fillStyle = palette.steelDark
  for (let x = xLeft; x < xLeft + post; x += Math.max(3, post * 0.5)) ctx.fillRect(x, proj.floor - hazardHeight, Math.max(1.5, post * 0.22), hazardHeight)
  for (let x = xRight - post; x < xRight; x += Math.max(3, post * 0.5)) ctx.fillRect(x, proj.floor - hazardHeight, Math.max(1.5, post * 0.22), hazardHeight)

  const blink = view.reduced || Math.sin(view.time * look.blinkRate) > -0.2
  const lampSize = Math.max(2, post * 0.5)
  ctx.fillStyle = look.signal === 'false' && !blink ? palette.redDark : color
  ctx.fillRect(xLeft + post * 0.24, top + gateHeight * 0.06, lampSize, lampSize)
  ctx.fillRect(xRight - post * 0.24 - lampSize, top + gateHeight * 0.06, lampSize, lampSize)

  const signWidth = span * (look.fork ? 0.5 : 0.82)
  const signHeight = Math.max(9, gateHeight * 0.2)
  const signCenter = (xLeft + xRight) / 2
  const signY = top - signHeight * 0.62
  const signText = look.signal === 'upcoming' ? look.label
    : look.signal === 'true' ? 'TRUE' : look.signal === 'false' ? 'FALSE' : '?  ?  ?'
  // Fork gates carry their TRUE / FALSE signs instead of a single top sign.
  if (!look.fork) drawLabel(ctx, signText, signCenter, signY, signWidth, signHeight, color, dark)
}

function drawLaneLine(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  const end = view.gateZ - view.depth
  if (end <= 0.3) return
  const start = Math.max(0.35, end - 7)
  ctx.save()
  const steps = 14
  for (let step = 0; step < steps; step += 1) {
    if (step % 2 === 1) continue
    const d0 = start + ((end - start) * step) / steps
    const d1 = start + ((end - start) * (step + 1)) / steps
    const w0 = 0.025
    quad(ctx,
      { x: screenX(p, d0, view.gateCenter - w0), y: wallY(p, d0, 0) },
      { x: screenX(p, d0, view.gateCenter + w0), y: wallY(p, d0, 0) },
      { x: screenX(p, d1, view.gateCenter + w0), y: wallY(p, d1, 0) },
      { x: screenX(p, d1, view.gateCenter - w0), y: wallY(p, d1, 0) },
      'rgba(224,137,47,.8)',
    )
  }
  ctx.restore()
}

function drawGate(ctx: CanvasRenderingContext2D, view: BackroomView, p: Projector) {
  if (view.hideGate) return
  const distance = view.gateZ - view.depth
  const blinkRate = 6 + view.falseIntensity * 9
  if (view.phase === 'turn') {
    const lastBend = view.bends[view.bends.length - 1]
    const nextDistance = view.nextGateZ - view.depth
    if (lastBend && view.depth >= lastBend.endZ - 3 && nextDistance > 0) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, (view.depth - lastBend.endZ + 3) / 3)
      drawGateStructure(ctx, p, view, nextDistance, view.nextGateCenter, {
        signal: 'upcoming', fork: view.nextGateKind === 'fork', trueSide: view.nextTrueSide, open: 0, doorOpen: [0, 0], flashSide: 0,
        label: `GATE ${String(view.gateNumber + 1).padStart(2, '0')}`, blinkRate,
      })
      ctx.restore()
    }
    return
  }
  if (distance <= 0.1) return

  const signDistance = distance - 4
  if (signDistance > 2.4) {
    const sp = project(p, signDistance, view.gateCenter)
    const wallSignSize = Math.max(7, (sp.floor - sp.ceiling) * 0.16)
    drawWallSign(ctx, p, view, 'left', signDistance, wallSignSize, `GATE ${String(view.gateNumber).padStart(2, '0')}`)
  }
  if (view.gateKind === 'fork') drawLaneLine(ctx, p, view)

  drawGateStructure(ctx, p, view, distance, view.gateCenter, {
    signal: view.signal, fork: view.gateKind === 'fork', trueSide: view.trueSide, open: view.openAmount, doorOpen: view.doorOpen,
    flashSide: view.flashSide, label: `GATE ${String(view.gateNumber).padStart(2, '0')}`, blinkRate,
  })

  if (view.falseIntensity > 0.05 && view.signal === 'false' && view.gateKind === 'set') {
    const proj = project(p, distance, view.gateCenter)
    const span = proj.right - proj.left
    const gateHeight = proj.floor - proj.ceiling
    const post = Math.max(2, span * 0.13)
    const blink = view.reduced || Math.sin(view.time * blinkRate) > -0.2
    ctx.globalAlpha = Math.min(0.5, view.falseIntensity * (blink ? 0.65 : 0.22))
    ctx.fillStyle = palette.red
    ctx.fillRect(proj.left + post * 0.9, proj.ceiling + gateHeight * 0.16, post * 0.3, gateHeight * 0.6)
    ctx.fillRect(proj.right - post * 1.2, proj.ceiling + gateHeight * 0.16, post * 0.3, gateHeight * 0.6)
    ctx.globalAlpha = 1
  }
}

function drawWallSign(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, side: 'left' | 'right', distance: number, size: number, text: string) {
  const worldZ = view.depth + distance
  const x = wallX(p, view, side, worldZ)
  const y = wallY(p, distance, 0.62)
  const left = side === 'left' ? Math.max(8, x + 5) : Math.min(x - size - 5, p.cx * 2 - size - 8)
  ctx.fillStyle = 'rgba(40,34,14,.2)'
  ctx.fillRect(left + 1, y + 1, size, size * 0.5)
  ctx.fillStyle = 'rgba(58,48,18,.85)'
  ctx.font = `bold ${Math.max(6, Math.round(size * 0.27))}px "Backroom Pixel", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + size / 2, y + size * 0.16)
  if (size > 14) ctx.fillText('→', left + size / 2, y + size * 0.4)
}

function drawFloorGlow(ctx: CanvasRenderingContext2D, width: number, height: number, view: BackroomView, p: Projector) {
  if (view.hideGate || view.phase !== 'gate' || view.gateZ <= view.depth) return
  const distance = Math.max(view.gateZ - view.depth, 0.4)
  const proj = project(p, distance, view.gateCenter)
  const radius = Math.max(8, Math.min(width * 0.42, (proj.right - proj.left) * 0.65))
  const gradient = ctx.createRadialGradient((proj.left + proj.right) / 2, proj.floor, 1, (proj.left + proj.right) / 2, proj.floor, radius)
  gradient.addColorStop(0, view.signal === 'true' ? 'rgba(92,232,127,.33)' : view.signal === 'false' ? 'rgba(255,85,96,.12)' : 'rgba(255,180,59,.14)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, p.horizon, width, height - p.horizon)
}

// The camcorder's infrared mode: green monochrome, lifted blacks, sensor noise.
function applyNightVision(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, time: number, reduced: boolean) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, amount)
  ctx.globalCompositeOperation = 'color'
  ctx.fillStyle = '#4dff86'
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = amount * 0.42
  ctx.fillStyle = '#123d1f'
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, width * 0.7)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, `rgba(0,12,4,${0.75 * amount})`)
  ctx.globalAlpha = 1
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  if (!reduced) {
    const dots = Math.round(width * height * 0.006 * amount)
    const seed = Math.floor(time * 30)
    for (let index = 0; index < dots; index += 1) {
      const h = hashTile(index * 31 + seed * 7919, 3)
      const h2 = hashTile(index * 17 + seed * 104729, 11)
      ctx.fillStyle = h % 2 === 0 ? 'rgba(190,255,205,.32)' : 'rgba(0,0,0,.35)'
      ctx.fillRect((h / 1000) * width + (h2 % 7), (h2 / 1000) * height, 1, 1)
    }
  }
  ctx.restore()
}

// VHS tracking error: horizontal slices of the frame slip sideways.
function applyTrackingGlitch(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, time: number) {
  const canvas = ctx.canvas
  const bands = 2 + Math.round(amount * 4)
  const seed = Math.floor(time * 24)
  for (let band = 0; band < bands; band += 1) {
    const y = (hashTile(band * 13 + seed, 5) / 1000) * height
    const h = Math.max(2, (hashTile(band * 7 + seed, 9) / 1000) * height * 0.12 * amount + 1)
    const shift = ((hashTile(band * 3 + seed, 2) / 1000) - 0.5) * width * 0.08 * amount
    try { ctx.drawImage(canvas, 0, y, width, h, shift, y, width, h) } catch { return }
  }
  ctx.fillStyle = `rgba(255,255,255,${0.18 * amount})`
  const line = ((time * 90) % (height + 20)) - 10
  ctx.fillRect(0, line, width, Math.max(1, height * 0.012))
}

export function drawBackroom(ctx: CanvasRenderingContext2D, width: number, height: number, view: BackroomView) {
  const p = makeProjector(width, height, view.playerX)
  p.eye += view.jump * 0.9
  if (!view.reduced) {
    const step = view.depth * 3.1
    p.horizon += (Math.sin(step) * 0.6 + Math.sin(step * 2.1 + 0.7) * 0.4) * height * 0.012
  }
  ctx.save()
  if (view.shake > 0.01 && !view.reduced) {
    ctx.translate((Math.random() - 0.5) * view.shake * 6, (Math.random() - 0.5) * view.shake * 6)
  }
  ctx.imageSmoothingEnabled = false
  drawCorridor(ctx, width, height, view, p)
  drawTurnSign(ctx, p, view)
  // The figure is hidden by a gate in front of it, and covers one behind it.
  const gateAhead = view.phase === 'gate' ? view.gateZ : view.nextGateZ
  const figureInFront = !!view.entity && (view.hideGate || view.entity.z < gateAhead)
  if (!figureInFront) drawEntity(ctx, p, view)
  drawFloorGlow(ctx, width, height, view, p)
  drawObstacles(ctx, p, view)
  drawGate(ctx, view, p)
  if (figureInFront) drawEntity(ctx, p, view)
  drawDust(ctx, p, view)
  if (view.falseIntensity > 0.02) {
    const rate = 5 + view.falseIntensity * 14
    const pulse = view.reduced ? 0.6 : (Math.sin(view.time * rate) > 0 ? 1 : 0.3)
    ctx.fillStyle = `rgba(255,42,56,${Math.min(0.3, view.falseIntensity * 0.26 * pulse)})`
    ctx.fillRect(0, 0, width, height)
  }
  // Keep a little ambient light even with every fluorescent switched off.
  // Night vision lifts most of the darkness back out in green.
  const darkness = (1 - (view.reduced || !view.lightsActive ? 1 : view.roomLight)) * 0.94
  ctx.fillStyle = `rgba(0,0,0,${darkness * (1 - view.nightVision * 0.8)})`
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  if (view.nightVision > 0.01) applyNightVision(ctx, width, height, view.nightVision, view.time, view.reduced)
  if (view.glitch > 0.02 && !view.reduced) applyTrackingGlitch(ctx, width, height, view.glitch, view.time)
}
