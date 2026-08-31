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

  it('opens the test profile, chooses an avatar, and reaches Dino Lab', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('ACCESS ID')
    await user.type(input, 'Lab Tester')
    expect(input).toHaveValue('labtester')
    await user.click(screen.getByRole('button', { name: /enter pixpy/i }))

    expect(await screen.findByRole('heading', { name: /choose your lab identity/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /byte avatar/i }))
    await user.click(screen.getByRole('button', { name: /that's me/i }))

    expect(await screen.findByRole('heading', { name: /ready to break/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enter the lab/i }))
    expect(await screen.findByText('DINO LAB')).toBeInTheDocument()
    expect(screen.getByLabelText('Python code editor')).toBeInTheDocument()
  })
})
