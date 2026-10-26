import type { SVGAttributes } from 'react'

type Attrs = SVGAttributes<SVGElement>

export type IconNode =
  readonly ['path' | 'circle' | 'rect' | 'line', Attrs] | readonly ['g', Attrs, readonly IconNode[]]

export interface IconDef {
  viewBox: string
  /** presentation attributes on the root svg, inherited by every node */
  attrs?: Attrs
  nodes: readonly IconNode[]
}

const path = (d: string, attrs?: Attrs): IconNode => ['path', { d, ...attrs }]

function filled16(...paths: string[]): IconDef {
  return {
    viewBox: '0 0 16 16',
    attrs: { fill: 'currentColor' },
    nodes: paths.map((d) => path(d, { fillRule: 'evenodd', clipRule: 'evenodd' })),
  }
}

function filled24(...nodes: IconNode[]): IconDef {
  return { viewBox: '0 0 24 24', attrs: { fill: 'currentColor' }, nodes }
}

function stroked24(strokeWidth: string, ...nodes: IconNode[]): IconDef {
  return {
    viewBox: '0 0 24 24',
    attrs: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    nodes,
  }
}

function mixed24(...nodes: IconNode[]): IconDef {
  return { viewBox: '0 0 24 24', attrs: { fill: 'none' }, nodes }
}

function device(d: string): IconDef {
  return {
    viewBox: '0 0 24 24',
    attrs: { fill: 'currentColor', fillRule: 'evenodd', clipRule: 'evenodd' },
    nodes: [path(d)],
  }
}

const skip = (previous: boolean) =>
  filled24([
    'g',
    { transform: previous ? 'translate(24 0) scale(-1 1)' : undefined },
    [
      path(
        'M6.1 5.6C5.48 5.19 4.7 5.63 4.7 6.35v11.3c0 .72.78 1.16 1.4.75l8.8-5.55c.63-.4.63-1.3 0-1.7Z',
      ),
      ['rect', { x: '17', y: '5', width: '2.4', height: '14', rx: '1.2' }],
    ],
  ])

const banner = (...nodes: IconNode[]) => stroked24('1.8', ...nodes)
const line2 = (...nodes: IconNode[]) => stroked24('2', ...nodes)

const STROKE_2 = { stroke: 'currentColor', strokeWidth: '2' } as const
const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const STAR =
  'M12 2.5l2.9 6.05 6.6.72-4.9 4.49 1.34 6.52L12 17l-5.94 3.28 1.34-6.52-4.9-4.49 6.6-.72L12 2.5z'
const VOLUME_BODY =
  'M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88'

