import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { PageShell, type PageShellProps } from '../PageShell'
import { usePageActive } from '../pageActive'
import { createRouteBack, RouteBackContext, useRouteBack } from '../routeBack'
import type { PageEntry } from '../usePages'

type StubId = 'home' | 'detail' | 'more'

const home: PageEntry<StubId> = { id: 'home', key: 0 }
const detail: PageEntry<StubId> = { id: 'detail', key: 1 }
const deeper: PageEntry<StubId> = { id: 'more', key: 2 }

function Stub({ id }: { id: StubId }) {
  const active = usePageActive()
  return (
    <div data-testid={id} data-active={String(active)}>
      <span data-testid={`${id}-child`} />
    </div>
  )
}

function shell(over: Partial<PageShellProps<StubId>> = {}) {
  return (
    <PageShell<StubId>
      root={home}
      current={home}
      previous={null}
      renderPage={(id) => <Stub id={id} />}
      overlays={<div data-testid="overlays" />}
      {...over}
    />
  )
}

// the wrapper the shell puts around each page
const layer = (id: StubId) => screen.getByTestId(id).parentElement!
const mountedPages = () => document.querySelectorAll('[data-active]').length

function transitionEnd(target: Element, propertyName: string) {
  const ev = new Event('transitionend', { bubbles: true })
  Object.assign(ev, { propertyName })
  act(() => {
    target.dispatchEvent(ev)
  })
}

