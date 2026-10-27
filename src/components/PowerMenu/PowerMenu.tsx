import { memo, useState } from 'react'
import { resetDevice, restartDevice, suspendDevice } from '@/api/system'
import { BRAND_NAME } from '@/brand'
import { MenuGrid, MenuLink, MenuSheet, MenuTile } from '@/components/Menu'
import { Layer } from '@/input/router'
import { useKnobNav } from '@/input/useKnobNav'
import styles from './PowerMenu.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSupport?: () => void
}

type Item = 'sleep' | 'restart' | 'reset' | 'support'
type ConfirmItem = 'cancel' | 'confirm'
const CONFIRM: readonly ConfirmItem[] = ['cancel', 'confirm']

// power menu
function PowerMenuImpl({ open, onClose, onSupport }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState<'sleep' | 'restart' | 'reset' | null>(null)

  const onSleep = () => {
    if (busy) return
    setBusy('sleep')
    void suspendDevice().catch(() => {})
    // screen goes dark
    onClose()
  }

  const onRestart = () => {
    if (busy) return
    setBusy('restart')
    void restartDevice().catch(() => setBusy(null))
    // leave busy true on success
  }

  const onConfirmReset = () => {
    if (busy) return
    setBusy('reset')
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
    void resetDevice().catch(() => setBusy(null))
  }

  const onAskReset = () => {
    setConfirmReset(true)
    // the safe choice is under the knob first
    confirm.setFocus('cancel')
  }

  const items: Item[] = onSupport
    ? ['sleep', 'restart', 'reset', 'support']
    : ['sleep', 'restart', 'reset']
  const actions: Record<Item, () => void> = {
    sleep: onSleep,
    restart: onRestart,
    reset: onAskReset,
    support: () => onSupport?.(),
  }
  const nav = useKnobNav({
    keys: items,
    onSelect: (item) => actions[item](),
    disabled: () => !!busy,
    enabled: open && !confirmReset,
    layer: Layer.modal,
  })
  const confirm = useKnobNav({
    keys: CONFIRM,
    onSelect: (item) => (item === 'cancel' ? setConfirmReset(false) : onConfirmReset()),
    disabled: () => busy === 'reset',
    enabled: open && confirmReset,
    layer: Layer.modal,
  })

  // every open starts fresh at the top. not on close, so the sheet leaves as it was
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setConfirmReset(false)
      setBusy(null)
      nav.setFocus(items[0])
    }
  }

  return (
    <MenuSheet
      open={open}
      onClose={onClose}
      title={confirmReset ? 'Reset device?' : 'Power'}
      edge="top"
    >
      {confirmReset ? (
        <div key="confirm" className={styles.view}>
          <p className={styles.body}>
            This forgets your Spotify sign-in and all paired phones, then restarts. You'll need to
            pair and sign in again.
          </p>
          <MenuGrid columns={2}>
            <MenuTile
              icon="close"
              label="Cancel"
              detail="Keep everything"
              {...confirm.itemProps('cancel')}
            />
            <MenuTile
              icon="trash"
              label="Reset"
              detail={busy === 'reset' ? 'Resetting...' : 'Erase & restart'}
              tone="danger"
              {...confirm.itemProps('confirm')}
            />
          </MenuGrid>
        </div>
      ) : (
        <div key="actions" className={styles.view}>
          <MenuGrid columns={3}>
            <MenuTile icon="moon" label="Sleep" detail="Screen off" {...nav.itemProps('sleep')} />
            <MenuTile
              icon="restart"
              label="Restart"
              detail={busy === 'restart' ? 'Restarting...' : 'Reboot'}
              {...nav.itemProps('restart')}
            />
            <MenuTile
              icon="trash"
              label="Reset"
              detail="Sign out & unpair"
              tone="danger"
              {...nav.itemProps('reset')}
            />
          </MenuGrid>
          {onSupport ? (
            <MenuLink
              icon="heart"
              label={`Support ${BRAND_NAME}`}
              tone="support"
              {...nav.itemProps('support')}
            />
          ) : null}
        </div>
      )}
    </MenuSheet>
  )
}

export const PowerMenu = memo(PowerMenuImpl)
