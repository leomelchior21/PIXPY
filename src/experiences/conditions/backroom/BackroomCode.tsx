import { ChevronLeft, ChevronRight } from 'lucide-react'
import { conditionCode, gateBool, gateUsesEnergy, pythonBool, type BackroomGate, type GateValues } from './backroomEngine'

const keywords = new Set(['if', 'and', 'or', 'not'])

// A tiny Python highlighter for the handful of tokens the gates use.
export function CodeTokens({ code }: { code: string }) {
  const parts = code.split(/(\s+|==|!=|>=|<=|[><=():])/).filter((part) => part !== '')
  return <>{parts.map((part, index) => {
    const kind = keywords.has(part) ? 'k'
      : part === 'True' || part === 'False' ? 'b'
        : /^\d+$/.test(part) ? 'n'
          : /^(==|!=|>=|<=|[><=])$/.test(part) ? 'o'
            : /^[():]$/.test(part) ? 'p'
              : /^\s+$/.test(part) ? '' : 'v'
    return kind ? <span key={index} className={`br-t-${kind}`}>{part}</span> : <span key={index}>{part}</span>
  })}</>
}

export type CodeTruth = 'true' | 'false' | 'unknown' | 'next'

interface Props {
  gate: BackroomGate
  values: GateValues
  editable: boolean
  truth: CodeTruth
  trueSide: -1 | 1
  label: string
}

const Masked = ({ width }: { width: number }) => <span className="br-mask" style={{ width: `${width}ch` }} aria-hidden="true" />

export function CodePanel({ gate, values, editable, truth, trueSide, label }: Props) {
  const flag = gateBool(gate)
  const energy = gateUsesEnergy(gate)
  const fork = gate.kind === 'fork'
  // In the corridor the next gate keeps its values and condition hidden: they load at the gate.
  if (truth === 'next') return <section className={`br-code ${fork ? 'is-fork' : 'is-set'} is-next`} aria-label={`Python gate code. ${label}. The code loads at the gate.`}>
    <header className="br-code-head">
      <span>{label}</span>
      <b>LOADS AT THE GATE</b>
    </header>
    <pre>
      {energy && <code className="br-code-line"><CodeTokens code="energy = " /><Masked width={2} /></code>}
      {flag && <code className="br-code-line"><CodeTokens code={`${flag} = `} /><Masked width={5} /></code>}
      <code className="br-code-line br-code-if"><CodeTokens code="if " /><Masked width={Math.max(6, conditionCode(gate).length)} /><span className="br-t-p">:</span></code>
    </pre>
  </section>
  return <section className={`br-code ${fork ? 'is-fork' : 'is-set'} is-${truth} is-loaded`} aria-label={`Python gate code. ${label}`}>
    <header className="br-code-head">
      <span>{label}</span>
      <b>{fork ? 'GIVEN VALUES' : editable ? 'YOU EDIT THE VALUES' : 'GATE CODE'}</b>
    </header>
    <pre>
      {energy && <code className="br-code-line">
        <CodeTokens code="energy = " />
        {fork ? <span className="br-t-n">{values.energy}</span> : <output className={`br-slot ${editable ? 'is-editable' : ''}`} aria-label={`energy is ${values.energy}`}>{values.energy}</output>}
      </code>}
      {flag && <code className="br-code-line">
        <CodeTokens code={`${flag} = `} />
        {fork ? <span className="br-t-b">{pythonBool(values.flag)}</span> : <output className={`br-slot br-slot--bool ${values.flag ? 'is-on' : 'is-off'} ${editable ? 'is-editable' : ''}`} aria-label={`${flag} is ${pythonBool(values.flag)}`}>{pythonBool(values.flag)}</output>}
      </code>}
      <code className="br-code-line br-code-if">
        <CodeTokens code={`if ${conditionCode(gate)}:`} />
        {!fork && <span className={`br-truth is-${truth}`} aria-live="polite">{truth === 'unknown' ? '?' : truth.toUpperCase()}</span>}
      </code>
    </pre>
    {fork && <div className={`br-doors ${trueSide < 0 ? 'true-left' : 'true-right'}`} aria-label={`TRUE door on the ${trueSide < 0 ? 'left' : 'right'}, FALSE door on the ${trueSide < 0 ? 'right' : 'left'}`}>
      <span className={trueSide < 0 ? 'is-true' : 'is-false'}><ChevronLeft size={16} /> {trueSide < 0 ? 'TRUE' : 'FALSE'} DOOR</span>
      <span className={trueSide > 0 ? 'is-true' : 'is-false'}>{trueSide > 0 ? 'TRUE' : 'FALSE'} DOOR <ChevronRight size={16} /></span>
    </div>}
  </section>
}
