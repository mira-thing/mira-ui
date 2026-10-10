import { useMemo, useState, type ReactNode } from 'react'
import { useKnobNav } from '@/input/useKnobNav'
import { Artwork } from '@/ui/Artwork'
import { Button, IconButton, PlayPauseButton, type ButtonVariant } from '@/ui/Button'
import { Card, Carousel, IconTile } from '@/ui/Carousel'
import { NotchedSlider, SettingRow, Switch } from '@/ui/controls'
import { Dialog } from '@/ui/Dialog'
import { EmptyState } from '@/ui/EmptyState'
import { Icon, ICONS, type IconName } from '@/ui/icons'
import { KnobList, ListRow, listKeys, SectionHeader } from '@/ui/List'
import { Page, PageHeader } from '@/ui/Page'
import { Surface, type SurfaceVariant } from '@/ui/Surface'
import { TrackText } from '@/ui/TrackText'
import { CARDS, FALLBACKS, makeKitData, rowKey, type KitCard, type KitRow } from './uiKitData'
import { useZoomOverride, zoomOptions } from './useZoomOverride'
import styles from './UiKitPage.module.scss'

type KnobTarget = 'carousel' | 'list'
type DialogMode = 'glass' | 'solid' | 'both'

const cardKey = (card: KitCard) => card.key
const SURFACES: { variant: SurfaceVariant; focused?: boolean; label: string }[] = [
  { variant: 'panel', label: 'panel' },
  { variant: 'bar', label: 'bar' },
  { variant: 'card', label: 'card' },
  { variant: 'card', focused: true, label: 'card focused' },
  { variant: 'floating', label: 'floating' },
]
const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost']

function Section({
  title,
  trailing,
  children,
}: {
  title: string
  trailing?: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <SectionHeader trailing={trailing} className={styles.sectionHeader}>
        {title}
      </SectionHeader>
      {children}
    </section>
  )
}

function Segmented<V extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly V[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      <span className={styles.segmentedLabel}>{label}</span>
      {options.map((o) => (
        <Button
          key={o}
          variant={o === value ? 'primary' : 'secondary'}
          aria-pressed={o === value}
          onClick={() => onChange(o)}
        >
          {String(o)}
        </Button>
      ))}
    </div>
  )
}

