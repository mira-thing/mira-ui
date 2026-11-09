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
const CONFIRM: readonly ConfirmItem[] = ['confirm', 'cancel']

// power menu
function PowerMenuImpl({ open, onClose, onSupport }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState<'sleep' | 'restart' | 'reset' | null>(null)
  const [resetFailed, setResetFailed] = useState(false)

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
    setResetFailed(false)
    void resetDevice().then(
      () => {
        try {
          window.localStorage.clear()
        } catch {
          // ignore
        }
      },
      () => {
        setBusy(null)
        setResetFailed(true)
      },
    )
  }

  const onAskReset = () => {
    setConfirmReset(true)
    setResetFailed(false)
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
      setResetFailed(false)
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
              icon="trash"
              label="Reset"
              detail={
                busy === 'reset'
                  ? 'Resetting...'
                  : resetFailed
                    ? "Didn't reset, try again"
                    : 'Erase & restart'
              }
              tone="danger"
              {...confirm.itemProps('confirm')}
            />
            <MenuTile
              icon="close"
              label="Cancel"
              detail="Keep everything"
              {...confirm.itemProps('cancel')}
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
