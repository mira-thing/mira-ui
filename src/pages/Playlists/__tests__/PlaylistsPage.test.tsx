import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlaylistsPage } from '../PlaylistsPage'

describe('PlaylistsPage', () => {
  it('shows its header over an empty state', () => {
    render(<PlaylistsPage />)
    expect(screen.getByRole('heading', { name: 'Playlists' })).toBeInTheDocument()
    expect(screen.getByText('No playlists yet')).toBeInTheDocument()
  })
})
