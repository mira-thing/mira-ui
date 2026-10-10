import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon, ICONS, deviceIconName, type IconName } from '..'

const NAMES = Object.keys(ICONS) as IconName[]

describe('Icon', () => {
  it.each(NAMES)('renders %s as an svg with its own viewBox and geometry', (name) => {
    const { container } = render(<Icon name={name} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox', ICONS[name].viewBox)
    expect(svg!.children.length).toBeGreaterThan(0)
  })

  it('defaults to 24px and takes a size', () => {
    const { container, rerender } = render(<Icon name="trash" />)
    const svg = () => container.querySelector('svg')
    expect(svg()).toHaveAttribute('width', '24')
    expect(svg()).toHaveAttribute('height', '24')
    rerender(<Icon name="trash" size={43} />)
    expect(svg()).toHaveAttribute('width', '43')
    expect(svg()).toHaveAttribute('height', '43')
  })

  it('is hidden from assistive tech unless titled', () => {
    const { container, rerender } = render(<Icon name="heart" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    rerender(<Icon name="heart" title="Support" />)
    const img = screen.getByRole('img', { name: 'Support' })
    expect(img).not.toHaveAttribute('aria-hidden')
  })

  it('passes className and data attributes through to the svg', () => {
    const { container } = render(<Icon name="dj" className="mark" data-kind="x" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('mark')
    expect(svg).toHaveAttribute('data-kind', 'x')
  })

  it('keeps the previous control mirrored from next', () => {
    const { container } = render(<Icon name="prev" />)
    expect(container.querySelector('g')).toHaveAttribute('transform', 'translate(24 0) scale(-1 1)')
  })
})

describe('deviceIconName', () => {
  it.each([
    ['SMARTPHONE', 'devicePhone'],
    ['smartphone', 'devicePhone'],
    ['TABLET', 'devicePhone'],
    ['COMPUTER', 'deviceComputer'],
    ['Chromebook', 'deviceComputer'],
    ['CHROMEBOOK', 'deviceComputer'],
    ['SPEAKER', 'deviceGeneric'],
    ['TV', 'deviceGeneric'],
    ['', 'deviceGeneric'],
  ])('maps %j to %s', (type, expected) => {
    expect(deviceIconName(type)).toBe(expected)
  })
})