describe('PageShell', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    }),
  )
  afterEach(() => vi.useRealTimers())

  const nextFrame = () => act(() => vi.advanceTimersByTime(16))

  it('mounts the first page at rest, with nothing to animate', () => {
    render(shell())

    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'true')
    expect(layer('home').className).toBe('page')
  })

  it('renders the overlays inside its own container, after the pages', () => {
    const { container } = render(shell())

    const root = container.firstElementChild!
    expect(root).toHaveClass('shell')
    expect(root.lastElementChild).toBe(screen.getByTestId('overlays'))
    expect(root.contains(layer('home'))).toBe(true)
  })

  it('holds the root plus at most the entering and the outgoing page', () => {
    const { rerender } = render(shell())

    rerender(shell({ current: detail, previous: home }))
    expect(mountedPages()).toBe(2)

    rerender(shell({ current: home, previous: detail }))
    expect(mountedPages()).toBe(2)

    act(() => vi.advanceTimersByTime(1000))
    expect(mountedPages()).toBe(1)
    expect(screen.getByTestId('home')).toBeInTheDocument()
  })

  it('drops the page two back the moment a second push lands mid-transition', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))
    nextFrame()

    rerender(shell({ current: deeper, previous: detail }))
    expect(mountedPages()).toBe(3)
    expect(screen.getByTestId('detail')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('more')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'false')

    act(() => vi.advanceTimersByTime(1000))
    expect(mountedPages()).toBe(2)
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
  })

  it('keeps the root mounted, covered and inactive, under a page pushed over it', () => {
    const { rerender } = render(shell())
    const homeLayer = layer('home')
    rerender(shell({ current: detail, previous: home }))
    nextFrame()
    expect(layer('home')).not.toHaveClass('pageCovered')

    transitionEnd(layer('home'), 'opacity')
    expect(layer('home')).toBe(homeLayer)
    expect(layer('home')).toHaveClass('pageInactive')
    expect(layer('home')).toHaveClass('pageCovered')
    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'false')

    rerender(shell({ current: home, previous: detail }))
    expect(layer('home')).toBe(homeLayer)
    expect(layer('home')).not.toHaveClass('pageCovered')
    nextFrame()
    expect(layer('home').className).toBe('page')
    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'true')
  })

  it('lets only the leaving page end its fade, not the covered root', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))
    nextFrame()
    transitionEnd(layer('home'), 'opacity')
    rerender(shell({ current: deeper, previous: detail }))
    nextFrame()

    transitionEnd(layer('home'), 'opacity')
    expect(screen.getByTestId('detail')).toBeInTheDocument()
    transitionEnd(layer('detail'), 'opacity')
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
  })

  it('mounts an entering page inactive for a frame, then turns it active', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))

    expect(layer('detail')).toHaveClass('pageInactive')
    expect(layer('home')).toHaveClass('pageInactive')

    nextFrame()
    expect(layer('detail').className).toBe('page')
    expect(layer('home')).toHaveClass('pageInactive')
  })

  it('tells only the current page it is active', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))

    expect(screen.getByTestId('detail')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'false')
  })

  it('unmounts the outgoing page when its own opacity transition ends', () => {
    const { rerender } = render(shell({ current: detail }))
    rerender(shell({ current: deeper, previous: detail }))
    nextFrame()

    transitionEnd(layer('detail'), 'opacity')
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
    expect(screen.getByTestId('more')).toBeInTheDocument()
  })

  it('ignores a transitionend bubbling from inside the page, or for another property', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))
    nextFrame()

    transitionEnd(screen.getByTestId('home-child'), 'opacity')
    transitionEnd(layer('home'), 'transform')
    expect(screen.getByTestId('home')).toBeInTheDocument()
  })

  it('unmounts the outgoing page after the fallback when transitionend never comes', () => {
    const { rerender } = render(shell({ current: detail }))
    rerender(shell({ current: deeper, previous: detail }))
    nextFrame()

    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByTestId('detail')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(50))
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
  })

  it('reverses a push that is still running onto the same node', () => {
    const { rerender } = render(shell())
    const homeLayer = layer('home')
    rerender(shell({ current: detail, previous: home }))
    nextFrame()

    rerender(shell({ current: home, previous: detail }))
    expect(layer('home')).toBe(homeLayer)
    expect(screen.getByTestId('home')).toHaveAttribute('data-active', 'true')

    nextFrame()
    transitionEnd(layer('detail'), 'opacity')
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
    expect(layer('home').className).toBe('page')
  })

  it('does not animate out a page that left before the shell mounted', () => {
    render(shell({ current: home, previous: detail }))

    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
    expect(layer('home').className).toBe('page')
  })

  it('shows a forced page in place of the stack, over the covered root', () => {
    render(shell({ current: detail, previous: home, forcedPage: 'more' }))

    expect(screen.getByTestId('more')).toHaveAttribute('data-active', 'true')
    expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
    expect(layer('more').className).toBe('page')
    expect(layer('home')).toHaveClass('pageCovered')
  })

  it('swaps a forced page in at rest and leaves nothing stale behind when it is dropped', () => {
    const { rerender } = render(shell())
    rerender(shell({ current: detail, previous: home }))

    rerender(shell({ current: detail, previous: home, forcedPage: 'more' }))
    expect(mountedPages()).toBe(2)
    expect(layer('more').className).toBe('page')

    rerender(shell({ current: detail, previous: home }))
    expect(mountedPages()).toBe(2)
    expect(screen.getByTestId('detail')).toBeInTheDocument()
    expect(layer('home')).toHaveClass('pageCovered')
  })

  describe('Back', () => {
    function PageWithBack({ onBack }: { onBack: () => boolean }) {
      useRouteBack(onBack)
      return null
    }

    it('pops only after the page declines it', () => {
      const routeBack = createRouteBack()
      const onPop = vi.fn(() => true)
      const onPageBack = vi.fn(() => false)
      render(
        <RouteBackContext.Provider value={routeBack}>
          {shell({ onBack: onPop, renderPage: () => <PageWithBack onBack={onPageBack} /> })}
        </RouteBackContext.Provider>,
      )

      expect(routeBack.run()).toBe(true)
      expect(onPageBack).toHaveBeenCalledBefore(onPop)
    })

    it('does not pop under a forced page, or once the shell is gone', () => {
      const routeBack = createRouteBack()
      const onPop = vi.fn(() => true)
      const { rerender, unmount } = render(
        <RouteBackContext.Provider value={routeBack}>
          {shell({ onBack: onPop, forcedPage: 'more' })}
        </RouteBackContext.Provider>,
      )
      expect(routeBack.run()).toBe(false)

      rerender(
        <RouteBackContext.Provider value={routeBack}>
          {shell({ onBack: onPop })}
        </RouteBackContext.Provider>,
      )
      expect(routeBack.run()).toBe(true)

      unmount()
      onPop.mockClear()
      expect(routeBack.run()).toBe(false)
      expect(onPop).not.toHaveBeenCalled()
    })
  })
})
