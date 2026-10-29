import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { MoreChoices } from './MoreChoices'

let latest: SessionProgress
function Harness({ initial }: { initial?: SessionProgress }) {
  const [progress, setProgress] = useState<SessionProgress>(() => ({ ...(initial ?? createSession('Maya')), moreChoiceTutorialSeen: initial?.moreChoiceTutorialSeen ?? true }))
  latest = progress
  return <MoreChoices progress={progress} onProgress={setProgress} onBack={() => {}} />
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const setValue = (value: number) => fireEvent.change(screen.getByRole('slider'), { target: { value: String(value) } })
const teacher = { ...createSession('Leo', 'leleomaker', true) }

describe('More than one choice: the sorting tower', () => {
  it('opens the intro on the first visit and again from the help button', () => {
    render(<Harness initial={{ ...createSession('Maya'), moreChoiceTutorialSeen: false }} />)
    expect(screen.getByRole('dialog', { name: 'Drop a value, watch where it lands' })).toBeInTheDocument()
    for (let step = 0; step < 4; step += 1) click(/NEXT/)
    click(/START SORTING/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(latest.moreChoiceTutorialSeen).toBe(true)
    click('How the sorting tower works')
    expect(screen.getByRole('dialog', { name: 'Drop a value, watch where it lands' })).toBeInTheDocument()
  })

  it('rewards finding two messages from separate ifs and reveals the map', async () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'Two at once?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'YOUR MACHINE: hidden' })).toBeInTheDocument()
    click('DROP 20')
    expect(screen.getByText('20°C → “Water”.')).toBeInTheDocument()
    setValue(-5); click('DROP -5')
    expect(await screen.findByRole('dialog', { name: 'Level solved!' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /-20 to 0: Ice and Water/ }).length).toBeGreaterThan(0)
    expect(latest.moreChoiceLevels).toEqual([1])
  })

  it('requires every bin when the second question lives inside else', async () => {
    render(<Harness initial={{ ...createSession('Maya'), moreChoiceLevels: [1, 2] }} />)
    expect(screen.getByRole('heading', { name: 'One path only' })).toBeInTheDocument()
    click('DROP 20')
    expect(screen.getByText('Exactly one message. Still to find: Ice, Steam.')).toBeInTheDocument()
    setValue(0); click('DROP 0')
    setValue(100); click('DROP 100')
    expect(await screen.findByRole('dialog', { name: 'Level solved!' })).toBeInTheDocument()
    // One event per drop: the winning drop is not counted twice.
    expect(latest.moreChoiceLog.filter((event) => event.level === 3)).toHaveLength(3)
    expect(latest.moreChoiceLevels).toEqual([1, 2, 3])
  })

  it('makes gold reachable only after the questions are swapped', async () => {
    render(<Harness initial={teacher} />)
    click(/Level 5: The lost gold/)
    expect(screen.getByText('NEVER REACHED')).toBeInTheDocument()
    click('DROP 120')
    expect(screen.getByText('Gold is still out of reach. Swap the two questions.')).toBeInTheDocument()
    click(/SWAP THE TWO QUESTIONS/)
    expect(await screen.findByText('Questions swapped.')).toBeInTheDocument()
    expect(screen.queryByText('NEVER REACHED')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'DROP 120' })).toBeEnabled())
    click('DROP 120')
    expect(await screen.findByRole('dialog', { name: 'Level solved!' })).toBeInTheDocument()
  })

  it('checks a built decision at every boundary and accepts an equivalent order', async () => {
    render(<Harness initial={teacher} />)
    click(/Level 6: Ticket booth/)
    expect(screen.getByRole('button', { name: 'CHECK MACHINE' })).toBeDisabled()
    click('Use question age < 12'); click('Use message Child ticket'); click('Use question age > 12'); click('Use message Adult ticket'); click('Use message Senior ticket')
    click('CHECK MACHINE')
    expect(await screen.findByText('At 12yrs your machine says “Senior ticket”, but the rule says “Adult ticket”.')).toBeInTheDocument()
    expect(latest.moreChoiceLog.at(-1)).toMatchObject({ level: 6, kind: 'check', ok: false })

    // A different but equivalent tree: seniors first, then adults, else children.
    click(/Question slot one/); click('Use question age >= 65')
    click(/Message slot one/); click('Use message Senior ticket')
    click(/Question slot two/); click('Use question age >= 12')
    click(/Message slot two/); click('Use message Adult ticket')
    click(/Message slot three/); click('Use message Child ticket')
    click('CHECK MACHINE')
    expect(await screen.findByRole('dialog', { name: 'Level solved!' })).toBeInTheDocument()
  })

  it('needs four right predictions in a row', async () => {
    render(<Harness initial={teacher} />)
    click(/Level 4: Predict the drop/)
    expect(screen.getByRole('button', { name: 'DROP 50' })).toBeDisabled()
    click('Gold'); click('DROP 50')
    expect(screen.getByText('It landed in Silver.')).toBeInTheDocument()
    for (const [bin, value] of [['Silver', 75], ['Gold', 100], ['Bronze', 49], ['Silver', 99]] as const) { click(bin); click(`DROP ${value}`) }
    expect(await screen.findByRole('dialog', { name: 'Level solved!' })).toBeInTheDocument()
    const predictions = latest.moreChoiceLog.filter((event) => event.kind === 'prediction')
    expect(predictions.map((event) => event.ok)).toEqual([false, true, true, true, true])
  })
})
