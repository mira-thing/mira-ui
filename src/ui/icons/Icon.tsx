import { createElement, type ReactElement, type SVGAttributes } from 'react'
import { ICONS, type IconDef, type IconName, type IconNode } from './paths'

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName
  /** width and height in px */
  size?: number
  /** labels the icon for assistive tech; without it the icon is hidden from it */
  title?: string
}

function renderNode(node: IconNode, key: number): ReactElement {
  if (node[0] === 'g') return createElement('g', { key, ...node[1] }, node[2].map(renderNode))
  return createElement(node[0], { key, ...node[1] })
}

export function Icon({ name, size = 24, title, ...rest }: IconProps) {
  const { viewBox, attrs, nodes }: IconDef = ICONS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      {...attrs}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {nodes.map(renderNode)}
    </svg>
  )
}