/** Dev only: every framework primitive on one page, under the album theme. */
export function UiKitPage() {
  const [{ track, arts, sections }] = useState(makeKitData)
  const cardKeys = useMemo(() => CARDS.map(cardKey), [])
  const rowKeys = useMemo(() => listKeys(sections, rowKey), [sections])
  const iconNames = Object.keys(ICONS) as IconName[]
  const [target, setTarget] = useState<KnobTarget>('carousel')
  const [dialog, setDialog] = useState<DialogMode | null>(null)
  const [opened, setOpened] = useState<{ key: string; count: number } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [zoom, setZoom] = useZoomOverride()
  const [paused, setPaused] = useState(false)
  const [artIndex, setArtIndex] = useState(0)
  const [on, setOn] = useState(true)
  const [level, setLevel] = useState(5)
  const [auto, setAuto] = useState(false)

  const carousel = useKnobNav({
    keys: cardKeys,
    onSelect: (key) =>
      setOpened((prev) => ({ key, count: prev?.key === key ? prev.count + 1 : 1 })),
    enabled: target === 'carousel',
  })
  const list = useKnobNav({
    keys: rowKeys,
    onSelect: setPicked,
    enabled: target === 'list',
  })
  const openedCard = CARDS.find((c) => c.key === opened?.key)
  const close = () => setDialog(null)
  const dialogBody = (
    <>
      <p className={styles.dialogText}>
        The same content on both surfaces. Tap the scrim or press Back to close.
      </p>
      <div className={styles.row}>
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={close}>
          Confirm
        </Button>
      </div>
    </>
  )
  const art = arts[artIndex % arts.length]

  return (
    <div className={styles.root}>
      <Page
        header={
          <PageHeader
            title="UI kit"
            subtitle="Framework primitives"
            trailing={
              <div className={styles.row}>
                <Segmented
                  label="Knob"
                  options={['carousel', 'list'] as const}
                  value={target}
                  onChange={setTarget}
                />
                <Segmented
                  label="Zoom"
                  options={zoomOptions(zoom)}
                  value={zoom}
                  onChange={setZoom}
                />
              </div>
            }
          />
        }
      >
        <Section title="Carousel" trailing="knob, press or tap">
          <div className={styles.carousel} onPointerDownCapture={() => setTarget('carousel')}>
            <Carousel
              items={CARDS}
              keyOf={cardKey}
              nav={carousel}
              renderItem={(card, { focused }) => (
                <Card
                  icon={card.icon}
                  title={card.title}
                  subtitle={card.subtitle}
                  focused={focused}
                />
              )}
            />
          </div>
          <p className={styles.note} aria-live="polite">
            {openedCard
              ? `Opened ${openedCard.title}${opened && opened.count > 1 ? ` ×${opened.count}` : ''}`
              : 'Nothing opened yet'}
          </p>
        </Section>

        <Section title="Icon tiles">
          <div className={styles.wrap}>
            <IconTile icon="queue" />
            <IconTile icon="queue" size="lg" />
          </div>
        </Section>

        <Section title="Surfaces">
          <div className={styles.wrap}>
            {SURFACES.map((s) => (
              <Surface
                key={s.label}
                variant={s.variant}
                focused={s.focused}
                cache={false}
                className={styles.swatch}
              >
                {s.label}
              </Surface>
            ))}
          </div>
        </Section>

        <Section title="Icon buttons">
          <div className={styles.wrap}>
            <IconButton icon="shuffle" label="xs" size="xs" />
            <IconButton icon="prev" label="sm" size="sm" />
            <IconButton icon="next" label="md" size="md" />
            <IconButton icon="more" label="lg" size="lg" />
            <IconButton icon="heart" label="active" active />
            <IconButton icon="heart" label="focused" focused />
            <IconButton icon="heart" label="disabled" disabled />
            <PlayPauseButton isPaused={paused} onPress={() => setPaused((p) => !p)} />
            <PlayPauseButton isPaused={paused} size="mini" onPress={() => setPaused((p) => !p)} />
          </div>
        </Section>

        <Section title="Buttons">
          <div className={styles.wrap}>
            {BUTTON_VARIANTS.map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
            <Button variant="primary" size="lg" icon="playFilled">
              lg
            </Button>
            <Button icon="restart" focused>
              focused
            </Button>
            <Button disabled>disabled</Button>
          </div>
        </Section>

        <Section title="Artwork">
          <div className={styles.wrap}>
            <figure className={styles.figure}>
              <Artwork src={art} size={120} />
              <figcaption>crossfade</figcaption>
            </figure>
            <figure className={styles.figure}>
              <Artwork src={art} size={120} crossfade={false} />
              <figcaption>single layer</figcaption>
            </figure>
            {FALLBACKS.map((f) => (
              <figure key={f} className={styles.figure}>
                <Artwork src={undefined} size={96} radius="sm" fallback={f} />
                <figcaption>{f}</figcaption>
              </figure>
            ))}
            <Button icon="next" onClick={() => setArtIndex((i) => i + 1)}>
              Next art
            </Button>
          </div>
        </Section>

        <Section title="Track text">
          <div className={styles.wrap}>
            {(['mini', 'panel', 'hero'] as const).map((size) => (
              <div key={size} className={`${styles.trackText} ${styles[size]}`}>
                <TrackText title={track.title} artist={track.artist} size={size} />
              </div>
            ))}
            <div className={`${styles.trackText} ${styles.panel}`}>
              <TrackText
                title="A title long enough to need the marquee"
                artist={track.artist}
                size="panel"
              />
            </div>
          </div>
        </Section>

        <Section title="Knob list" trailing={picked ? `picked ${picked}` : undefined}>
          <div className={styles.list} onPointerDownCapture={() => setTarget('list')}>
            <KnobList<KitRow, string>
              sections={sections}
              keyOf={rowKey}
              nav={list}
              rowHeight={60}
              renderRow={(row, { focused }) => (
                <ListRow
                  leading={
                    row.icon ? (
                      <Icon name={row.icon} size={22} />
                    ) : (
                      <Artwork
                        src={row.art}
                        size={40}
                        radius="sm"
                        crossfade={false}
                        fallback="playlist"
                      />
                    )
                  }
                  title={row.title}
                  subtitle={row.subtitle}
                  value={row.value}
                  tone={row.tone}
                  disabled={row.disabled}
                  variant={row.pill ? 'pill' : 'plain'}
                  focused={focused}
                  active={row.key === picked}
                />
              )}
              empty={<EmptyState title="Nothing here" />}
            />
          </div>
        </Section>

        <Section title="Section header">
          <SectionHeader trailing="2 tracks">Next in queue</SectionHeader>
        </Section>

        <Section title="Empty states">
          <div className={styles.wrap}>
            <div className={styles.emptyBox}>
              <EmptyState icon="queue" title="Nothing queued" body="Add songs from your phone." />
            </div>
            <div className={styles.emptyBox}>
              <EmptyState
                icon="playlist"
                size="page"
                title="Playlists are coming soon"
                body="Your library will show here."
              />
            </div>
          </div>
        </Section>

        <Section title="Controls">
          <div className={styles.controls}>
            <div className={styles.row}>
              <Switch checked={on} onChange={setOn} label="Example switch" />
              <span className={styles.note}>{on ? 'On' : 'Off'}</span>
            </div>
            <SettingRow
              icon={<Icon name="speaker" size={20} />}
              label="Setting row"
              value={`${level}`}
            >
              <NotchedSlider
                ariaLabel="Setting row"
                value={level}
                min={1}
                max={10}
                step={1}
                onChange={setLevel}
                format={String}
                defaultValue={5}
              />
            </SettingRow>
            <SettingRow
              icon={<Icon name="sun" size={20} />}
              label="With an icon switch"
              value={auto ? 'Auto' : `${level * 10}%`}
              iconSwitch={{ checked: auto, onChange: setAuto, label: 'Auto' }}
            >
              <NotchedSlider
                ariaLabel="With an icon switch"
                value={level}
                min={1}
                max={10}
                step={1}
                onChange={setLevel}
                format={(v) => `${v * 10}%`}
                disabled={auto}
              />
            </SettingRow>
            <NotchedSlider
              ariaLabel="Bare slider"
              value={level}
              min={1}
              max={10}
              step={1}
              onChange={setLevel}
              format={String}
            />
          </div>
        </Section>

        <Section title="Icons" trailing={`${iconNames.length}`}>
          <div className={styles.icons}>
            {iconNames.map((name) => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} size={28} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Dialogs">
          <div className={styles.row}>
            <Button onClick={() => setDialog('glass')}>Glass</Button>
            <Button onClick={() => setDialog('solid')}>Solid</Button>
            <Button variant="primary" onClick={() => setDialog('both')}>
              Side by side
            </Button>
          </div>
        </Section>
      </Page>

      <Dialog open={dialog === 'glass'} surface="glass" title="Glass dialog" onClose={close}>
        {dialogBody}
      </Dialog>
      <Dialog open={dialog === 'solid'} surface="solid" title="Solid dialog" onClose={close}>
        {dialogBody}
      </Dialog>
      {dialog === 'both' ? (
        <div className={styles.compare}>
          <div className={styles.half}>
            <Dialog open surface="glass" width="sm" title="Glass" onClose={close}>
              {dialogBody}
            </Dialog>
          </div>
          <div className={styles.half}>
            <Dialog open surface="solid" width="sm" title="Solid" onClose={close}>
              {dialogBody}
            </Dialog>
          </div>
        </div>
      ) : null}
    </div>
  )
}
