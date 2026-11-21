'use client'

import { useSyncExternalStore } from 'react'

// ---- clock --------------------------------------------------------------------------------------
// One shared 1 s ticker. Server snapshot is 0 so markup never depends on server time.
let nowValue = 0
const nowListeners = new Set<() => void>()
let nowTimer: ReturnType<typeof setInterval> | null = null

function subscribeNow(cb: () => void) {
  nowListeners.add(cb)
  if (!nowTimer) {
    nowValue = Date.now()
    nowTimer = setInterval(() => {
      nowValue = Date.now()
      nowListeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    nowListeners.delete(cb)
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer)
      nowTimer = null
    }
  }
}

/** Current time in ms, refreshed every second (0 during SSR and the first client render). */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeNow,
    () => nowValue || (nowValue = Date.now()),
    () => 0,
  )
}

// ---- media queries ------------------------------------------------------------------------------
function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    get: () => window.matchMedia(query).matches,
  }
}
const reduced = mediaStore('(prefers-reduced-motion: reduce)')

export function useReducedMotion(): boolean {
  return useSyncExternalStore(reduced.subscribe, reduced.get, () => false)
}

// ---- online -------------------------------------------------------------------------------------
function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

// ---- location.hash ------------------------------------------------------------------------------
function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** location.hash, or null during SSR (so the page can show a neutral state first). */
export function useHash(): string | null {
  return useSyncExternalStore(subscribeHash, () => window.location.hash, () => null)
}

// ---- hydration flag -----------------------------------------------------------------------------
const noop = () => () => {}
/** false on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
