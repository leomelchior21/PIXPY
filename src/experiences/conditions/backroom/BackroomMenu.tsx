import { useState, type FormEvent } from 'react'
import { ArrowLeft, Infinity as InfinityIcon, LockKeyhole, Play, Star, Trophy, UserRound, Volume2, VolumeX } from 'lucide-react'
import { comparisonOperators, type SkillKey } from './backroomEngine'

// The tapes teach comparisons; bool and `and` records, if any, stay hidden.
const skillKeys: SkillKey[] = [...comparisonOperators]
import { backroomLevels, endlessUnlocked, levelUnlocked, nextLevelIndex, normalizeStars } from './backroomLevels'
import type { BackroomScore } from './backroomScores'
import type { BackroomProgress } from './types'
import { BackroomChampionAward } from './BackroomChampion'

interface Props {
  progress: BackroomProgress
  scores: BackroomScore[]
  // The score row that belongs to whoever is playing.
  you: string
  // Guests only: the name typed for the top scores, null until they type one.
  player?: string | null
  onPlayer: (name: string | null) => void
  audioOn: boolean
  champion: boolean
  // The tape a clear just opened: it waits with a NEW sticker.
  fresh?: number | null
  onToggleAudio: () => void
  onPlayLevel: (index: number) => void
  onPlayEndless: () => void
  onBack: () => void
}

type Tab = 'tapes' | 'records' | 'notes'

export function Stars({ count, size = 16 }: { count: number; size?: number }) {
  return <span className="br-stars" aria-label={`${count} of 3 stars`}>
    {[0, 1, 2].map((index) => <Star key={index} size={size} className={index < count ? 'is-lit' : ''} fill={index < count ? 'currentColor' : 'none'} />)}
  </span>
}

const skillLabels: Record<SkillKey, string> = { '>': '>', '<': '<', '>=': '>=', '<=': '<=', '==': '==', '!=': '!=', bool: 'bool', and: 'and' }

