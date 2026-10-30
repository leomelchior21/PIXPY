import { fireEvent, render, screen } from '@testing-library/react'
import { conditionExperiences } from '../data/conditions'
import { createSession } from '../session/progressSession'
import { ConditionsHome } from './ConditionsHome'

it('opens all six activities for a teacher', () => {
  const navigate = vi.fn()
  render(<ConditionsHome progress={createSession('Leo', 'leleomaker', true)} onNavigate={navigate} />)
  conditionExperiences.forEach((activity) => {
    const button = screen.getByRole('button', { name: new RegExp(`${activity.order} ${activity.title.replace(/[?]/g, '\\?')}:`, 'i') })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(navigate).toHaveBeenLastCalledWith(activity.id)
  })
  expect(screen.getByText('6 ACTIVITIES OPEN')).toBeInTheDocument()
})

it('opens More than one choice after the Repair Shop, and the Final Bosses after More than one choice', () => {
  const card = (title: RegExp) => screen.getByRole('button', { name: title })
  const view = render(<ConditionsHome progress={createSession('Maya')} onNavigate={() => undefined} />)
  for (const title of [/^01 BACKROOM RUN:/, /^02 /, /^03 IF\/ELSE:/, /^04 REPAIR SHOP:/]) expect(card(title)).toBeEnabled()
  expect(card(/^05 MORE THAN ONE CHOICE\?: Locked until you finish REPAIR SHOP/)).toBeDisabled()
  expect(screen.getByText('FINISH REPAIR SHOP FIRST')).toBeInTheDocument()
  expect(card(/^06 Final Bosses: Locked until you finish MORE THAN ONE CHOICE\?/)).toBeDisabled()
  expect(screen.getByText('4 ACTIVITIES OPEN')).toBeInTheDocument()
  view.unmount()
  const second = render(<ConditionsHome progress={{ ...createSession('Maya'), completed: ['make-it-work'] }} onNavigate={() => undefined} />)
  expect(card(/^05 MORE THAN ONE CHOICE\?:/)).toBeEnabled()
  expect(card(/^06 Final Bosses: Locked/)).toBeDisabled()
  expect(screen.getByText('FINISH MORE THAN ONE CHOICE? FIRST')).toBeInTheDocument()
  second.unmount()
  render(<ConditionsHome progress={{ ...createSession('Maya'), completed: ['make-it-work', 'more-than-one-choice'] }} onNavigate={() => undefined} />)
  expect(card(/^06 Final Bosses:/)).toBeEnabled()
  expect(screen.getByText('6 ACTIVITIES OPEN')).toBeInTheDocument()
})

it('shows saved progress for the repair shop, the sorting tower, and the bosses', () => {
  render(<ConditionsHome progress={{ ...createSession('Leo', 'leleomaker', true), repairTickets: [1, 2], moreChoiceLevels: [1], conditionBosses: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('2 / 8 FIXED · CONTINUE')).toBeInTheDocument()
  expect(screen.getByText('1 / 8 SOLVED · CONTINUE')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 DEFEATED · CONTINUE')).toBeInTheDocument()
})

it('shows the saved IF/ELSE level count before the student continues', () => {
  render(<ConditionsHome progress={{ ...createSession('Maya'), ifElseLevels: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('3 / 10 SAVED · CONTINUE')).toBeInTheDocument()
})
