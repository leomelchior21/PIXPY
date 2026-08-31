import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/access', async () => {
  const actual = await vi.importActual<typeof import('./lib/access')>('./lib/access')
  return { ...actual, isTeacherAccess: async () => true }
})

describe('PixPy first session', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('opens the test profile, chooses an avatar, and reaches Runner Lab', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('ACCESS ID')
    await user.type(input, 'Lab Tester')
    expect(input).toHaveValue('labtester')
    await user.click(screen.getByRole('button', { name: /enter pixpy/i }))

    expect(await screen.findByRole('heading', { name: /pick your pixel face/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /avatar 1/i }))
    await user.click(screen.getByRole('button', { name: /that's me/i }))

    expect(await screen.findByRole('heading', { name: /your private lab/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enter the lab/i }))
    expect(await screen.findByText('RUNNER LAB', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByLabelText('Python code editor')).toBeInTheDocument()
  }, 15000)
})
