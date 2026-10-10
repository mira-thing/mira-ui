import { useMemo, type ReactNode, type Ref } from 'react'
import { AmbientGround } from '@/components/AmbientGround'
import { ThemeContext, themeVars, useThemeSource, type ThemeInput } from './theme'

export interface ThemeProviderProps extends ThemeInput {
  className?: string
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
}

/**
 * The themed root: holds the theme's CSS variables, draws the ambient ground under its
 * children, and provides `useTheme()` to them.
 */
export function ThemeProvider({ art, narrating, className, ref, children }: ThemeProviderProps) {
  const theme = useThemeSource({ art, narrating })
  const style = useMemo(() => themeVars(theme), [theme])
  return (
    <ThemeContext.Provider value={theme}>
      <div ref={ref} className={className} style={style} data-theme={theme.source}>
        <AmbientGround />
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
