import { fireEvent, render, screen } from '@testing-library/react'
import { conditionExperiences } from '../data/conditions'
import { createSession } from '../session/progressSession'
import { ConditionsHome } from './ConditionsHome'

it('opens all five activities for a teacher', () => {
  const navigate = vi.fn()
  render(<ConditionsHome progress={createSession('Leo', 'leleomaker', true)} onNavigate={navigate} />)
  conditionExperiences.forEach((activity) => {
    const button = screen.getByRole('button', { name: new RegExp(`${activity.order} ${activity.title.replace(/[?]/g, '\\?')}:`, 'i') })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(navigate).toHaveBeenLastCalledWith(activity.id)
  })
  expect(screen.getByText('5 ACTIVITIES OPEN')).toBeInTheDocument()
})

it('keeps More than one choice hidden and opens the Final Bosses after the Repair Shop', () => {
  const card = (title: RegExp) => screen.getByRole('button', { name: title })
  const view = render(<ConditionsHome progress={createSession('Maya')} onNavigate={() => undefined} />)
  expect(screen.queryByRole('button', { name: /MORE THAN ONE CHOICE/ })).not.toBeInTheDocument()
  for (const title of [/^01 BACKROOM RUN:/, /^02 /, /^03 IF\/ELSE:/, /^04 REPAIR SHOP:/]) expect(card(title)).toBeEnabled()
  expect(card(/^05 Final Bosses: Locked until you finish REPAIR SHOP/)).toBeDisabled()
  expect(screen.getByText('FINISH REPAIR SHOP FIRST')).toBeInTheDocument()
  expect(screen.getByText('4 ACTIVITIES OPEN')).toBeInTheDocument()
  view.unmount()
  render(<ConditionsHome progress={{ ...createSession('Maya'), completed: ['make-it-work'] }} onNavigate={() => undefined} />)
  expect(card(/^05 Final Bosses:/)).toBeEnabled()
  expect(screen.getByText('5 ACTIVITIES OPEN')).toBeInTheDocument()
})

it('shows saved progress for the repair shop and the bosses', () => {
  render(<ConditionsHome progress={{ ...createSession('Leo', 'leleomaker', true), repairTickets: [1, 2], conditionBosses: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('2 / 8 FIXED · CONTINUE')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 DEFEATED · CONTINUE')).toBeInTheDocument()
})

it('shows the saved IF/ELSE level count before the student continues', () => {
  render(<ConditionsHome progress={{ ...createSession('Maya'), ifElseLevels: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('3 / 10 SAVED · CONTINUE')).toBeInTheDocument()
})
