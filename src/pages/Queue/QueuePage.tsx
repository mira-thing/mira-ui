import { EmptyState } from '@/ui/EmptyState'
import { Page, PageHeader } from '@/ui/Page'

/** What plays next. A placeholder until the queue is wired up. */
export function QueuePage() {
  return (
    <Page header={<PageHeader title="Queue" subtitle="Up next" />}>
      <EmptyState
        size="page"
        icon="queue"
        title="Nothing queued"
        body="Tracks you queue will show up here."
      />
    </Page>
  )
}
