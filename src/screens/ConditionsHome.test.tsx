import { fireEvent, render, screen } from '@testing-library/react'
import { conditionExperiences } from '../data/conditions'
import { createSession } from '../session/progressSession'
import { ConditionsHome } from './ConditionsHome'

it('keeps the first three activities open and disables the last three', () => {
  const navigate = vi.fn()
  render(<ConditionsHome progress={createSession('Maya')} onNavigate={navigate} />)
  conditionExperiences.forEach((activity, index) => {
    const button = screen.getByRole('button', { name: new RegExp(`${activity.order} ${activity.title.replace(/[?]/g, '\\?')}:`, 'i') })
    if (index < 3) {
      expect(button).toBeEnabled()
      fireEvent.click(button)
      expect(navigate).toHaveBeenLastCalledWith(activity.id)
    } else {
      expect(button).toBeDisabled()
      navigate.mockClear()
      fireEvent.click(button)
      expect(navigate).not.toHaveBeenCalled()
    }
  })
})

it('shows the saved IF/ELSE level count before the student continues', () => {
  render(<ConditionsHome progress={{ ...createSession('Maya'), ifElseLevels: [1, 2, 3] }} onNavigate={() => undefined} />)
  expect(screen.getByText('3 / 10 SAVED · CONTINUE')).toBeInTheDocument()
})
