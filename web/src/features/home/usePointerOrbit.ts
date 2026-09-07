import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

export type SignalPointer = {
  x: number
  y: number
}

function formatPointerValue(value: number) {
  return String(Number(value.toFixed(3)))
}

export function usePointerOrbit(enabled: boolean) {
  const containerRef = useRef<HTMLElement>(null)
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef<SignalPointer>({ x: 0, y: 0 })
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element || !enabled || typeof window === 'undefined') return

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    let motionIsReduced = mediaQuery?.matches ?? false

    const applyPointer = () => {
      frameRef.current = null
      element.style.setProperty('--orbit-x', `${(pointerRef.current.x * 9).toFixed(2)}px`)
      element.style.setProperty('--orbit-y', `${(pointerRef.current.y * 6).toFixed(2)}px`)
      element.style.setProperty('--signal-pointer-x', formatPointerValue(pointerRef.current.x))
      element.style.setProperty('--signal-pointer-y', formatPointerValue(pointerRef.current.y))
    }

    const schedulePointer = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(applyPointer)
      }
    }

    const resetPointer = () => {
      pointerRef.current = { x: 0, y: 0 }
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      applyPointer()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (motionIsReduced || event.pointerType === 'touch') return
      const bounds = element.getBoundingClientRect()
      const clientX = Number(event.clientX)
      const clientY = Number(event.clientY)
      if (bounds.width === 0 || bounds.height === 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return
      pointerRef.current = {
        x: ((clientX - bounds.left) / bounds.width - 0.5) * 2,
        y: ((clientY - bounds.top) / bounds.height - 0.5) * 2,
      }
      schedulePointer()
    }

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      motionIsReduced = event.matches
      setReducedMotion(event.matches)
      if (event.matches) resetPointer()
    }

    element.style.setProperty('--orbit-x', '0px')
    element.style.setProperty('--orbit-y', '0px')
    element.style.setProperty('--signal-pointer-x', '0')
    element.style.setProperty('--signal-pointer-y', '0')
    element.addEventListener('pointermove', handlePointerMove)
    element.addEventListener('pointerleave', resetPointer)
    element.addEventListener('pointercancel', resetPointer)
    mediaQuery?.addEventListener('change', handleReducedMotionChange)

    return () => {
      element.removeEventListener('pointermove', handlePointerMove)
      element.removeEventListener('pointerleave', resetPointer)
      element.removeEventListener('pointercancel', resetPointer)
      mediaQuery?.removeEventListener('change', handleReducedMotionChange)
      resetPointer()
    }
  }, [enabled])

  return {
    containerRef,
    pointerRef,
    reducedMotion,
    style: {
      '--orbit-x': '0px',
      '--orbit-y': '0px',
      '--signal-pointer-x': '0',
      '--signal-pointer-y': '0',
    } as CSSProperties,
  }
}
