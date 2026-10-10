import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingRow, Switch } from '..'

function Toggle() {
  const [on, setOn] = useState(false)
  return <Switch checked={on} onChange={setOn} label="Lyrics" />
}

describe('Switch', () => {
  it('toggles, and reports its state as a switch', () => {
    render(<Toggle />)
    const sw = screen.getByRole('switch', { name: 'Lyrics' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(sw).not.toHaveClass('on')

    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveClass('on')

    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })
})

describe('SettingRow', () => {
  it('shows the label, the value and the control, with a decorative chip', () => {
    const { container } = render(
      <SettingRow icon={<i data-testid="icon" />} label="Volume per turn" value="2%">
        <input aria-label="control" />
      </SettingRow>,
    )
    expect(screen.getByText('Volume per turn')).toBeInTheDocument()
    expect(screen.getByText('2%')).toBeInTheDocument()
    expect(screen.getByLabelText('control')).toBeInTheDocument()
    expect(container.querySelector('.chip')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('turns the chip into a switch when given one', () => {
    const onChange = vi.fn()
    render(
      <SettingRow
        icon={<i />}
        label="Brightness"
        value="Auto"
        iconSwitch={{ checked: true, onChange, label: 'Auto brightness' }}
      >
        <span />
      </SettingRow>,
    )
    const chip = screen.getByRole('switch', { name: 'Auto brightness' })
    expect(chip).toHaveClass('chip', 'chipBtn', 'chipOn')

    fireEvent.click(chip)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
