import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Page, PageHeader } from '..'

describe('Page', () => {
  it('puts the header and footer around the content', () => {
    const { container } = render(
      <Page header={<i data-testid="h" />} footer={<i data-testid="f" />}>
        <i data-testid="c" />
      </Page>,
    )
    const parts = [...container.firstElementChild!.children].map((el) => el.className)
    expect(parts).toEqual(['header', 'content', 'footer'])
    expect(screen.getByTestId('c').parentElement).toHaveClass('content')
  })

  it('leaves out a missing header or footer', () => {
    const { container } = render(<Page>body</Page>)
    expect(container.firstElementChild!.children).toHaveLength(1)
  })
})

describe('PageHeader', () => {
  it('shows the title, the subtitle and the trailing slot', () => {
    render(<PageHeader title="Queue" subtitle="2 tracks" trailing={<button>Clear</button>} />)
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
    expect(screen.getByText('2 tracks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })
})