export function BackroomMenu({ progress, scores, you, player, onPlayer, audioOn, champion, fresh = null, onToggleAudio, onPlayLevel, onPlayEndless, onBack }: Props) {
  const stars = normalizeStars(progress.levelStars)
  const next = nextLevelIndex(stars)
  const unlockAll = progress.unlockAll ?? progress.isTeacher
  const deepOpen = endlessUnlocked(stars, unlockAll)
  const [tab, setTab] = useState<Tab>('tapes')
  const firstVisit = stars[0] === 0
  const totalStars = stars.reduce((sum, value) => sum + value, 0)
  const needsName = player === null
  const [draft, setDraft] = useState('')
  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const name = draft.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (name) onPlayer(name)
  }
  const practised = skillKeys.filter((key) => (progress.skills[key]?.right ?? 0) + (progress.skills[key]?.wrong ?? 0) > 0)

  const primary = firstVisit
    ? { label: 'START TUTORIAL', detail: 'TAPE 01 · LIGHTS ON', run: () => onPlayLevel(0) }
    : next !== null
      ? { label: 'CONTINUE', detail: `TAPE ${String(next + 1).padStart(2, '0')} · ${backroomLevels[next].title}`, run: () => onPlayLevel(next) }
      : { label: 'ENTER THE DEEP', detail: 'ENDLESS · EVERYTHING MIXED', run: onPlayEndless }

  return <div className="br-menu" role="dialog" aria-label="Backrooms Run tapes">
    <section className="br-menu-intro">
      <small className="br-kicker"><i /> FOUND FOOTAGE · LEVEL 0</small>
      <h2 className="br-title" data-text="BACKROOMS RUN">BACKROOMS RUN</h2>
      <p>Every gate in here runs Python. Make the condition <b className="is-true">TRUE</b>, or walk through the right door before the batteries die.</p>
      {needsName
        ? <form className="br-name-form" onSubmit={submitName} aria-label="Who is playing?">
          <label htmlFor="br-player-name">WHO IS PLAYING? YOUR NAME GOES ON THE TOP RUNS.</label>
          <div>
            <input id="br-player-name" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={24} autoComplete="off" spellCheck={false} placeholder="First and last name" autoFocus />
            <button className="br-primary" type="submit" disabled={!draft.trim()}><Play size={18} fill="currentColor" /> PLAY</button>
          </div>
        </form>
        : <button className="br-primary br-primary--hero" onClick={primary.run}><Play size={20} fill="currentColor" /><span><strong>{primary.label}</strong><small>{primary.detail}</small></span></button>}
      <div className="br-menu-meta">
        {player && <button className="br-chip-button" onClick={() => { setDraft(player); onPlayer(null) }} title="Change player"><UserRound size={15} /> {player.toUpperCase()} · CHANGE</button>}
        <button className={`br-chip-button ${audioOn ? 'is-on' : ''}`} onClick={onToggleAudio} aria-pressed={audioOn}>{audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />} SOUND {audioOn ? 'ON' : 'OFF'}</button>
        <span className="br-chip"><Star size={14} fill="currentColor" /> {totalStars}/{backroomLevels.length * 3}</span>
        <button className="br-chip-button" onClick={onBack}><ArrowLeft size={15} /> CONDITIONS</button>
      </div>
      {audioOn && <p className="br-menu-note">Headphones recommended.</p>}
      {champion && <BackroomChampionAward />}
    </section>

    <section className="br-menu-panel">
      <div className="br-tabs" role="tablist">
        {([['tapes', 'TAPES'], ['records', 'TOP RUNS'], ['notes', 'FIELD NOTES']] as Array<[Tab, string]>).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'tapes' && <ol className="br-tapes">
        {backroomLevels.map((level, index) => {
          const open = levelUnlocked(index, stars, unlockAll)
          return <li key={level.id}>
            <button className={`br-tape ${open ? '' : 'is-locked'} ${index === next ? 'is-next' : ''} ${stars[index] > 0 ? 'is-done' : ''} ${index === fresh ? 'is-fresh' : ''}`} disabled={!open || needsName} onClick={() => onPlayLevel(index)}>
              {index === fresh && <span className="br-tape-new">NEW</span>}
              <span className="br-tape-number">{String(level.id).padStart(2, '0')}</span>
              <span className="br-tape-copy"><strong>{level.title}</strong><small>{level.gates.length} GATES</small></span>
              <code className="br-tape-focus">{level.focus}</code>
              {open ? <Stars count={stars[index]} /> : <LockKeyhole size={18} aria-label="Locked" />}
            </button>
          </li>
        })}
        <li>
          <button className={`br-tape br-tape--deep ${deepOpen ? '' : 'is-locked'} ${fresh === backroomLevels.length ? 'is-fresh' : ''}`} disabled={!deepOpen || needsName} onClick={onPlayEndless}>
            {fresh === backroomLevels.length && <span className="br-tape-new">NEW</span>}
            <span className="br-tape-number"><InfinityIcon size={20} /></span>
            <span className="br-tape-copy"><strong>THE DEEP</strong><small>{deepOpen ? `ENDLESS · BEST ${progress.backroomRunBest} GATES` : `CLEAR ALL ${backroomLevels.length} TAPES TO OPEN`}</small></span>
            <code className="br-tape-focus">ALL</code>
            {deepOpen ? <Play size={18} /> : <LockKeyhole size={18} aria-label="Locked" />}
          </button>
        </li>
      </ol>}

      {tab === 'records' && <div className="br-records">
        <h3><Trophy size={20} /> THE DEEP · TOP RUNS</h3>
        <small>CLASS RANKING · EVERY STUDENT · BEST GATES / BEST XP</small>
        {scores.length > 0 ? <ol>{scores.map((score, index) => <li key={score.username} className={score.username === you ? 'is-you' : ''}>
          <b>{index + 1}</b><span>{score.name}{score.username === you ? ' (YOU)' : ''}</span><strong>{score.gates} <small>GATES</small></strong><em>{score.xp} XP</em>
        </li>)}</ol> : <p>No runs recorded yet. Clear the tapes, then set the first record in The Deep.</p>}
      </div>}

      {tab === 'notes' && <div className="br-notes">
        <h3>FIELD NOTES</h3>
        <small>EVERY GATE YOU HAVE READ, BY OPERATOR</small>
        {practised.length > 0 ? <ul>{skillKeys.map((key) => {
          const record = progress.skills[key] ?? { right: 0, wrong: 0 }
          const total = record.right + record.wrong
          const share = total ? record.right / total : 0
          return <li key={key} className={total === 0 ? 'is-empty' : share >= 0.8 ? 'is-strong' : share >= 0.5 ? 'is-ok' : 'is-weak'}>
            <code>{skillLabels[key]}</code>
            <span className="br-meter"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
            <b>{total === 0 ? '—' : `${record.right}/${total}`}</b>
          </li>
        })}</ul> : <p>Your notes fill in as you open gates. Operators you miss often show up red here.</p>}
      </div>}
    </section>
  </div>
}
