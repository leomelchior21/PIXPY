import { ArrowRight, Check, Lightbulb } from 'lucide-react'
import { PythonCode } from '../../components/PythonCode'
import type { IfElseProblem } from '../../data/ifElseBuilder'
import type { ConditionParts, ExecutionTrace } from '../../lib/ifElseLearning'
import { comparisonOperators, expressionChoices } from '../../lib/ifElseLearning'

export interface DraftExpression { left: string; operator: string; right: string }

interface ExpressionProps {
  problem: IfElseProblem
  expression: DraftExpression
  operatorOnly: boolean
  independent: boolean
  disabled: boolean
  onChange: (expression: DraftExpression) => void
}

export function ExpressionEditor({ problem, expression, operatorOnly, independent, disabled, onChange }: ExpressionProps) {
  const choices = operatorOnly ? { left: [], operator: comparisonOperators, right: [] } : expressionChoices(problem, independent)
  const groupLabels: Record<keyof ConditionParts, string> = { left: 'Left value', operator: 'Operator', right: 'Right value' }
  return <section className="ieb-expression" aria-label="Build the condition">
    <header><span className="ieb-section-number">01</span><div><h2>{operatorOnly ? 'What should Python ask?' : 'Build your condition'}</h2><p>{operatorOnly ? 'Tap a comparison. The other lines stay in place.' : 'Tap one choice in each group. You can change any choice.'}</p></div></header>
    <div className="ieb-expression-preview" aria-label="Your condition"><code>if </code>{(['left', 'operator', 'right'] as const).map((part) => <span key={part} className={!expression[part] ? 'is-empty' : ''}>{expression[part] || groupLabels[part]}</span>)}<code>:</code></div>
    <div className="ieb-expression-groups">{(['left', 'operator', 'right'] as const).filter((part) => !operatorOnly || part === 'operator').map((part) => <fieldset key={part}>
      <legend>{groupLabels[part]}</legend>
      {choices[part].map((token) => <button key={token} type="button" disabled={disabled} aria-pressed={expression[part] === token} aria-label={`Choose ${groupLabels[part].toLowerCase()} ${token}`} data-line-edit={part === 'operator' ? 1 : undefined} onClick={() => onChange({ ...expression, [part]: token })}><code>{token}</code>{expression[part] === token && <Check size={13} />}</button>)}
    </fieldset>)}</div>
  </section>
}

export function BranchEditor({ problem, lines, disabled, onChange }: { problem: IfElseProblem; lines: Array<string | null>; disabled: boolean; onChange: (line: number, code: string) => void }) {
  return <section className="ieb-branch-builder" aria-label="Choose branch actions"><header><h2>Which action belongs in each path?</h2><p>Both messages are in the mission. Assign one to each branch.</p></header>
    {[{ line: 2, branch: 'IF', truth: 'TRUE' }, { line: 4, branch: 'ELSE', truth: 'FALSE' }].map(({ line, branch, truth }) => <fieldset key={line}><legend>{branch} action <small>when {truth}</small></legend>{[problem.falseOutput, problem.trueOutput].map((output) => {
      const code = `    print("${output}")`
      return <button key={output} disabled={disabled} aria-label={`Use ${output} in ${branch}`} aria-pressed={lines[line] === code} data-line-edit={line} onClick={() => onChange(line, code)}><code>{output}</code>{lines[line] === code && <Check size={13} />}</button>
    })}</fieldset>)}
  </section>
}

export function PredictionCard({ problem, value, kind, prediction, disabled, showCondition, onPredict }: { problem: IfElseProblem; value: number | null; kind: 'output' | 'truth'; prediction: string | null; disabled: boolean; showCondition: boolean; onPredict: (prediction: string) => void }) {
  return <section className="ieb-prediction" aria-label="Predict before running"><h2>{kind === 'output' ? 'What will happen with this value?' : 'Will your condition be TRUE or FALSE?'}</h2>
    <div className="ieb-prediction-model"><code>{problem.variable} = {value ?? '?'}</code><ArrowRight size={15} />{showCondition && <><code>{problem.condition}</code><ArrowRight size={15} /></>}<b>?</b></div>
    <div>{(kind === 'output' ? [problem.trueOutput, problem.falseOutput] : ['TRUE', 'FALSE']).map((option) => <button key={option} aria-label={`Predict ${option}`} aria-pressed={prediction === option} disabled={disabled} onClick={() => onPredict(option)}>{option}{prediction === option && <Check size={15} />}</button>)}</div>
    <small>{prediction ? kind === 'output' ? 'Prediction saved. Build the program, then press CHECK CODE + RUN.' : 'Prediction saved. Now test it with Python.' : kind === 'output' ? 'Choose either outcome to unlock the build. You can learn from either prediction.' : 'Choose an input and finish your condition, then predict. This is an idea to test.'}</small>
  </section>
}

export function TwoPaths({ problem, visibility, expanded, onHint }: { problem: IfElseProblem; visibility: 'full' | 'compact' | 'unknown' | 'hint'; expanded: boolean; onHint: () => void }) {
  if (visibility === 'hint' && !expanded) return <button className="ieb-path-hint" onClick={onHint}><Lightbulb size={16} /> Show a two-path hint</button>
  const unknown = visibility === 'unknown' && !expanded
  return <section className={`ieb-brief ${visibility === 'compact' ? 'ieb-brief--compact' : ''}`} aria-label="The two paths"><span className="ieb-kicker">THE TWO PATHS</span><div><b>IF <ArrowRight size={13} /></b><code>{unknown ? '?' : problem.trueOutput}</code></div><div><b>ELSE <ArrowRight size={13} /></b><code>{unknown ? '?' : problem.falseOutput}</code></div>{unknown && <button className="ieb-path-hint" onClick={onHint}><Lightbulb size={14} /> Reveal the paths as a hint</button>}</section>
}

export function TracePanel({ trace, step = 4, compact = false }: { trace: ExecutionTrace; step?: number; compact?: boolean }) {
  return <section className={`ieb-trace ${compact ? 'ieb-trace--compact' : ''}`} aria-label="Python decision trace"><header>HOW PYTHON DECIDED</header><ol>{trace.steps.map((item, i) => <li key={item.label} className={`${i <= step ? 'is-seen' : ''} ${i === step ? 'is-active' : ''}`} aria-current={i === step ? 'step' : undefined}><span>{item.label}</span><code>{i <= step ? item.text : '...'}</code>{i < 4 && <ArrowRight size={13} aria-hidden="true" />}</li>)}</ol></section>
}

export function PredictionComparison({ prediction, trace }: { prediction: { text: string; kind: 'output' | 'truth' }; trace: ExecutionTrace }) {
  const actual = prediction.kind === 'truth' ? trace.truth ? 'TRUE' : 'FALSE' : trace.output
  const matches = prediction.text === actual
  return <div className="ieb-prediction-comparison"><div><span>YOUR PREDICTION</span><b>{prediction.text}</b></div><div><span>PYTHON RESULT</span><b>{actual}</b></div><p>{matches ? 'Your prediction matched Python.' : 'Your prediction was different. Follow the trace to see why; predictions do not count as errors.'}</p></div>
}

export function ProvidedCode({ code }: { code: string }) { return <div className="ieb-fixed-line"><PythonCode code={code} /></div> }
