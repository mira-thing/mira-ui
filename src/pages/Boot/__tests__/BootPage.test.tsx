import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BootPage } from '../BootPage'

describe('BootPage', () => {
  it('says what it is waiting on', () => {
    render(<BootPage phase="starting" />)
    expect(screen.getByText('starting up')).toBeInTheDocument()
  })

  it('offers a way out once the wait reads as broken rather than slow', () => {
    render(<BootPage phase="starting" stuck />)
    expect(screen.getByText(/try unplugging and replugging/)).toBeInTheDocument()
  })

  it('stays quiet while the wait is still reasonable', () => {
    render(<BootPage phase="starting" />)
    expect(screen.queryByText(/try unplugging and replugging/)).not.toBeInTheDocument()
  })

  it('shows first-boot setup with its progress', () => {
    render(<BootPage phase="setting-up" progress={47} />)
    expect(screen.getByText('setting things up')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '47')
  })

  it('shows setup without a bar until the daemon reports progress', () => {
    render(<BootPage phase="setting-up" />)
    expect(screen.getByText('setting things up')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('never offers the stuck hint during setup, which is slow on purpose', () => {
    render(<BootPage phase="setting-up" progress={10} stuck />)
    expect(screen.queryByText(/try unplugging and replugging/)).not.toBeInTheDocument()
  })
})
