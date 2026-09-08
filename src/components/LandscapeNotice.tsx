import { RotateCw, Tablet } from 'lucide-react'
import { Brand } from './Brand'

export function LandscapeNotice() {
  return (
    <section className="landscape-notice" aria-labelledby="landscape-title">
      <Brand />
      <div className="landscape-notice__illustration" aria-hidden="true"><Tablet /><RotateCw /></div>
      <span className="landscape-notice__label">MADE FOR SIDE-BY-SIDE DISCOVERIES</span>
      <h1 id="landscape-title">Turn your iPad sideways.</h1>
      <p>Keep your code and your experiment in view.<br />PixPy will be ready when you rotate to landscape.</p>
      <small>On a laptop? Make your browser window wider.</small>
    </section>
  )
}
