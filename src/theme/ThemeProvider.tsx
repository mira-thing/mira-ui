import type { ReactNode, Ref } from 'react'
import { AmbientGround } from '@/components/AmbientGround'
import { ThemeContext, useThemeSource, type ThemeInput } from './theme'

export interface ThemeProviderProps extends ThemeInput {
  className?: string
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
}

/**
 * The themed root: marks the theme source, draws the ambient ground under its children, and
 * provides `useTheme()` to them. The colours go on the surfaces that read them, not here.
 */
export function ThemeProvider({ art, narrating, className, ref, children }: ThemeProviderProps) {
  const theme = useThemeSource({ art, narrating })
  return (
    <ThemeContext.Provider value={theme}>
      <div ref={ref} className={className} data-theme={theme.source}>
        <AmbientGround />
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
