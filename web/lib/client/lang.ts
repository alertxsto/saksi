'use client'

/**
 * Language store for the EN / ID switch. English is the source copy in the components; Indonesian comes from
 * one dictionary (lib/i18n/id.json, English text -> Indonesian) loaded only when someone picks ID. The choice
 * lives in localStorage ("saksi-lang"); an inline script in the root layout reads it before first paint
 * (LANG_BOOT) so an Indonesian page does not flash English.
 *
 * Two consumers: LangRuntime swaps rendered text nodes in place, and useT() serves components that draw
 * their text letter by letter (OdoText), where the DOM pass cannot reach.
 */

import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'id'
export type Dict = Record<string, string>

const KEY = 'saksi-lang'
const subs = new Set<() => void>()
let lang: Lang = 'en'
let dict: Dict | null = null
let loading: Promise<Dict> | null = null

if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem(KEY) === 'id') lang = 'id'
  } catch {}
}

const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

export function loadDict(): Promise<Dict> {
  if (dict) return Promise.resolve(dict)
  loading ??= import('@/lib/i18n/id.json').then((m) => {
    dict = ((m as { default?: Dict }).default ?? m) as Dict
    emit()
    return dict
  })
  return loading
}

export function getLang() {
  return lang
}
export function getDict() {
  return dict
}

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {}
  document.documentElement.lang = next
  if (next === 'id') void loadDict()
  emit()
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => lang, () => 'en')
}

/** Translate one English string (ID only once the dictionary is in). */
export function useT() {
  const l = useLang()
  const d = useSyncExternalStore(subscribe, () => dict, () => null)
  return (s: string) => (l === 'id' && d ? (d[norm(s)] ?? s) : s)
}

/** Runs in <head> before paint: marks the page pending so it stays hidden until the Indonesian pass lands. */
export const LANG_BOOT = `try{if(localStorage.getItem('${KEY}')==='id'){var h=document.documentElement;h.lang='id';h.setAttribute('data-lang-pending','')}}catch(e){}`
