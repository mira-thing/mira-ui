import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card, IconTile } from '..'

describe('Card', () => {
  it('is an uncached card surface with a tile, a title and a subtitle', () => {
    const { container } = render(<Card icon="queue" title="Queue" subtitle="2 tracks" focused />)

    const surface = container.firstElementChild!
    expect(surface).toHaveClass('surface', 'card', 'focused')
    expect(surface).not.toHaveAttribute('data-glass-panel')
    expect(surface.querySelector('.tile svg')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('2 tracks')).toBeInTheDocument()
  })

  it('drops the focused class and the subtitle when they are absent', () => {
    const { container } = render(<Card icon="queue" title="Queue" focused={false} />)

    expect(container.firstElementChild).not.toHaveClass('focused')
    expect(container.querySelector('.subtitle')).not.toBeInTheDocument()
  })

  it('selects on tap when given a handler', () => {
    const onSelect = vi.fn()
    render(<Card icon="queue" title="Queue" focused={false} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Queue'))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})

describe('IconTile', () => {
  it('sizes the tile and its icon together', () => {
    const { container, rerender } = render(<IconTile icon="queue" />)
    expect(container.firstElementChild).toHaveClass('tile', 'md')
    expect(container.querySelector('svg')).toHaveAttribute('width', '26')

    rerender(<IconTile icon="queue" size="lg" />)
    expect(container.firstElementChild).toHaveClass('tile', 'lg')
    expect(container.querySelector('svg')).toHaveAttribute('width', '34')
  })
})
