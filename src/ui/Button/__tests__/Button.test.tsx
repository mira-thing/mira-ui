import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button, IconButton, PlayPauseButton } from '..'

describe('IconButton', () => {
  it('renders a registry icon and reports its label', () => {
    const { container } = render(<IconButton icon="shuffle" label="Shuffle" size="xs" />)
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeInTheDocument()
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('32')
  })

  it('does not fire onPress while disabled', () => {
    const onPress = vi.fn()
    render(<IconButton icon="next" label="Next" disabled onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('marks knob focus with a class', () => {
    render(<IconButton icon="next" label="Next" focused />)
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('focused')
  })
})

describe('PlayPauseButton', () => {
  it('sizes the glyph by size', () => {
    const { container, rerender } = render(<PlayPauseButton isPaused />)
    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('btnLg')
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('36')

    rerender(<PlayPauseButton isPaused={false} size="mini" />)
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveClass('btnMd')
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('28')
  })
})

describe('Button', () => {
  it('defaults to a secondary md button that does not submit', () => {
    render(<Button>Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveClass('btn', 'secondary', 'md')
  })

  it('applies variant, size, block and focus classes', () => {
    render(
      <Button variant="danger" size="lg" block focused icon="trash">
        Delete
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn).toHaveClass('danger', 'lg', 'block', 'focused')
    expect(btn.querySelector('svg')).not.toBeNull()
  })

  it('passes button attributes through', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
