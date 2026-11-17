import { EmptyState } from '@/ui/EmptyState'
import { Page, PageHeader } from '@/ui/Page'

/** The user's playlists. A placeholder until the library is wired up. */
export function PlaylistsPage() {
  return (
    <Page header={<PageHeader title="Playlists" subtitle="Your library" />}>
      <EmptyState
        size="page"
        icon="playlist"
        title="No playlists yet"
        body="Your Spotify playlists will show up here."
      />
    </Page>
  )
}
