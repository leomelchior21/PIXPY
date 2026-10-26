import { fireEvent, render, screen } from '@testing-library/react'
import { conditionExperiences } from '../data/conditions'
import { createSession } from '../session/progressSession'
import { ConditionsHome } from './ConditionsHome'

it('opens all six activities', () => {
  const navigate = vi.fn()
  render(<ConditionsHome progress={createSession('Maya')} onNavigate={navigate} />)
  conditionExperiences.forEach((activity) => {
    const button = screen.getByRole('button', { name: new RegExp(`${activity.order} ${activity.title.replace(/[?]/g, '\\?')}:`, 'i') })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(navigate).toHaveBeenLastCalledWith(activity.id)
  })
  expect(screen.getByText('6 ACTIVITIES OPEN')).toBeInTheDocument()
})

it('shows saved progress for the repair shop, the sorting tower, and the bosses', () => {
  render(<ConditionsHome progress={{ ...createSession('Maya'), repairTickets: [1, 2], moreChoiceLevels: [1], conditionBosses: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('2 / 8 FIXED · CONTINUE')).toBeInTheDocument()
  expect(screen.getByText('1 / 8 SOLVED · CONTINUE')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 DEFEATED · CONTINUE')).toBeInTheDocument()
})

it('shows the saved IF/ELSE level count before the student continues', () => {
  render(<ConditionsHome progress={{ ...createSession('Maya'), ifElseLevels: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('3 / 10 SAVED · CONTINUE')).toBeInTheDocument()
})
