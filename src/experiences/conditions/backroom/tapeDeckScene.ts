import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { tapeTimeline, type TapeCue, type TapeLabel } from './tapeTimeline'

// A Hi8 camcorder on a table: the door opens, the tape goes in, the camera dives into the lens.
// Body: x runs lens (−) to eyepiece (+), the tape door faces +z.

export interface TapeDeckHandle {
  dispose(): void
}

const HAND = '"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive'
const PRINT = '"Helvetica Neue", Arial, sans-serif'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from))
const easeOut = (x: number) => 1 - (1 - x) ** 3
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const easeIn = (x: number) => x * x * x

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, color = true) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Brushed aluminium: fine horizontal streaks for the bump and roughness maps.
function brushed() {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, 512, 512)
    for (let y = 0; y < 512; y += 1) {
      const shade = 110 + Math.random() * 40
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.35 + Math.random() * 0.4})`
      ctx.fillRect(0, y, 512, 1)
    }
  }, false)
}

function brandPlate() {
  return canvasTexture(1024, 1024, (ctx) => {
    ctx.clearRect(0, 0, 1024, 1024)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(40,42,46,.9)'
    ctx.font = `italic 700 92px ${PRINT}`
    ctx.fillText('PIXPY', 70, 250)
    ctx.font = `600 38px ${PRINT}`
    ctx.fillStyle = 'rgba(40,42,46,.75)'
    ctx.fillText('VIDEO CAMERA RECORDER', 74, 310)
    // The blue "COLOR LCD" sticker and the red-yellow zoom sticker from a shop shelf.
    ctx.save()
    ctx.translate(560, 470)
    ctx.rotate(-0.04)
    roundRect(ctx, 0, 0, 330, 200, 18)
    ctx.fillStyle = '#f4f4f2'
    ctx.fill()
    ctx.fillStyle = '#1d4fd8'
    roundRect(ctx, 14, 14, 302, 172, 12)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `800 54px ${PRINT}`
    ctx.fillText('COLOR', 50, 82)
    ctx.font = `800 44px ${PRINT}`
    ctx.fillText('LCD Monitor', 36, 146)
    ctx.restore()
    ctx.save()
    ctx.translate(80, 430)
    ctx.rotate(0.03)
    ctx.fillStyle = '#ffd400'
    ctx.fillRect(0, 0, 400, 110)
    ctx.fillStyle = '#e3122b'
    ctx.fillRect(0, 110, 400, 70)
    ctx.fillStyle = '#111'
    ctx.font = `900 64px ${PRINT}`
    ctx.fillText('20× ZOOM', 26, 80)
    ctx.fillStyle = '#fff'
    ctx.font = `800 40px ${PRINT}`
    ctx.fillText('NIGHTSHOT', 26, 160)
    ctx.restore()
    ctx.fillStyle = 'rgba(40,42,46,.8)'
    ctx.font = `700 58px ${PRINT}`
    ctx.fillText('Hi8', 74, 860)
    ctx.font = `500 30px ${PRINT}`
    ctx.fillText('XR · STEADYSHOT', 190, 858)
  })
}

function doorPlate() {
  return canvasTexture(1024, 680, (ctx) => {
    ctx.clearRect(0, 0, 1024, 680)
    ctx.strokeStyle = 'rgba(30,32,36,.35)'
    ctx.lineWidth = 3
    for (let x = 80; x < 960; x += 22) {
      ctx.beginPath()
      ctx.moveTo(x, 560)
      ctx.lineTo(x, 620)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(30,32,36,.82)'
    ctx.font = `italic 800 120px ${PRINT}`
    ctx.fillText('Hi8', 80, 190)
    ctx.font = `600 40px ${PRINT}`
    ctx.fillText('VIDEO', 330, 150)
    ctx.fillText('Hi8 XR', 330, 196)
    ctx.font = `700 46px ${PRINT}`
    ctx.fillText('⏏ OPEN / EJECT', 80, 480)
  })
}

function cassetteFace(label: TapeLabel, size = 1024, flatReels = false) {
  return canvasTexture(size, size * 0.625, (ctx) => {
    ctx.scale(size / 1024, size / 1024)
    // Black plastic with a smoked window cut out, then the paper label.
    ctx.fillStyle = '#121214'
    ctx.fillRect(0, 0, 1024, 640)
    ctx.fillStyle = 'rgba(255,255,255,.035)'
    for (let y = 0; y < 640; y += 4) ctx.fillRect(0, y, 1024, 1)
    if (flatReels) {
      ctx.fillStyle = '#2a221b'
      ctx.fillRect(190, 70, 644, 210)
      for (const [cx, radius] of [[355, 92], [670, 58]]) {
        ctx.fillStyle = '#2b1c12'
        ctx.beginPath()
        ctx.arc(cx, 175, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e8e2d2'
        ctx.beginPath()
        ctx.arc(cx, 175, 30, 0, Math.PI * 2)
        ctx.fill()
      }
    } else ctx.clearRect(190, 70, 644, 210)
    ctx.fillStyle = '#d9c38a'
    ctx.font = `italic 800 64px ${PRINT}`
    ctx.fillText('Hi8', 40, 70)
    ctx.fillStyle = '#c9c9c9'
    ctx.font = `600 30px ${PRINT}`
    ctx.fillText('MP 90', 880, 60)
    ctx.fillText('◀', 120, 190)
    ctx.fillText('▶', 870, 190)

    const x = 70
    const y = 320
    ctx.fillStyle = label.locked ? '#8f8a7c' : '#e2d6b4'
    roundRect(ctx, x, y, 884, 290, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(120,150,190,.45)'
    ctx.lineWidth = 2
    for (let line = y + 120; line < y + 280; line += 46) {
      ctx.beginPath()
      ctx.moveTo(x + 24, line)
      ctx.lineTo(x + 860, line)
      ctx.stroke()
    }
    if (label.locked) {
      // A locked tape: no title yet, only its number.
      ctx.fillStyle = '#5c584d'
      ctx.fillRect(x, y, 884, 54)
      ctx.fillStyle = '#e9e4d6'
      ctx.font = `800 32px ${PRINT}`
      ctx.fillText(label.deep ? 'THE DEEP' : `TAPE ${label.number}`, x + 24, y + 38)
      ctx.fillStyle = '#3f3c35'
      ctx.font = `700 92px ${HAND}`
      ctx.fillText('? ? ?', x + 28, y + 170)
      return
    }
    ctx.fillStyle = label.deep ? '#c4161c' : '#d0161f'
    ctx.fillRect(x, y, 884, 54)
    ctx.fillStyle = '#fff'
    ctx.font = `800 32px ${PRINT}`
    ctx.fillText(label.deep ? 'DO NOT PLAY' : 'LEVEL 0 · FOUND FOOTAGE', x + 24, y + 38)
    ctx.textAlign = 'right'
    ctx.fillText(label.deep ? 'ENDLESS' : `TAPE ${label.number}`, x + 860, y + 38)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1b2a6b'
    ctx.font = `700 92px ${HAND}`
    ctx.fillText(label.title, x + 28, y + 160, 830)
    ctx.font = `600 44px ${HAND}`
    ctx.fillText(label.focus, x + 30, y + 250)
    if (!label.deep) {
      ctx.font = `48px ${PRINT}`
      ctx.textAlign = 'right'
      ctx.fillStyle = '#d99b00'
      ctx.fillText('★'.repeat(label.stars) + '☆'.repeat(3 - label.stars), x + 856, y + 252)
    }
  })
}

export function createTapeDeckScene(canvas: HTMLCanvasElement, label: TapeLabel, shelfLabels: TapeLabel[], slot: number, onCue: (cue: TapeCue) => void, onDone: () => void, onReady: () => void): TapeDeckHandle | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.88
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0906)
  scene.fog = new THREE.Fog(0x0b0906, 10, 24)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.6

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60)
  const textures: THREE.Texture[] = []
  const keep = <T extends THREE.Texture>(texture: T) => { textures.push(texture); return texture }

  // Light: a warm overhead fluorescent, a cool rim and a soft fill.
  const key = new THREE.SpotLight(0xffe0a8, 95, 30, 0.6, 0.6, 2)
  key.position.set(2.5, 6.5, 5)
  key.target.position.set(0, -0.4, 0)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0004
  key.shadow.radius = 6
  scene.add(key, key.target)
  const rim = new THREE.DirectionalLight(0x9db8ff, 1.6)
  rim.position.set(-5, 3, -4)
  scene.add(rim)
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x16110a, 0.45))

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x2a2116, roughness: 0.92 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.95
  ground.receiveShadow = true
  scene.add(ground)

  const brush = keep(brushed())
  brush.wrapS = brush.wrapT = THREE.RepeatWrapping
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xaeb2b8, metalness: 0.8, roughness: 0.34, roughnessMap: brush, bumpMap: brush, bumpScale: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.3 })
  const silverDark = new THREE.MeshPhysicalMaterial({ color: 0x8d9198, metalness: 0.75, roughness: 0.35, roughnessMap: brush, clearcoat: 0.3 })
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, metalness: 0.25 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.95 })
  const cavity = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, metalness: 0.3, roughness: 0.03, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.7, envMapIntensity: 1.6 })
  const led = new THREE.MeshStandardMaterial({ color: 0x220404, emissive: 0xff2a2a, emissiveIntensity: 0.6 })

  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const box = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
  const decal = (parent: THREE.Object3D, texture: THREE.Texture, w: number, h: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: keep(texture), transparent: true, roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }))
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  const cam = new THREE.Group()
  scene.add(cam)
  // Body: a core with a front shell built around the tape bay, so the bay is a real recess.
  add(cam, box(3.4, 1.6, 0.9, 0.14), silver, 0, 0, -0.25)
  add(cam, box(1.35, 1.6, 0.55, 0.1), silver, -1.025, 0, 0.425)
  add(cam, box(0.25, 1.6, 0.55, 0.03), silver, 1.575, 0, 0.425)
  add(cam, box(1.8, 0.2, 0.55, 0.02), silver, 0.55, 0.7, 0.425)
  add(cam, box(1.8, 0.25, 0.55, 0.02), silver, 0.55, -0.675, 0.425)
  add(cam, new THREE.PlaneGeometry(1.8, 1.15), cavity, 0.55, 0.025, 0.205)
  add(cam, new THREE.BoxGeometry(1.8, 0.012, 0.5), cavity, 0.55, 0.594, 0.44)
  add(cam, new THREE.BoxGeometry(1.8, 0.012, 0.5), cavity, 0.55, -0.544, 0.44)
  add(cam, new THREE.BoxGeometry(0.012, 1.15, 0.5), cavity, -0.344, 0.025, 0.44)
  add(cam, new THREE.BoxGeometry(0.012, 1.15, 0.5), cavity, 1.444, 0.025, 0.44)
  // The transport inside the bay: head drum and two spindles.
  const drum = add(cam, new THREE.CylinderGeometry(0.26, 0.26, 0.1, 40), silverDark, 0.55, 0.32, 0.25)
  drum.rotation.x = Math.PI / 2
  for (const x of [0.17, 0.93]) add(cam, new THREE.CylinderGeometry(0.07, 0.07, 0.12, 20), silverDark, x, 0.1, 0.25).rotation.x = Math.PI / 2
  add(cam, box(3.36, 0.3, 1.44, 0.1), black, 0, -0.8, 0)
  add(cam, box(2.4, 0.22, 0.6, 0.08), silverDark, 0.2, 0.92, -0.1)
  decal(cam, brandPlate(), 1.3, 1.3, -1.025, 0.02, 0.703)

  // Lens: barrel, focus ring, coated glass and the NightShot lamp above it.
  const lens = new THREE.Group()
  lens.position.set(-1.7, 0.05, 0)
  cam.add(lens)
  const turn = (mesh: THREE.Mesh) => { mesh.rotation.z = Math.PI / 2; return mesh }
  turn(add(lens, new THREE.CylinderGeometry(0.62, 0.66, 0.5, 64), silver, -0.25, 0, 0))
  turn(add(lens, new THREE.CylinderGeometry(0.64, 0.64, 0.26, 64), black, -0.58, 0, 0))
  turn(add(lens, new THREE.CylinderGeometry(0.58, 0.6, 0.1, 64), rubber, -0.74, 0, 0))
  const glassDisc = turn(add(lens, new THREE.CylinderGeometry(0.47, 0.47, 0.04, 64), glass, -0.77, 0, 0))
  glassDisc.castShadow = false
  const inner = add(lens, new THREE.SphereGeometry(0.36, 48, 24), glass, -0.66, 0, 0)
  inner.scale.set(0.3, 1, 1)
  const lamp = turn(add(cam, new THREE.CylinderGeometry(0.13, 0.13, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0xdfe6ea, emissive: 0x9fb4c8, emissiveIntensity: 0.3, roughness: 0.2 }), -1.82, 0.72, 0.32))
  lamp.castShadow = false

  // Eyepiece and its rubber cup.
  turn(add(cam, new THREE.CylinderGeometry(0.26, 0.26, 1.0, 40), black, 1.95, 0.78, -0.3))
  turn(add(cam, new THREE.CylinderGeometry(0.34, 0.3, 0.32, 40), rubber, 2.55, 0.78, -0.3))
  add(cam, new THREE.SphereGeometry(0.05, 20, 12), led, -1.3, 0.62, 0.705)

  // The door hinges on the bay's bottom edge and swings toward the viewer.
  const hinge = new THREE.Group()
  hinge.position.set(0.55, -0.56, 0.71)
  cam.add(hinge)
  add(hinge, box(1.84, 1.18, 0.07, 0.03), silver, 0, 0.59, 0)
  decal(hinge, doorPlate(), 1.72, 1.14, 0, 0.59, 0.037)

  // The cassette: shell, two reels behind a smoked window, and the label on the face.
  const tape = new THREE.Group()
  scene.add(tape)
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x111113, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.15 })
  add(tape, box(1.6, 1.0, 0.18, 0.04), shell, 0, 0, -0.03)
  const reels: THREE.Group[] = []
  for (const [x, wound] of [[-0.39, 0.21], [0.39, 0.12]] as const) {
    const reel = new THREE.Group()
    reel.position.set(x, 0.17, 0.085)
    tape.add(reel)
    const pack = add(reel, new THREE.CylinderGeometry(wound, wound, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x2b1c12, roughness: 0.35, metalness: 0.4 }), 0, 0, 0)
    pack.rotation.x = Math.PI / 2
    const hub = add(reel, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.5 }), 0, 0, 0.005)
    hub.rotation.x = Math.PI / 2
    for (let tooth = 0; tooth < 3; tooth += 1) {
      const spoke = add(reel, new THREE.BoxGeometry(0.03, 0.1, 0.035), black, 0, 0, 0.01)
      spoke.rotation.z = (tooth * Math.PI * 2) / 3
      spoke.translateY(0.04)
    }
    reels.push(reel)
  }
  add(tape, new THREE.PlaneGeometry(1.08, 0.34), new THREE.MeshPhysicalMaterial({ color: 0x3a3028, transparent: true, opacity: 0.28, roughness: 0.08, clearcoat: 1 }), 0, 0.17, 0.118)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: keep(cassetteFace(label)), transparent: true, alphaTest: 0.5, roughness: 0.45 }))
  face.position.z = 0.122
  tape.add(face)
  // Side walls so the gap between shell and face never shows.
  add(tape, new THREE.BoxGeometry(1.6, 0.46, 0.06), shell, 0, -0.27, 0.09)
  add(tape, new THREE.BoxGeometry(1.6, 0.06, 0.06), shell, 0, 0.47, 0.09)
  add(tape, new THREE.BoxGeometry(0.26, 0.4, 0.06), shell, -0.67, 0.17, 0.09)
  add(tape, new THREE.BoxGeometry(0.26, 0.4, 0.06), shell, 0.67, 0.17, 0.09)

  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.7, metalness: 0.05 })
  const rack = new THREE.Group()
  rack.position.set(-6.4, -0.95, -1.6)
  rack.rotation.y = 0.5
  scene.add(rack)
  add(rack, box(4.9, 2.7, 0.12, 0.03), wood, 0, 1.35, -0.06)
  for (const y of [0.05, 0.98, 1.9]) add(rack, box(4.9, 0.08, 0.6, 0.02), wood, 0, y, 0.25)
  for (const x of [-2.45, 2.45]) add(rack, box(0.1, 2.7, 0.62, 0.02), wood, x, 1.35, 0.25)
  const rackLight = new THREE.SpotLight(0xffd9a0, 70, 16, 0.55, 0.6, 2)
  rackLight.position.set(-4.5, 5, 3.2)
  rackLight.target.position.set(-6.2, 0.4, -1.4)
  scene.add(rackLight, rackLight.target)
  // Slots: four on the top row, three below. The chosen tape is the real 3D cassette.
  const slotSpots = [[-1.65, 1.0], [-0.55, 1.0], [0.55, 1.0], [1.65, 1.0], [-1.1, 0.08], [0, 0.08], [1.1, 0.08]]
  const slotLocal = (index: number) => new THREE.Vector3(slotSpots[index][0], slotSpots[index][1] + 0.36, 0.3)
  const shelfScale = 0.66
  shelfLabels.forEach((item, index) => {
    if (index === slot || index >= slotSpots.length) return
    const copy = new THREE.Group()
    add(copy, box(1.6, 1.0, 0.18, 0.04), shell, 0, 0, -0.03)
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: keep(cassetteFace(item, 512, true)), roughness: 0.5 }))
    front.position.z = 0.062
    copy.add(front)
    copy.position.copy(slotLocal(index))
    copy.rotation.x = -0.1
    copy.scale.setScalar(shelfScale)
    rack.add(copy)
  })
  rack.updateMatrixWorld(true)
  const shelfSpot = rack.localToWorld(slotLocal(Math.min(slot, slotSpots.length - 1)))
  const pulledSpot = rack.localToWorld(slotLocal(Math.min(slot, slotSpots.length - 1)).add(new THREE.Vector3(0, 0.15, 0.9)))
  const bayEntry = new THREE.Vector3(0.55, 0.025, 0.36)
  const rackQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.5, 0))
  const flatQuat = new THREE.Quaternion()
  const rackFocus = rack.localToWorld(new THREE.Vector3(-0.3, 1.0, 0.6))
  const rackView = rack.localToWorld(new THREE.Vector3(-0.4, 1.6, 8.4))

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.94)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let aspect = 1
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    aspect = width / height
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  observer?.observe(canvas)

  const target = new THREE.Vector3()
  const lensFront = new THREE.Vector3(-2.47, 0.05, 0)
  const focus = (t: number) => {
    // Narrow screens back the camera off so the whole camcorder stays in frame.
    const fit = aspect < 1.5 ? 1.5 / aspect : 1
    if (t < 2.05) {
      // The shelf, then a pan across to the camcorder as the tape leaves it.
      const k = easeInOut(span(t, 0.85, 2.05))
      const camcorderView = new THREE.Vector3(2.6, 2.5, 9.6)
      target.copy(rackFocus).lerp(new THREE.Vector3(0.35, -0.05, 0.25), k)
      const position = rackView.clone().lerp(camcorderView, k)
      position.sub(target).multiplyScalar(fit).add(target)
      camera.position.copy(position)
    } else if (t < 3.4) {
      const k = easeInOut(span(t, 2.05, 3.4))
      const from = new THREE.Vector3(2.6, 2.5, 9.6)
      const to = new THREE.Vector3(1.0, 1.15, 5.4)
      const position = from.lerp(to, k)
      target.set(0.35 + 0.1 * k, -0.05, 0.25)
      position.sub(target).multiplyScalar(fit).add(target)
      camera.position.copy(position)
    } else if (t < 4.0) {
      // Orbit around to face the lens.
      const k = easeInOut(span(t, 3.4, 4.0))
      const start = Math.atan2(1.0 - 0.45, 5.4 - 0.25)
      const angle = start + (-1.25 - start) * k
      const radius = (5.2 + (3.6 - 5.2) * k) * (1 + (fit - 1) * (1 - k))
      target.set(0.45 + (lensFront.x - 0.45) * k, -0.05 + 0.1 * k, 0.25 * (1 - k))
      camera.position.set(target.x + Math.sin(angle) * radius, 1.15 + (0.25 - 1.15) * k, target.z + Math.cos(angle) * radius)
    } else {
      // Dive into the glass.
      const k = easeIn(span(t, 4.0, 4.45))
      target.copy(lensFront)
      const angle = -1.25 - 0.3 * k
      const radius = 3.6 + (0.25 - 3.6) * k
      camera.position.set(target.x + Math.sin(angle) * radius, 0.25 + (0.06 - 0.25) * k, target.z + Math.cos(angle) * radius)
    }
    camera.lookAt(target)
  }

  // Shaders compile before the clock starts, and a slow frame never skips the show:
  // time advances at most a tenth of a second per frame.
  renderer.compile(scene, camera)
  // Browser checks slow the show down to film it; students always get real time.
  const pace = (window as unknown as { __tapeDeckPace?: number }).__tapeDeckPace ?? 1
  let t = 0
  let last = -1
  let next = 0
  let finished = false
  let frame = 0
  let disposed = false
  const { cues, end } = tapeTimeline.insert
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    if (last < 0) onReady()
    else t += Math.min(0.1, (now - last) / 1000) * pace
    last = now
    while (next < cues.length && t >= cues[next][0]) onCue(cues[next++][1])
    if (t >= end && !finished) { finished = true; onDone() }
    // Finishing hands over to the loading screen, which disposes this scene: draw nothing more.
    if (disposed) return

    const open = t < 2.35 ? easeOut(span(t, 1.15, 1.6)) : 1 - easeInOut(span(t, 2.35, 2.6))
    hinge.rotation.x = open * 1.42
    // Off the shelf: the tape slides out of its slot toward the viewer...
    const pull = easeOut(span(t, 0.45, 1.05))
    // ...arcs across the table, settles into the bay and clicks home.
    const fly = easeInOut(span(t, 1.15, 2.2))
    const seat = easeOut(span(t, 2.2, 2.3))
    if (fly <= 0) {
      tape.position.copy(shelfSpot).lerp(pulledSpot, pull)
      tape.quaternion.copy(rackQuat)
      tape.scale.setScalar(shelfScale + pull * 0.08)
    } else {
      const control = pulledSpot.clone().lerp(bayEntry, 0.5).add(new THREE.Vector3(0, 1.5, 1.6))
      const a = pulledSpot.clone().lerp(control, fly)
      const b = control.clone().lerp(bayEntry, fly)
      tape.position.copy(a.lerp(b, fly))
      tape.position.z -= seat * 0.06
      tape.quaternion.copy(rackQuat).slerp(flatQuat, fly)
      tape.scale.setScalar(shelfScale + 0.08 + (1 - shelfScale - 0.08) * fly)
    }
    const spin = t > 2.85 ? (t - 2.85) * 6 : 0
    reels.forEach((reel, index) => { reel.rotation.z = -spin * (index ? 1.6 : 1) })
    // The latch jolts the body; the LED turns green with the motor.
    const jolt = t > 2.6 && t < 2.85 ? Math.sin((t - 2.6) * 60) * 0.012 * (1 - span(t, 2.6, 2.85)) : 0
    cam.position.y = jolt
    led.emissive.setHex(t > 2.85 ? 0x2bff6a : 0xff2a2a)
    led.emissiveIntensity = t > 2.85 ? 2.6 + Math.sin(t * 9) * 0.8 : 0.6
    drum.rotation.y = t * 8
    focus(t)
    composer.render()
  }
  frame = requestAnimationFrame(loop)

  return {
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry.dispose()
          const material = mesh.material as THREE.Material | THREE.Material[]
          ;(Array.isArray(material) ? material : [material]).forEach((item) => item.dispose())
        }
      })
      textures.forEach((texture) => texture.dispose())
      environment.dispose()
      pmrem.dispose()
      composer.dispose()
      renderer.dispose()
      // Browsers cap live WebGL contexts; free this one now so the corridor keeps its own.
      renderer.forceContextLoss()
    },
  }
}
