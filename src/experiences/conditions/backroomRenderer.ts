export interface BackroomView {
  depth: number
  gateZ: number
  currentCenter: number
  nextCenter: number
  boundaryZ: number
  playerX: number
  openAmount: number
  conditionTrue: boolean
  falseIntensity: number
  time: number
  gateNumber: number
  seed: number
  reduced: boolean
  shake: number
}

const palette = {
  ceiling: '#f0e7c6',
  ceilingAlt: '#e7dcb4',
  ceilingLine: '#c3b184',
  light: '#fffdf0',
  lightGlow: '#fff3b8',
  floor: '#dcc478',
  floorAlt: '#d0b76a',
  floorLine: '#a68d40',
  wall: '#e5cb6d',
  wallAlt: '#d8bd60',
  wallMotif: '#c9ac4a',
  wallLine: '#8f7729',
  wainscot: '#c2a94f',
  outline: '#2b2513',
  steel: '#525d70',
  steelDark: '#242b38',
  steelLight: '#77839a',
  hazard: '#e0892f',
  green: '#5ce87f',
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
  return { focal: width * 0.86, cx: width / 2, horizon: height * 0.44, half: 0.62, eye: 0.5, playerX }
}

function project(p: Projector, distance: number, center: number) {
  const d = Math.max(distance, 0.06)
  return {
    left: p.cx + ((center - p.half - p.playerX) * p.focal) / d,
    right: p.cx + ((center + p.half - p.playerX) * p.focal) / d,
    floor: p.horizon + (p.focal * p.eye) / d,
    ceiling: p.horizon - (p.focal * (1 - p.eye)) / d,
  }
}

function wallY(p: Projector, distance: number, v: number) {
  return p.horizon - (p.focal * (v - p.eye)) / Math.max(distance, 0.06)
}

function hashTile(index: number, seed: number): number {
  const value = Math.imul(index + 1, 2654435761) ^ Math.imul(seed + 7, 40503)
  return (value >>> 0) % 1000
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

export const BEND_LENGTH = 9

export function corridorCenterAt(currentCenter: number, nextCenter: number, boundaryZ: number, worldZ: number): number {
  const start = boundaryZ - BEND_LENGTH
  const t = (worldZ - start) / (BEND_LENGTH * 2)
  if (t <= 0) return currentCenter
  if (t >= 1) return nextCenter
  const smooth = t * t * (3 - 2 * t)
  return currentCenter + (nextCenter - currentCenter) * smooth
}

function centerAt(view: BackroomView, worldZ: number): number {
  return corridorCenterAt(view.currentCenter, view.nextCenter, view.boundaryZ, worldZ)
}

function wallX(p: Projector, view: BackroomView, side: 'left' | 'right', worldZ: number): number {
  const distance = Math.max(worldZ - view.depth, 0.06)
  const center = centerAt(view, worldZ)
  return p.cx + ((center + (side === 'left' ? -p.half : p.half) - p.playerX) * p.focal) / distance
}

function centerX(p: Projector, view: BackroomView, distance: number): number {
  const d = Math.max(distance, 0.06)
  return p.cx + ((centerAt(view, view.depth + distance) - p.playerX) * p.focal) / d
}

function drawWallpaper(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, side: 'left' | 'right', zNear: number, zFar: number, index: number) {
  const xAt = (worldZ: number) => wallX(p, view, side, worldZ)
  const zAt = (u: number) => zNear + (zFar - zNear) * u
  const yAt = (worldZ: number, v: number) => wallY(p, worldZ - view.depth, v)
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      const u0 = col / 4 + 0.03
      const u1 = (col + 1) / 4 - 0.03
      const v0 = 0.16 + row * 0.27
      const v1 = v0 + 0.2
      const z0 = zAt(u0)
      const z1 = zAt(u1)
      if (z0 - view.depth < 0.3) continue
      quad(ctx,
        { x: xAt(z0), y: yAt(z0, v0) },
        { x: xAt(z1), y: yAt(z1, v0) },
        { x: xAt(z1), y: yAt(z1, v1) },
        { x: xAt(z0), y: yAt(z0, v1) },
        palette.wallMotif,
        'rgba(122,96,28,.4)',
      )
    }
  }
  const z0 = zAt(0)
  const z1 = zAt(1)
  if (z0 - view.depth > 0.3) {
    quad(ctx,
      { x: xAt(z0), y: yAt(z0, 0) },
      { x: xAt(z1), y: yAt(z1, 0) },
      { x: xAt(z1), y: yAt(z1, 0.11) },
      { x: xAt(z0), y: yAt(z0, 0.11) },
      palette.wainscot,
      'rgba(122,96,28,.45)',
    )
    ctx.globalAlpha = 0.5
    quad(ctx,
      { x: xAt(z0), y: yAt(z0, 0.5) },
      { x: xAt(z1), y: yAt(z1, 0.5) },
      { x: xAt(z1), y: yAt(z1, 0.52) },
      { x: xAt(z0), y: yAt(z0, 0.52) },
      palette.wallLine,
    )
    ctx.globalAlpha = 1
  }
  if (hashTile(index, view.seed) % 7 === 0 && z0 - view.depth > 0.3) {
    ctx.globalAlpha = 0.26
    quad(ctx,
      { x: xAt(z0), y: yAt(z0, 0.2) },
      { x: xAt(z1), y: yAt(z1, 0.2) },
      { x: xAt(z1), y: yAt(z1, 0.8) },
      { x: xAt(z0), y: yAt(z0, 0.8) },
      palette.wainscot,
    )
    ctx.globalAlpha = 1
  }
}

