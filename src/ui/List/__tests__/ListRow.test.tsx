import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListRow, SectionHeader } from '..'

describe('ListRow', () => {
  it('renders its slots, with the trailing control outside the hit area', () => {
    render(
      <ListRow
        data-testid="row"
        leading={<i data-testid="lead" />}
        title="Crossfade"
        subtitle="Between tracks"
        value="6s"
        trailing={<i data-testid="trail" />}
      />,
    )
    const row = screen.getByTestId('row')
    const hit = screen.getByRole('button')
    expect(row.tagName).toBe('DIV')
    expect(row).toHaveClass('row', 'plain')
    expect(hit).toHaveAttribute('tabindex', '-1')
    expect(hit).toContainElement(screen.getByTestId('lead'))
    expect(hit).toHaveTextContent('CrossfadeBetween tracks6s')
    expect(hit).not.toContainElement(screen.getByTestId('trail'))
    expect(row).toContainElement(screen.getByTestId('trail'))
  })

  it('carries its state as classes', () => {
    render(
      <ListRow data-testid="row" title="Sign out" tone="danger" variant="pill" focused active />,
    )
    expect(screen.getByTestId('row')).toHaveClass('row', 'pill', 'danger', 'focused', 'active')
    expect(screen.getByTestId('row')).not.toHaveClass('plain', 'disabled')
  })

  it('selects from its hit area', () => {
    const onSelect = vi.fn()
    render(<ListRow title="Queue" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not select while disabled', () => {
    const onSelect = vi.fn()
    render(<ListRow data-testid="row" title="Queue" disabled onSelect={onSelect} />)
    expect(screen.getByTestId('row')).toHaveClass('disabled')
    expect(screen.getByTestId('row')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button')).toBeDisabled()
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('takes nav item props spread onto it', () => {
    const onClick = vi.fn()
    render(
      <ul>
        <ListRow as="li" title="Queue" focused aria-selected onClick={onClick} />
      </ul>,
    )
    const row = screen.getByRole('listitem')
    expect(row).toHaveClass('focused')
    expect(row).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('SectionHeader', () => {
  it('renders its title and an optional trailing slot', () => {
    const { rerender } = render(<SectionHeader data-testid="h">Next in queue</SectionHeader>)
    expect(screen.getByTestId('h')).toHaveClass('header')
    expect(screen.getByText('Next in queue')).toHaveClass('title')
    expect(screen.getByTestId('h').children).toHaveLength(1)
    rerender(
      <SectionHeader data-testid="h" trailing="12 songs">
        Next in queue
      </SectionHeader>,
    )
    expect(screen.getByText('12 songs')).toHaveClass('trailing')
  })
})
