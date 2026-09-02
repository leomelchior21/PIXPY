import { variableExperiences } from '../data/variables'
import type { SessionProgress } from '../types'

interface PrintProgressProps {
  progress: SessionProgress
}

export function PrintProgress({ progress }: PrintProgressProps) {
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date())

  return (
    <section className="print-progress">
      <header><strong>PIX<span>PY</span></strong><p>Tiny Python experiments.</p></header>
      <div className="print-student"><span>Student: <b>{progress.name}</b></span><span>Date: <b>{date}</b></span></div>
      <h1>My Variables Progress</h1>
      <div className="print-list">
        {variableExperiences.map((experience) => (
          <div key={experience.id}><span>{progress.completed.includes(experience.id) ? '✓' : '□'}</span><strong>{experience.title}</strong></div>
        ))}
      </div>
      <div className="print-summary">
        <article><strong>{progress.completed.length} / 7</strong><span>experiences completed</span></article>
        <article><strong>{progress.bossProgress.length} / 15</strong><span>Final Bosses defeated</span></article>
      </div>
      {progress.blackBoxTests.length > 0 && (
        <section className="print-black-box">
          <h2>Can you crack my Black Box?</h2>
          <div>{progress.blackBoxTests.slice(-4).map((test, index) => <span key={`${test.input}-${index}`}>{test.input} → <b>{test.output}</b></span>)}</div>
          <p>The code stays secret.</p>
        </section>
      )}
      {progress.interestingValues.length > 0 && <p className="print-note"><b>Things I tried:</b> {progress.interestingValues.slice(-5).join(' · ')}</p>}
      <footer>PLAY → CHANGE → RUN → SEE → UNDERSTAND</footer>
    </section>
  )
}
