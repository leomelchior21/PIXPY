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
