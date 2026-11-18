import type { ReactNode } from 'react'
import type { UsePagedList } from '@/hooks/pagedCache'
import type { KnobItemProps } from '@/input/useKnobNav'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ListRow } from '@/ui/List'
import { libraryErrorText } from './libraryCache'
import styles from './LibraryStates.module.scss'

/** The knob key of a list's error retry and of its trailing loading-more row. */
export const RETRY_KEY = '__retry'
export const MORE_KEY = '__more'

export function LibraryLoading({ label }: { label: string }) {
  return (
    <div className={styles.fill} role="status">
      <EmptyState size="page" title={label} />
    </div>
  )
}

export interface LibraryErrorProps {
  title: string
  message: string
  retry: KnobItemProps
}

/** A failed first page, with a retry the knob or a tap can press. */
export function LibraryError({ title, message, retry }: LibraryErrorProps) {
  const { focused, disabled, onClick, 'aria-selected': selected } = retry
  return (
    <div className={styles.fill} role="alert">
      <EmptyState size="page" icon="warning" title={title} body={message} />
      <Button
        variant="primary"
        icon="restart"
        focused={focused}
        disabled={disabled}
        aria-selected={selected}
        onClick={onClick}
        className={styles.retry}
      >
        Try again
      </Button>
    </div>
  )
}

/** The row after the last loaded one: loading the next page, or offering to retry it. */
export function MoreRow({ failed, focused }: { failed: boolean; focused: boolean }) {
  return (
    <ListRow
      title={failed ? "Couldn't load more" : 'Loading more...'}
      value={failed ? 'Retry' : undefined}
      disabled={!failed}
      focused={focused}
    />
  )
}

export interface LibraryBodyProps {
  list: Pick<UsePagedList<unknown, unknown>, 'loaded' | 'error' | 'failedFirst'>
  loadingLabel: string
  errorTitle: string
  retry: KnobItemProps
  /** the list, once its first page is in */
  children: ReactNode
}

/** A paged list's page body: loading, a failed first page, or the list itself. */
export function LibraryBody({ list, loadingLabel, errorTitle, retry, children }: LibraryBodyProps) {
  if (list.failedFirst) {
    return <LibraryError title={errorTitle} message={libraryErrorText(list.error)} retry={retry} />
  }
  if (!list.loaded) return <LibraryLoading label={loadingLabel} />
  return children
}
