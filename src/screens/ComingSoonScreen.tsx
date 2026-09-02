import { ArrowLeft, Braces, FunctionSquare, Sparkles } from 'lucide-react'
import type { AppRoute } from '../types'

interface ComingSoonScreenProps {
  area: 'conditionals' | 'functions'
  onNavigate: (route: AppRoute) => void
}

export function ComingSoonScreen({ area, onNavigate }: ComingSoonScreenProps) {
  const isConditionals = area === 'conditionals'
  const Icon = isConditionals ? Braces : FunctionSquare
  return (
    <main className={`coming-screen coming-screen--${area}`}>
      <button className="back-button" onClick={() => onNavigate('home')}><ArrowLeft size={18} /> All worlds</button>
      <section>
        <span className="coming-icon"><Icon /></span>
        <p className="pixel-kicker"><Sparkles size={15} /> {isConditionals ? 'DECISION LAB' : 'ACTION FORGE'}</p>
        <h1>{isConditionals ? 'Conditionals' : 'Functions'}</h1>
        <p>{isConditionals ? 'Code that looks at the world and chooses what happens next.' : 'Build an action once. Call it whenever you need it.'}</p>
        <code>{isConditionals ? 'if age >= 12:\n    open_gate()' : 'def super_jump():\n    jump()\n    sparkle()'}</code>
        <strong>COMING NEXT</strong>
        <small>This preview is open. The playable experiments arrive after Variables.</small>
      </section>
    </main>
  )
}
