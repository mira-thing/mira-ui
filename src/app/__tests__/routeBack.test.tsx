import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PageActiveContext } from '../pageActive'
import { createRouteBack, RouteBackContext, useRouteBack, type RouteBack } from '../routeBack'

describe('createRouteBack', () => {
  it('reports nothing handled with no handlers', () => {
    expect(createRouteBack().run()).toBe(false)
  })

  it('offers the press to the newest handler first and stops at the one that takes it', () => {
    const routeBack = createRouteBack()
    const older = vi.fn(() => true)
    const newer = vi.fn(() => true)
    routeBack.register(older)
    routeBack.register(newer)

    expect(routeBack.run()).toBe(true)
    expect(newer).toHaveBeenCalledOnce()
    expect(older).not.toHaveBeenCalled()
  })

  it('passes the press down when a handler declines it', () => {
    const routeBack = createRouteBack()
    const older = vi.fn(() => true)
    routeBack.register(older)
    routeBack.register(() => false)

    expect(routeBack.run()).toBe(true)
    expect(older).toHaveBeenCalledOnce()
  })

  it('forgets a handler once unregistered', () => {
    const routeBack = createRouteBack()
    const off = routeBack.register(() => true)
    off()
    expect(routeBack.run()).toBe(false)
  })
})

describe('useRouteBack', () => {
  function Page({ onBack }: { onBack: () => boolean }) {
    useRouteBack(onBack)
    return null
  }

  function tree(routeBack: RouteBack, active: boolean, children: ReactNode) {
    return (
      <RouteBackContext.Provider value={routeBack}>
        <PageActiveContext.Provider value={active}>{children}</PageActiveContext.Provider>
      </RouteBackContext.Provider>
    )
  }

  it('registers while its page is current and drops out when it is not', () => {
    const routeBack = createRouteBack()
    const onBack = vi.fn(() => true)
    const { rerender, unmount } = render(tree(routeBack, true, <Page onBack={onBack} />))
    expect(routeBack.run()).toBe(true)

    rerender(tree(routeBack, false, <Page onBack={onBack} />))
    expect(routeBack.run()).toBe(false)

    rerender(tree(routeBack, true, <Page onBack={onBack} />))
    unmount()
    expect(routeBack.run()).toBe(false)
  })

  it('always calls the latest handler', () => {
    const routeBack = createRouteBack()
    const first = vi.fn(() => true)
    const second = vi.fn(() => true)
    const { rerender } = render(tree(routeBack, true, <Page onBack={first} />))
    rerender(tree(routeBack, true, <Page onBack={second} />))

    routeBack.run()
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('offers the press to a nested handler before its parent', () => {
    const routeBack = createRouteBack()
    const calls: string[] = []
    const take = (who: string, taken: boolean) => () => {
      calls.push(who)
      return taken
    }
    function Parent({ children }: { children: ReactNode }) {
      useRouteBack(take('parent', true))
      return children
    }
    render(
      tree(
        routeBack,
        true,
        <Parent>
          <Page onBack={take('child', false)} />
        </Parent>,
      ),
    )

    expect(routeBack.run()).toBe(true)
    expect(calls).toEqual(['child', 'parent'])
  })

  it('keeps its rank when its page goes inactive and comes back', () => {
    const routeBack = createRouteBack()
    const outer = vi.fn(() => true)
    const inner = vi.fn(() => true)
    const page = (active: boolean) =>
      tree(
        routeBack,
        true,
        <>
          <Page onBack={outer} />
          <PageActiveContext.Provider value={active}>
            <Page onBack={inner} />
          </PageActiveContext.Provider>
        </>,
      )
    const { rerender } = render(page(true))
    rerender(page(false))
    rerender(page(true))

    routeBack.run()
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
  })
})