function drawTurnSign(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView) {
  const direction = Math.sign(view.nextCenter - view.currentCenter)
  if (direction === 0) return
  const signZ = view.boundaryZ - BEND_LENGTH - 1.4
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
  ctx.fillStyle = palette.ceiling
  ctx.fillRect(0, 0, width, p.horizon)
  ctx.fillStyle = palette.floor
  ctx.fillRect(0, p.horizon, width, height - p.horizon)

  const near = 0.28
  const far = 26
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

    const fade = Math.max(0.06, Math.min(0.6, 16 / Math.max(farDistance, 1)))
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

    if (index % 2 === 1 && size > 10) {
      const lightZ0 = Math.max(nearDistance, 0.9)
      const lightZ1 = farDistance
      if (lightZ1 > lightZ0 + 0.12) {
        const cx0 = centerX(p, view, lightZ0)
        const cx1 = centerX(p, view, lightZ1)
        const half0 = Math.min((0.17 * p.focal) / lightZ0, width * 0.3)
        const half1 = Math.min((0.17 * p.focal) / lightZ1, width * 0.3)
        ctx.globalAlpha = 0.5
        quad(ctx,
          { x: cx1 - half1 - 1.5, y: wallY(p, lightZ1, 1) },
          { x: cx1 + half1 + 1.5, y: wallY(p, lightZ1, 1) },
          { x: cx0 + half0 + 1.5, y: wallY(p, lightZ0, 1) },
          { x: cx0 - half0 - 1.5, y: wallY(p, lightZ0, 1) },
          palette.lightGlow,
        )
        ctx.globalAlpha = 1
        quad(ctx,
          { x: cx0 - half0, y: wallY(p, lightZ0, 1) + 0.5 },
          { x: cx0 + half0, y: wallY(p, lightZ0, 1) + 0.5 },
          { x: cx1 + half1, y: wallY(p, lightZ1, 1) + 0.5 },
          { x: cx1 - half1, y: wallY(p, lightZ1, 1) + 0.5 },
          palette.light,
          'rgba(122,96,28,.5)',
        )
      }
    }
  }

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(p.cx, p.horizon)
  ctx.lineTo(0, height)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.clip()
  ctx.globalAlpha = 0.2
  ctx.strokeStyle = palette.floorLine
  ctx.lineWidth = 1
  for (let k = -3; k <= 3; k += 1) {
    ctx.beginPath()
    ctx.moveTo(p.cx, p.horizon)
    ctx.lineTo(p.cx + k * width * 0.24, height)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawGateStructure(ctx: CanvasRenderingContext2D, p: Projector, view: BackroomView, distance: number, center: number, gateNumber: number, active: boolean, open: number, detailed: boolean, blinkRate: number) {
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
  glow.addColorStop(0, active ? 'rgba(92,232,127,.55)' : 'rgba(255,85,96,.3)')
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
  ctx.fillStyle = active ? palette.green : palette.red
  ctx.fillRect(innerLeft - stripWidth * 1.1, stripY, stripWidth, stripHeight)
  ctx.fillRect(innerRight + stripWidth * 0.1, stripY, stripWidth, stripHeight)

  const hazardHeight = Math.max(2, gateHeight * 0.16)
  ctx.fillStyle = palette.hazard
  ctx.fillRect(xLeft, proj.floor - hazardHeight, post, hazardHeight)
  ctx.fillRect(xRight - post, proj.floor - hazardHeight, post, hazardHeight)
  ctx.fillStyle = palette.steelDark
  for (let x = xLeft; x < xLeft + post; x += Math.max(3, post * 0.5)) ctx.fillRect(x, proj.floor - hazardHeight, Math.max(1.5, post * 0.22), hazardHeight)
  for (let x = xRight - post; x < xRight; x += Math.max(3, post * 0.5)) ctx.fillRect(x, proj.floor - hazardHeight, Math.max(1.5, post * 0.22), hazardHeight)

  const blink = view.reduced || Math.sin(view.time * blinkRate) > -0.2
  const lampSize = Math.max(2, post * 0.5)
  ctx.fillStyle = active ? palette.green : blink ? palette.red : palette.redDark
  ctx.fillRect(xLeft + post * 0.24, top + gateHeight * 0.06, lampSize, lampSize)
  ctx.fillRect(xRight - post * 0.24 - lampSize, top + gateHeight * 0.06, lampSize, lampSize)

  const signWidth = span * 0.82
  const signHeight = Math.max(9, gateHeight * 0.22)
  const signX = p.cx - signWidth / 2
  const signY = top - signHeight * 1.06
  ctx.fillStyle = palette.steelDark
  ctx.fillRect(signX - 2, signY - 2, signWidth + 4, signHeight + 4)
  ctx.fillStyle = palette.sign
  ctx.fillRect(signX, signY, signWidth, signHeight)
  ctx.strokeStyle = active ? palette.greenDark : palette.redDark
  ctx.lineWidth = 2
  ctx.strokeRect(signX + 1, signY + 1, signWidth - 2, signHeight - 2)
  ctx.fillStyle = active ? palette.green : palette.red
  ctx.font = `bold ${Math.max(7, Math.round(signHeight * 0.58))}px "IBM Plex Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(active ? 'TRUE' : 'FALSE', p.cx, signY + signHeight * 0.4)
  if (signHeight > 14) {
    ctx.font = `bold ${Math.max(5, Math.round(signHeight * 0.2))}px "IBM Plex Mono", monospace`
    ctx.fillStyle = active ? '#a9ffc5' : '#ffb3b9'
    ctx.fillText(active ? 'Gate opening...' : 'Condition not met.', p.cx, signY + signHeight * 0.75)
  }
  if (detailed) {
    ctx.fillStyle = '#8a97ad'
    ctx.font = `bold ${Math.max(5, Math.round(gateHeight * 0.07))}px "IBM Plex Mono", monospace`
    ctx.fillText(String(gateNumber).padStart(2, '0'), p.cx, top + beam * 0.5)
  }
}

function drawGate(ctx: CanvasRenderingContext2D, view: BackroomView, p: Projector) {
  const distance = view.gateZ - view.depth
  if (distance <= 0.1) return
  const blinkRate = 6 + view.falseIntensity * 9
  const gateCenter = centerAt(view, view.gateZ)

  drawGateStructure(ctx, p, view, distance + 10, centerAt(view, view.gateZ + 10), view.gateNumber + 1, true, 1, false, blinkRate)
  drawGateStructure(ctx, p, view, distance + 19, centerAt(view, view.gateZ + 19), view.gateNumber + 2, true, 1, false, blinkRate)

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
  const left = side === 'left' ? x : x - size
  ctx.fillStyle = 'rgba(40,34,14,.2)'
  ctx.fillRect(left + 1, y + 1, size, size * 0.5)
  ctx.fillStyle = 'rgba(58,48,18,.85)'
  ctx.font = `bold ${Math.max(6, Math.round(size * 0.3))}px "IBM Plex Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + size / 2, y + size * 0.16)
  if (size > 14) ctx.fillText('→', left + size / 2, y + size * 0.4)
}

function drawFloorGlow(ctx: CanvasRenderingContext2D, width: number, height: number, view: BackroomView, p: Projector) {
  const distance = Math.max(view.gateZ - view.depth, 0.4)
  const proj = project(p, distance, centerAt(view, view.gateZ))
  const radius = Math.max(8, (proj.right - proj.left) * 0.9)
  const gradient = ctx.createRadialGradient((proj.left + proj.right) / 2, proj.floor, 1, (proj.left + proj.right) / 2, proj.floor, radius)
  const active = view.conditionTrue
  gradient.addColorStop(0, active ? 'rgba(92,232,127,.5)' : 'rgba(255,85,96,.14)')
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
  ctx.restore()
}
