import { corridorCenterAt, type CorridorBend, type CorridorObstacle } from '../../lib/backroomEngine'

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
  openAmount: number
  conditionTrue: boolean
  falseIntensity: number
  time: number
  roomLight: number
  gateNumber: number
  seed: number
  reduced: boolean
  shake: number
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
  sign: '#12161f',
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

function hashTile(index: number, seed: number): number {
  const value = Math.imul(index + 1, 2654435761) ^ Math.imul(seed + 7, 40503)
  return (value >>> 0) % 1000
}

function fixtureStrength(view: BackroomView, index: number): number {
  if (view.reduced) return 1
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
  ctx.fillStyle = '#080b0d'
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

    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, shade ? palette.floorAlt : palette.floor)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, shade ? palette.ceilingAlt : palette.ceiling)
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, shade ? palette.wallAlt : palette.wall)
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, shade ? palette.wallAlt : palette.wall)

    if (size > 12) {
      drawWallpaper(ctx, p, view, 'left', zNear, zFar, index)
      drawWallpaper(ctx, p, view, 'right', zNear, zFar, index)
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
    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, '#080b0d')
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, '#080b0d')
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, '#080b0d')
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, '#080b0d')
    ctx.globalAlpha = 1

    const nearestLight = Math.round((index - 2) / 5) * 5 + 2
    const lightDistance = Math.abs(index - nearestLight)
    // A failing fixture also removes its light from the nearby room surfaces.
    const localStrength = view.roomLight > 0 ? fixtureStrength(view, nearestLight) / view.roomLight : 1
    ctx.globalAlpha = (1 - localStrength) * 0.62
    quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, '#080b0d')
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.right, y: pf.ceiling }, { x: pn.right, y: pn.ceiling }, { x: pn.left, y: pn.ceiling }, '#080b0d')
    quad(ctx, { x: pf.left, y: pf.ceiling }, { x: pf.left, y: pf.floor }, { x: pn.left, y: pn.floor }, { x: pn.left, y: pn.ceiling }, '#080b0d')
    quad(ctx, { x: pf.right, y: pf.ceiling }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.right, y: pn.ceiling }, '#080b0d')
    ctx.globalAlpha = 1
    if (lightDistance <= 2 && nearDistance > 0.3) {
      const strength = fixtureStrength(view, nearestLight)
      ctx.globalAlpha = (0.11 - lightDistance * 0.035) * strength
      quad(ctx, { x: pf.left, y: pf.floor }, { x: pf.right, y: pf.floor }, { x: pn.right, y: pn.floor }, { x: pn.left, y: pn.floor }, '#ffe29a')
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

function drawObstacles(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  if (view.phase !== 'turn') return
  const lastBend = view.bends.at(-1)
  if (!lastBend || view.depth < lastBend.endZ - 4) return
  for (const obstacle of view.obstacles) {
    const distance = obstacle.z - view.depth
    if (distance <= 0.2 || distance > 18) continue
    const unit = p.focal * 0.83 / perspectiveDistance(distance)
    const x = p.cx + (obstacle.x - p.playerX) * p.focal / perspectiveDistance(distance)
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

function drawGateStructure(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, distance: number, center: number, gateNumber: number, active: boolean, open: number, detailed: boolean, blinkRate: number, upcoming = false) {
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

  const glow = ctx.createRadialGradient(p.cx, doorBottom, 1, p.cx, doorBottom, Math.max(6, span))
  glow.addColorStop(0, upcoming ? 'rgba(83,191,245,.25)' : active ? 'rgba(92,232,127,.55)' : 'rgba(255,85,96,.3)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(innerLeft, doorTop, innerRight - innerLeft, doorBottom - doorTop)

  const halfDoor = ((innerRight - innerLeft) / 2) * (1 - open)
  if (halfDoor > 0.6) {
    ctx.fillStyle = palette.steel
    ctx.fillRect(innerLeft, doorTop, halfDoor, doorBottom - doorTop)
    ctx.fillRect(innerRight - halfDoor, doorTop, halfDoor, doorBottom - doorTop)
    ctx.fillStyle = palette.steelDark
    const grooves = 3
    for (let g = 1; g < grooves; g += 1) {
      const gx = innerLeft + (halfDoor * g) / grooves
      ctx.fillRect(gx, doorTop + gateHeight * 0.05, Math.max(1, post * 0.1), (doorBottom - doorTop) * 0.9)
      ctx.fillRect(innerRight - (halfDoor * g) / grooves, doorTop + gateHeight * 0.05, Math.max(1, post * 0.1), (doorBottom - doorTop) * 0.9)
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

  const stripHeight = gateHeight * 0.52
  const stripY = top + gateHeight * 0.24
  const stripWidth = Math.max(1.5, post * 0.24)
  ctx.save()
  ctx.shadowColor = upcoming ? '#73d5ff' : active ? palette.green : palette.red
  ctx.shadowBlur = Math.max(5, stripWidth * 2)
  ctx.fillStyle = upcoming ? '#73d5ff' : active ? palette.green : palette.red
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

  const blink = view.reduced || Math.sin(view.time * blinkRate) > -0.2
  const lampSize = Math.max(2, post * 0.5)
  ctx.fillStyle = upcoming ? '#73d5ff' : active ? palette.green : blink ? palette.red : palette.redDark
  ctx.fillRect(xLeft + post * 0.24, top + gateHeight * 0.06, lampSize, lampSize)
  ctx.fillRect(xRight - post * 0.24 - lampSize, top + gateHeight * 0.06, lampSize, lampSize)

  const signWidth = span * 0.82
  const signHeight = Math.max(9, gateHeight * 0.22)
  const signCenter = (xLeft + xRight) / 2
  const signX = signCenter - signWidth / 2
  const signY = top - signHeight * 0.55
  ctx.fillStyle = palette.steelDark
  ctx.fillRect(signX - 2, signY - 2, signWidth + 4, signHeight + 4)
  ctx.fillStyle = palette.sign
  ctx.fillRect(signX, signY, signWidth, signHeight)
  ctx.strokeStyle = upcoming ? '#346785' : active ? palette.greenDark : palette.redDark
  ctx.lineWidth = 2
  ctx.strokeRect(signX + 1, signY + 1, signWidth - 2, signHeight - 2)
  ctx.fillStyle = upcoming ? '#73d5ff' : active ? palette.green : palette.red
  ctx.font = `bold ${Math.max(7, Math.round(signHeight * 0.58))}px "IBM Plex Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(upcoming ? `GATE ${String(gateNumber).padStart(2, '0')}` : active ? 'TRUE' : 'FALSE', signCenter, signY + signHeight * 0.4)
  if (signHeight > 14) {
    ctx.font = `bold ${Math.max(5, Math.round(signHeight * 0.2))}px "IBM Plex Mono", monospace`
    ctx.fillStyle = upcoming ? '#b9eaff' : active ? '#a9ffc5' : '#ffb3b9'
    ctx.fillText(upcoming ? 'CHALLENGE AHEAD' : active ? 'Gate opening...' : 'Condition not met.', signCenter, signY + signHeight * 0.75)
  }
  if (detailed) {
    ctx.fillStyle = '#8a97ad'
    ctx.font = `bold ${Math.max(5, Math.round(gateHeight * 0.07))}px "IBM Plex Mono", monospace`
    ctx.fillText(String(gateNumber).padStart(2, '0'), xLeft + post * 0.5, top + beam * 0.65)
  }
}

function drawGate(ctx: CanvasRenderingContext2D, view: BackroomView, p: Projector) {
  const distance = view.gateZ - view.depth
  const blinkRate = 6 + view.falseIntensity * 9
  if (view.phase === 'turn') {
    const lastBend = view.bends.at(-1)
    const nextDistance = view.nextGateZ - view.depth
    if (lastBend && view.depth >= lastBend.endZ - 3 && nextDistance > 0) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, (view.depth - lastBend.endZ + 3) / 3)
      drawGateStructure(ctx, p, view, nextDistance, view.nextGateCenter, view.gateNumber + 1, false, 0, true, blinkRate, true)
      ctx.restore()
    }
    return
  }
  if (distance <= 0.1) return
  const gateCenter = view.gateCenter

  const signDistance = distance - 4
  if (signDistance > 2.4) {
    const sp = project(p, signDistance, gateCenter)
    const wallSignSize = Math.max(7, (sp.floor - sp.ceiling) * 0.16)
    drawWallSign(ctx, p, view, 'left', signDistance, wallSignSize, `GATE ${String(view.gateNumber).padStart(2, '0')}`)
  }

  drawGateStructure(ctx, p, view, distance, gateCenter, view.gateNumber, view.conditionTrue, view.openAmount, true, blinkRate)

  if (view.falseIntensity > 0.05 && !view.conditionTrue) {
    const proj = project(p, distance, gateCenter)
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
  if (view.phase !== 'gate' || view.gateZ <= view.depth) return
  const distance = Math.max(view.gateZ - view.depth, 0.4)
  const proj = project(p, distance, view.gateCenter)
  const radius = Math.max(8, Math.min(width * 0.42, (proj.right - proj.left) * 0.65))
  const gradient = ctx.createRadialGradient((proj.left + proj.right) / 2, proj.floor, 1, (proj.left + proj.right) / 2, proj.floor, radius)
  const active = view.conditionTrue
  gradient.addColorStop(0, active ? 'rgba(92,232,127,.33)' : 'rgba(255,85,96,.12)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, p.horizon, width, height - p.horizon)
}

export function drawBackroom(ctx: CanvasRenderingContext2D, width: number, height: number, view: BackroomView) {
  const p = makeProjector(width, height, view.playerX)
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
  drawFloorGlow(ctx, width, height, view, p)
  drawObstacles(ctx, p, view)
  drawGate(ctx, view, p)
  if (view.falseIntensity > 0.02) {
    const rate = 5 + view.falseIntensity * 14
    const pulse = view.reduced ? 0.6 : (Math.sin(view.time * rate) > 0 ? 1 : 0.3)
    ctx.fillStyle = `rgba(255,42,56,${Math.min(0.34, view.falseIntensity * 0.3 * pulse)})`
    ctx.fillRect(0, 0, width, height)
    const gradient = ctx.createRadialGradient(width / 2, height * 0.46, height * 0.18, width / 2, height * 0.46, width * 0.62)
    gradient.addColorStop(0, 'rgba(255,60,72,0)')
    gradient.addColorStop(1, `rgba(255,52,66,${Math.min(0.34, view.falseIntensity * 0.4 * pulse)})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
  // Retain a little ambient visibility even with every fluorescent switched off.
  // This shades the corridor, obstacles and gate together; the HUD stays readable.
  ctx.fillStyle = `rgba(0,0,0,${(1 - (view.reduced ? 1 : view.roomLight)) * 0.94})`
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
