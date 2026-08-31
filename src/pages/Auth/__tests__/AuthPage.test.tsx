import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthPage } from '../AuthPage'

describe('AuthPage', () => {
  it('shows the sign-in link once there is one', () => {
    render(<AuthPage url="https://accounts.spotify.com/authorize?x=1" />)
    expect(screen.getByText('accounts.spotify.com/authorize?x=1')).toBeInTheDocument()
    expect(screen.getByText('waiting for sign-in...')).toBeInTheDocument()
  })

  it('waits without a link while the daemon is still resolving auth', () => {
    render(<AuthPage />)
    expect(screen.getByText('fetching pairing code...')).toBeInTheDocument()
    expect(screen.getByLabelText('Fetching pairing code')).toBeInTheDocument()
  })

  it('offers a way out once the wait reads as broken rather than slow', () => {
    render(<AuthPage stuck />)
    expect(screen.getByText(/try unplugging and replugging/)).toBeInTheDocument()
  })

  it('stays quiet while the wait is still reasonable', () => {
    render(<AuthPage />)
    expect(screen.queryByText(/try unplugging and replugging/)).not.toBeInTheDocument()
  })

  it('never shows the waiting hint once a link has arrived', () => {
    // a url means the user has something to act on; the hint would only nag
    render(<AuthPage url="https://accounts.spotify.com/authorize?x=1" stuck />)
    expect(screen.queryByText(/try unplugging and replugging/)).not.toBeInTheDocument()
  })
})
