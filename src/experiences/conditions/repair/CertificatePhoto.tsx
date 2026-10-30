import { Camera, Download, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

// The student's photo for the Certified Bug Fixer certificate. It stays on this device
// (sessionStorage, like the rest of the session) and is never sent to the classroom cloud.
const photoKey = 'pixpy.repair-photo.v1'

function readPhoto(): string | null {
  try { return sessionStorage.getItem(photoKey) } catch { return null }
}
function writePhoto(value: string | null) {
  try { if (value) sessionStorage.setItem(photoKey, value); else sessionStorage.removeItem(photoKey) } catch { /* private mode */ }
}

/** Crops the middle square of an image or video frame to a 360 px JPEG. */
function squareJpeg(source: CanvasImageSource, width: number, height: number, mirror: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 360
  const ctx = canvas.getContext('2d')!
  const side = Math.min(width, height)
  if (mirror) { ctx.translate(360, 0); ctx.scale(-1, 1) }
  ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 360, 360)
  return canvas.toDataURL('image/jpeg', 0.86)
}

interface Certificate { name: string; bugs: number; machines: number; kinds: Array<{ label: string; count: number; color: string }> }

/** Draws the whole certificate, photo included, and saves it as a PNG. */
function saveCertificate(photo: string | null, info: Certificate) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 850
  const ctx = canvas.getContext('2d')!
  const draw = (image?: HTMLImageElement) => {
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, 1200, 850)
    const glow = ctx.createRadialGradient(600, 0, 0, 600, 0, 700); glow.addColorStop(0, '#fff3c4'); glow.addColorStop(1, '#fffdf600')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1200, 850)
    ctx.strokeStyle = '#17181d'; ctx.lineWidth = 8; ctx.strokeRect(24, 24, 1152, 802)
    ctx.setLineDash([14, 10]); ctx.strokeStyle = '#d6b45a'; ctx.lineWidth = 3; ctx.strokeRect(50, 50, 1100, 750); ctx.setLineDash([])
    const textX = image ? 760 : 600
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7c6a45'; ctx.font = '800 22px "IBM Plex Mono", monospace'; ctx.fillText('PIXPY REPAIR SHOP · OFFICIAL', textX, 170)
    ctx.fillStyle = '#17181d'; ctx.font = '900 66px system-ui, sans-serif'; ctx.fillText('Certified Bug Fixer', textX, 260)
    ctx.fillStyle = '#5a574d'; ctx.font = '500 28px system-ui, sans-serif'; ctx.fillText('awarded to', textX, 320)
    ctx.fillStyle = '#17181d'; ctx.font = '900 54px system-ui, sans-serif'; ctx.fillText(info.name, textX, 385, image ? 700 : 1000)
    ctx.fillStyle = '#5a574d'; ctx.font = '500 26px system-ui, sans-serif'
    ctx.fillText(`for fixing ${info.bugs} bugs in ${info.machines} machines`, textX, 440)
    info.kinds.forEach((kind, i) => {
      const x = textX - 230 + i * 230
      ctx.strokeStyle = kind.color; ctx.lineWidth = 4; ctx.strokeRect(x - 95, 490, 190, 110)
      ctx.fillStyle = kind.color; ctx.font = '900 52px system-ui, sans-serif'; ctx.fillText(String(kind.count), x, 560)
      ctx.font = '800 18px "IBM Plex Mono", monospace'; ctx.fillText(kind.label, x, 588)
    })
    ctx.fillStyle = '#8a8576'; ctx.font = '600 20px "IBM Plex Mono", monospace'
    ctx.fillText(new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), textX, 700)
    if (image) {
      ctx.save(); ctx.translate(250, 420); ctx.rotate(-0.05)
      ctx.fillStyle = '#00000022'; ctx.fillRect(-170, -200, 350, 420)
      ctx.fillStyle = '#fff'; ctx.fillRect(-180, -210, 350, 420)
      ctx.strokeStyle = '#17181d'; ctx.lineWidth = 4; ctx.strokeRect(-180, -210, 350, 420)
      ctx.drawImage(image, -160, -190, 310, 310)
      ctx.fillStyle = '#17181d'; ctx.font = '900 30px system-ui, sans-serif'; ctx.fillText('BUG FIXER', -5, 170)
      ctx.restore()
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `bug-fixer-certificate-${info.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'student'}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000)
    }, 'image/png')
  }
  if (!photo) { draw(); return }
  const image = new Image()
  image.onload = () => draw(image)
  image.src = photo
}

/** The photo corner of the certificate: an invitation, the camera, the polaroid, and a save button. */
export function CertificatePhoto({ certificate }: { certificate: Certificate }) {
  const [photo, setPhoto] = useState<string | null>(readPhoto)
  const [camera, setCamera] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const keep = (value: string | null) => { setPhoto(value); writePhoto(value) }
  const canStream = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  // No live camera (or it was refused): the file picker opens the device camera on tablets.
  const openCamera = () => { if (canStream) setCamera(true); else fileRef.current?.click() }
  const fromFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const image = new Image()
    image.onload = () => { keep(squareJpeg(image, image.naturalWidth, image.naturalHeight, false)); URL.revokeObjectURL(image.src) }
    image.src = URL.createObjectURL(file)
    event.target.value = ''
  }

  return <div className={`rs-photo ${photo ? 'has-photo' : ''}`}>
    {photo
      ? <figure className="rs-photo__polaroid"><img src={photo} alt="Your photo on the certificate" /><figcaption>{certificate.name}</figcaption></figure>
      : <button className="rs-photo__invite" onClick={openCamera}>
        <span className="rs-photo__lens"><Camera size={30} /></span>
        <b>Add your photo!</b>
        <small>Take a picture to put on your certificate</small>
      </button>}
    <div className="rs-photo__actions">
      {photo && <button className="rs-secondary" onClick={openCamera}><RotateCcw size={15} /> RETAKE</button>}
      <button className="rs-primary" onClick={() => saveCertificate(photo, certificate)}><Download size={15} /> SAVE CERTIFICATE</button>
    </div>
    <input ref={fileRef} className="sr-only" type="file" accept="image/*" capture="user" onChange={fromFile} aria-label="Choose a photo" tabIndex={-1} />
    {camera && <CameraBooth onCancel={() => setCamera(false)} onFallback={() => { setCamera(false); fileRef.current?.click() }} onShot={(value) => { keep(value); setCamera(false) }} />}
  </div>
}

/** A live camera preview with a 3-2-1 countdown and a flash. */
function CameraBooth({ onShot, onCancel, onFallback }: { onShot: (photo: string) => void; onCancel: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'starting' | 'ready' | 'denied'>('starting')
  const [count, setCount] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((media) => {
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return }
        stream.current = media
        if (video.current) { video.current.srcObject = media; void video.current.play() }
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('denied') })
    return () => { cancelled = true; stream.current?.getTracks().forEach((track) => track.stop()) }
  }, [])

  useEffect(() => {
    if (count === null) return
    if (count > 0) { const timer = window.setTimeout(() => setCount(count - 1), 800); return () => window.clearTimeout(timer) }
    const frame = video.current
    if (frame) { setFlash(true); onShot(squareJpeg(frame, frame.videoWidth, frame.videoHeight, true)) }
  }, [count, onShot])

  return <div className="rs-booth-backdrop" role="dialog" aria-modal="true" aria-label="Take your certificate photo">
    <div className="rs-booth">
      <button className="rs-booth__close" onClick={onCancel} aria-label="Close the camera"><X size={18} /></button>
      <div className="rs-booth__view">
        <video ref={video} playsInline muted />
        <span className="rs-booth__frame" aria-hidden="true" />
        {count !== null && count > 0 && <span key={count} className="rs-booth__count">{count}</span>}
        {flash && <span className="rs-booth__flash" aria-hidden="true" />}
        {state === 'starting' && <p className="rs-booth__note">Starting the camera…</p>}
        {state === 'denied' && <p className="rs-booth__note">The camera is not available. You can choose a photo instead.</p>}
      </div>
      <p className="rs-booth__tip">Smile! Fit your face inside the frame.</p>
      <div className="rs-booth__actions">
        {state === 'denied'
          ? <button className="rs-primary" onClick={onFallback}><Camera size={16} /> CHOOSE A PHOTO</button>
          : <button className="rs-primary" disabled={state !== 'ready' || count !== null} onClick={() => setCount(3)}><Camera size={16} /> TAKE PHOTO</button>}
        <button className="rs-secondary" onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  </div>
}
