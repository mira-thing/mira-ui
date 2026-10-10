import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Surface } from '../Surface'

describe('Surface', () => {
  it('carries the base and variant classes alongside the caller’s', () => {
    render(<Surface variant="bar" className="extra" data-testid="s" />)
    expect(screen.getByTestId('s').className).toBe('surface bar extra')
  })

  it('marks only the focused state', () => {
    render(<Surface variant="card" focused data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveClass('card', 'focused')
  })

  it('registers panels and bars with the paint cache by default, and nothing else', () => {
    const { rerender } = render(<Surface variant="panel" data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('data-glass-panel', '')
    rerender(<Surface variant="bar" data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('data-glass-panel', '')
    rerender(<Surface variant="card" data-testid="s" />)
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-glass-panel')
    rerender(<Surface variant="floating" data-testid="s" />)
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-glass-panel')
  })

  it('lets the caller override the cache default', () => {
    const { rerender } = render(<Surface variant="panel" cache={false} data-testid="s" />)
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-glass-panel')
    rerender(<Surface variant="card" cache data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('data-glass-panel', '')
  })

  it('emits the depth panel only when asked, including the empty one', () => {
    const { rerender } = render(<Surface variant="panel" data-testid="s" />)
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-depth-panel')
    rerender(<Surface variant="panel" depth="" data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('data-depth-panel', '')
    rerender(<Surface variant="panel" depth="lyrics" data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('data-depth-panel', 'lyrics')
  })

  it('wraps the children in a clip only when asked', () => {
    const { rerender } = render(
      <Surface variant="panel" data-testid="s">
        <i data-testid="child" />
      </Surface>,
    )
    expect(screen.getByTestId('child').parentElement).toBe(screen.getByTestId('s'))
    rerender(
      <Surface variant="panel" clip data-testid="s">
        <i data-testid="child" />
      </Surface>,
    )
    const clip = screen.getByTestId('child').parentElement!
    expect(clip).toHaveClass('clip')
    expect(clip.parentElement).toBe(screen.getByTestId('s'))
  })

  it('never writes a tint colour inline, only an alpha when one is given', () => {
    const { rerender } = render(<Surface variant="panel" data-testid="s" />)
    expect(screen.getByTestId('s')).not.toHaveAttribute('style')
    rerender(<Surface variant="panel" tint={0.15} style={{ width: 10 }} data-testid="s" />)
    const el = screen.getByTestId('s')
    expect(el.style.getPropertyValue('--surface-tint-alpha')).toBe('0.15')
    expect(el.style.getPropertyValue('--surface-tint')).toBe('')
    expect(el.style.width).toBe('10px')
  })

  it('renders as the requested element and forwards the ref', () => {
    const ref = createRef<HTMLElement>()
    render(
      <ul>
        <Surface variant="card" as="li" ref={ref} data-testid="s" />
      </ul>,
    )
    expect(screen.getByTestId('s').tagName).toBe('LI')
    expect(ref.current).toBe(screen.getByTestId('s'))
  })
})
