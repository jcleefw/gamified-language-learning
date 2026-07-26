import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | null

/**
 * Drives the `data-theme` attribute on <html>. `null` means "follow the OS"
 * (no attribute set); toggling picks the opposite of whatever is currently shown.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') as Theme) ?? null,
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme) root.setAttribute('data-theme', theme)
    else root.removeAttribute('data-theme')
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((cur) => {
      if (cur === 'dark') return 'light'
      if (cur === 'light') return 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'
    })
  }, [])

  return [theme, toggle]
}
