import { memo, useState } from 'react'
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  updateSettings,
  useSettings,
  VOLUME_STEP_MAX,
  VOLUME_STEP_MIN,
} from '@/settings'
import { NotchedSlider, SettingRow } from '@/ui/controls'
import { Icon } from '@/ui/icons'
import styles from './SettingsSheet.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  // active device is a phone
  phoneVolume?: boolean
}

const OFFSET_MIN = -500
const OFFSET_MAX = 500
const OFFSET_STEP = 50

function fmtOffset(ms: number): string {
  if (ms === 0) return '0 ms'
  return `${ms > 0 ? '+' : ''}${ms} ms`
}

function SettingsSheetImpl({ open, onClose, phoneVolume = false }: Props) {
  const { lyricOffsetMs, volumeStepPct, autoBrightness, brightness, uiScalePct } = useSettings()

  // applying the scale mid-drag moves this very panel under the finger, which has no
  // fixed point near a notch boundary and makes the whole ui flicker between two sizes.
  // so track the drag locally and only commit on release
  const [scalePreview, setScalePreview] = useState<number | null>(null)
  // drop an uncommitted drag if the sheet is dismissed mid-gesture
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (scalePreview !== null) setScalePreview(null)
  }
  const shownScale = scalePreview ?? uiScalePct

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.title}>Settings</div>

        {/* first on purpose: at the largest display size the panel scrolls, and this is
            the one control that has to stay reachable to get back down */}
        <SettingRow
          icon={<Icon name="displaySize" size={20} />}
          label="Display size"
          value={`${shownScale}%`}
        >
          <NotchedSlider
            ariaLabel="Display size"
            value={shownScale}
            min={UI_SCALE_MIN}
            max={UI_SCALE_MAX}
            step={UI_SCALE_STEP}
            onChange={setScalePreview}
            onCommit={(v) => {
              setScalePreview(null)
              // the sheet was dismissed mid-gesture, so drop the drag instead of
              // resizing the whole ui after it's gone
              if (!open) return
              updateSettings({ uiScalePct: v })
            }}
            onCancel={() => setScalePreview(null)}
            format={(v) => `${v}%`}
            defaultValue={UI_SCALE_DEFAULT}
          />
        </SettingRow>

        <SettingRow
          icon={<Icon name="lyrics" size={20} />}
          label="Lyric sync"
          value={fmtOffset(lyricOffsetMs)}
        >
          <NotchedSlider
            ariaLabel="Lyric sync offset"
            value={lyricOffsetMs}
            min={OFFSET_MIN}
            max={OFFSET_MAX}
            step={OFFSET_STEP}
            onChange={(v) => updateSettings({ lyricOffsetMs: v })}
            format={fmtOffset}
            defaultValue={0}
          />
        </SettingRow>

        <SettingRow
          icon={<Icon name="speaker" size={20} />}
          label="Volume per turn"
          value={phoneVolume ? 'Set by phone' : `${volumeStepPct}%`}
        >
          <NotchedSlider
            ariaLabel="Volume per turn"
            value={volumeStepPct}
            min={VOLUME_STEP_MIN}
            max={VOLUME_STEP_MAX}
            step={1}
            onChange={(v) => updateSettings({ volumeStepPct: v })}
            format={(v) => `${v}%`}
            disabled={phoneVolume}
            defaultValue={2}
          />
        </SettingRow>

        <SettingRow
          icon={<Icon name="sun" size={20} />}
          label="Brightness"
          value={autoBrightness ? 'Auto' : `${brightness * 10}%`}
          iconSwitch={{
            checked: autoBrightness,
            onChange: (on) => updateSettings({ autoBrightness: on }),
            label: 'Auto brightness',
          }}
        >
          <NotchedSlider
            ariaLabel="Brightness"
            value={brightness}
            min={BRIGHTNESS_MIN}
            max={BRIGHTNESS_MAX}
            step={1}
            onChange={(v) => updateSettings({ brightness: v })}
            format={(v) => `${v * 10}%`}
            disabled={autoBrightness}
            defaultValue={5}
          />
        </SettingRow>
      </div>
    </div>
  )
}

export const SettingsSheet = memo(SettingsSheetImpl)
