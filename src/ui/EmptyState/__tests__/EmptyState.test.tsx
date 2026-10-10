import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '..'

describe('EmptyState', () => {
  it('renders an inline title alone by default', () => {
    const { container } = render(<EmptyState title="Nothing queued" />)
    expect(container.firstElementChild).toHaveClass('empty', 'inline')
    expect(screen.getByText('Nothing queued')).toHaveClass('title')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('.body')).toBeNull()
  })

  it('renders the icon and body at page size', () => {
    const { container } = render(
      <EmptyState size="page" icon="playlist" title="No playlists" body="Save one in Spotify." />,
    )
    expect(container.firstElementChild).toHaveClass('empty', 'page')
    expect(container.querySelector('svg')).toHaveAttribute('width', '48')
    expect(screen.getByText('Save one in Spotify.')).toHaveClass('body')
  })

  it('sizes the icon down inline', () => {
    const { container } = render(<EmptyState icon="queue" title="Nothing queued" />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '24')
  })
})