export const ICONS = {
  // transport and player, 16-grid filled
  shuffle: filled16(
    'M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z',
    'm7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z',
  ),
  repeat: filled16(
    'M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z',
  ),
  repeatOne: filled16(
    'M0 4.75A3.75 3.75 0 0 1 3.75 1h.75v1.5h-.75A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75zM12.25 2.5a2.25 2.25 0 0 1 2.25 2.25v5A2.25 2.25 0 0 1 12.25 12H9.81l1.018-1.018a.75.75 0 0 0-1.06-1.06L6.939 12.75l2.829 2.828a.75.75 0 1 0 1.06-1.06L9.811 13.5h2.439A3.75 3.75 0 0 0 16 9.75v-5A3.75 3.75 0 0 0 12.25 1h-.75v1.5z',
    'm8 1.85.77.694H6.095V1.488q1.046-.077 1.507-.385.474-.308.583-.913h1.32V8H8z',
    'M8.77 2.544 8 1.85v.693z',
  ),
  dj: filled16(
    'M7.813 14.497A6.5 6.5 0 0 1 1.5 8.016c.008-3.553 2.71-5.744 5.043-6.078.85-.121 1.288.037 1.564.246.312.238.553.639.822 1.276q.115.277.239.602c.451 1.167 1.05 2.717 2.505 3.81 1.01.76 1.46 1.529 1.592 2.209.13.679-.037 1.375-.468 2.03-.88 1.34-2.793 2.388-4.844 2.388zm-.037 1.5A8 8 0 1 0 0 8.032c0 4.34 3.464 7.87 7.776 7.965m6.666-7.124c-.358-.788-.979-1.532-1.868-2.2-1.082-.813-1.51-1.9-1.967-3.06a31 31 0 0 0-.296-.736 6.3 6.3 0 0 0-.605-1.151 6.53 6.53 0 0 1 4.39 4.01 6.5 6.5 0 0 1 .346 3.137',
  ),
  seekBack15: filled16(
    'M2.464 4.5h1.473a.75.75 0 0 1 0 1.5H0V2.063a.75.75 0 0 1 1.5 0v1.27a8.25 8.25 0 1 1 10.539 12.554.75.75 0 0 1-.828-1.25A6.75 6.75 0 1 0 2.464 4.5',
    'M0 10.347V9.291q1.045-.077 1.507-.385.473-.308.583-.913h1.32v7.81H1.903v-5.456zm7.322 5.643q-.814 0-1.463-.297a2.46 2.46 0 0 1-1.023-.869q-.375-.583-.396-1.386h1.518q.01.363.176.638.165.274.45.43.287.153.66.153.385 0 .672-.176.297-.176.45-.495.165-.319.166-.726 0-.407-.165-.715a1.14 1.14 0 0 0-.451-.495 1.25 1.25 0 0 0-.671-.176q-.43 0-.748.21a1.23 1.23 0 0 0-.462.516H4.56L5 7.993h4.642V9.39H6.207l-.211 2.134q.086-.162.237-.319a1.8 1.8 0 0 1 .616-.407q.373-.154.814-.154.681 0 1.22.308.55.309.859.88.308.572.308 1.331 0 .792-.33 1.441-.33.639-.957 1.012-.616.375-1.441.374',
  ),
  seekForward15: filled16(
    'M13.536 4.488h-1.473a.75.75 0 1 0 0 1.5H16V2.051a.75.75 0 0 0-1.5 0v1.27A8.25 8.25 0 1 0 3.962 15.876a.75.75 0 0 0 .826-1.252 6.75 6.75 0 1 1 8.747-10.136Z',
    'M11.81 15.681q.65.297 1.464.297.825 0 1.44-.374.628-.374.958-1.012.33-.649.33-1.44 0-.76-.308-1.332a2.16 2.16 0 0 0-.858-.88 2.4 2.4 0 0 0-1.221-.308q-.44 0-.814.154a1.8 1.8 0 0 0-.616.407q-.15.157-.237.319l.211-2.134h3.436V7.981h-4.642l-.44 4.61h1.474a1.24 1.24 0 0 1 .462-.518q.318-.21.748-.209.384 0 .67.176.298.177.452.495.165.309.165.715 0 .408-.165.726a1.14 1.14 0 0 1-.451.495 1.25 1.25 0 0 1-.671.176q-.375 0-.66-.154a1.16 1.16 0 0 1-.451-.429 1.3 1.3 0 0 1-.176-.638h-1.518q.021.804.396 1.386a2.46 2.46 0 0 0 1.023.87Zm-5.858-5.346V9.28q1.045-.077 1.507-.385.473-.308.583-.913h1.32v7.81H7.855v-5.456z',
  ),
  saveOutline: filled16(
    'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8',
    'M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75',
  ),
  saveFilled: filled16(
    'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m11.748-1.97a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.405-1.406a.75.75 0 1 0-1.061 1.06l2.466 2.467 5.53-5.53z',
  ),
  volumeMuted: filled16(
    'M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z',
    'M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.64 3.64 0 0 0-1.33 4.967 3.64 3.64 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.7 4.7 0 0 1-1.5-.694v1.3L2.817 9.852a2.14 2.14 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694z',
  ),
  volumeLow: filled16(VOLUME_BODY),
  volumeMedium: filled16(
    'M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a3 3 0 0 1 0 5.175z',
  ),
  volumeHigh: filled16(
    VOLUME_BODY,
    'M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z',
  ),

  // 24-grid filled
  prev: skip(true),
  next: skip(false),
  playFilled: filled24(path('M6 4l14 8-14 8z')),
  more: filled24(
    ['circle', { cx: '5', cy: '12', r: '2' }],
    ['circle', { cx: '12', cy: '12', r: '2' }],
    ['circle', { cx: '19', cy: '12', r: '2' }],
  ),
  heart: filled24(
    path(
      'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    ),
  ),
  moon: mixed24(path('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', { fill: 'currentColor' })),
  devicePhone: device(
    'M5 5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM13.25 16.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z',
  ),
  deviceComputer: device(
    'M0 21a1 1 0 0 1 1-1h22a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1M3 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z',
  ),
  deviceGeneric: device(
    'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z',
  ),

  // notification banner, 24-grid stroke 1.8
  info: banner(['circle', { cx: '12', cy: '12', r: '9' }], path('M12 11v6m0-10v.1')),
  success: banner(['circle', { cx: '12', cy: '12', r: '9' }], path('m8 12 3 3 5-6')),
  warning: banner(
    path('M10.3 4a2 2 0 0 1 3.4 0l7 12a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3Z'),
    path('M12 8v4m0 3v.1'),
  ),
  error: banner(['circle', { cx: '12', cy: '12', r: '9' }], path('m9 9 6 6m0-6-6 6')),
  microphone: banner(
    ['rect', { x: '9', y: '3', width: '6', height: '12', rx: '3' }],
    path('M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6'),
  ),
  microphoneOff: banner(
    ['rect', { x: '9', y: '3', width: '6', height: '12', rx: '3' }],
    path('M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6M4 3l16 18'),
  ),
  thinking: banner(
    ['circle', { cx: '5', cy: '12', r: '1' }],
    ['circle', { cx: '12', cy: '12', r: '1' }],
    ['circle', { cx: '19', cy: '12', r: '1' }],
  ),
  play: banner(path('m8 4 12 8-12 8Z')),
  playlistPlay: banner(path('M4 5h16M4 10h10M4 15h6m5-1 6 4-6 4Z')),
  bluetooth: banner(path('m7 7 10 10-5 4V3l5 4L7 17')),

  // 24-grid stroke 2
  bluetoothLarge: line2(path('M6.5 6.5l11 11-5.5 5.5V1l5.5 5.5-11 11')),
  computer: line2(
    ['rect', { x: '2', y: '3', width: '20', height: '14', rx: '2' }],
    ['line', { x1: '8', y1: '21', x2: '16', y2: '21' }],
    ['line', { x1: '12', y1: '17', x2: '12', y2: '21' }],
  ),
  trash: mixed24(path('M6 7h12M9 7V5h6v2M7 7l1 12h8l1-12', { ...STROKE_2, ...ROUND })),
  restart: mixed24(
    path('M19 12a7 7 0 1 1-2.05-4.95', { ...STROKE_2, strokeLinecap: 'round' }),
    path('M19 4v4h-4', { ...STROKE_2, ...ROUND }),
  ),
  plus: mixed24(path('M12 5v14M5 12h14', { ...STROKE_2, strokeLinecap: 'round' })),
  playlist: line2(
    path('M4 6h10M4 11h10M4 16h6'),
    ['circle', { cx: '15.5', cy: '18', r: '2.5' }],
    path('M18 18V8.5l3 1'),
  ),
  queue: line2(path('M4 6h16M4 11h16M4 16h7M17 14v6M14 17h6')),
  sliders: line2(
    path('M4 8h2.5M11.5 8H20M4 16h8.5M17.5 16H20'),
    ['circle', { cx: '9', cy: '8', r: '2.5' }],
    ['circle', { cx: '15', cy: '16', r: '2.5' }],
  ),
  phone: line2(
    ['rect', { x: '7', y: '3', width: '10', height: '18', rx: '2' }],
    path('M11 17.5h2'),
  ),
  textLines: line2(path('M4 6h16M4 12h11M4 18h7')),
  speakerBox: line2(
    ['rect', { x: '6', y: '3', width: '12', height: '18', rx: '2.5' }],
    ['circle', { cx: '12', cy: '14', r: '3' }],
    ['circle', { cx: '12', cy: '7.5', r: '0.6', fill: 'currentColor' }],
  ),
  gear: line2(
    ['circle', { cx: '12', cy: '12', r: '3' }],
    path(
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    ),
  ),
  chevronRight: line2(path('M9 6l6 6-6 6')),

  // 24-grid, stroke and fill set per node
  lyrics: mixed24(
    path('M9 18V6l10-2v10', { ...STROKE_2, ...ROUND }),
    ['circle', { cx: '6.5', cy: '18', r: '2.5', fill: 'currentColor' }],
    ['circle', { cx: '16.5', cy: '16', r: '2.5', fill: 'currentColor' }],
  ),
  speaker: mixed24(
    path('M4 9.5v5h3.2L12 18.7V5.3L7.2 9.5H4z', {
      fill: 'currentColor',
      stroke: 'currentColor',
      strokeWidth: '1.4',
      strokeLinejoin: 'round',
    }),
    path('M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11', {
      ...STROKE_2,
      strokeLinecap: 'round',
    }),
  ),
  sun: mixed24(
    ['circle', { cx: '12', cy: '12', r: '4', ...STROKE_2 }],
    path(
      'M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8',
      { ...STROKE_2, strokeLinecap: 'round' },
    ),
  ),
  displaySize: mixed24(
    ['rect', { x: '2.5', y: '4.5', width: '19', height: '15', rx: '2.5', ...STROKE_2 }],
    path('M8.5 15V9.8m0 0H6.9m1.6 0h1.6M15.5 15V8.2m0 0h-2.1m2.1 0h2.1', {
      stroke: 'currentColor',
      strokeWidth: '1.8',
      strokeLinecap: 'round',
    }),
  ),
  lock: mixed24(
    ['rect', { x: '5', y: '10', width: '14', height: '9', rx: '2', fill: 'currentColor' }],
    path('M8 10V7.5a4 4 0 0 1 8 0V10', { stroke: 'currentColor', strokeWidth: '1.7' }),
  ),
  star: {
    viewBox: '0 0 24 24',
    nodes: [
      path(STAR, {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.8',
        strokeLinejoin: 'round',
      }),
    ],
  },
  starFilled: {
    viewBox: '0 0 24 24',
    nodes: [
      path(STAR, {
        fill: 'currentColor',
        stroke: 'currentColor',
        strokeWidth: '1.8',
        strokeLinejoin: 'round',
      }),
    ],
  },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS

/** The glyph for a Spotify Connect device type; unknown types get the generic device. */
export function deviceIconName(type: string): IconName {
  switch (type.toUpperCase()) {
    case 'SMARTPHONE':
    case 'TABLET':
      return 'devicePhone'
    case 'COMPUTER':
    case 'CHROMEBOOK':
      return 'deviceComputer'
    default:
      return 'deviceGeneric'
  }
}
