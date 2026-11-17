import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueuePage } from '../QueuePage'

describe('QueuePage', () => {
  it('shows its header over an empty state', () => {
    render(<QueuePage />)
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
    expect(screen.getByText('Nothing queued')).toBeInTheDocument()
  })
})
