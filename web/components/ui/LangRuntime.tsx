'use client'

/**
 * Swaps rendered English text for Indonesian while ID is on, and puts it back on EN. It walks text nodes and
 * a few visible attributes (placeholder, title, aria-label), looks each trimmed string up in the dictionary,
 * and keeps the original so the switch is reversible without a reload. A MutationObserver covers everything
 * React renders later (new receipts, toasts, sheets). React keeps working because only nodeValue changes:
 * when React updates a node it writes English again and the observer translates it again.
 * Skipped: script, style, code, pre, textarea, inputs, svg, and anything under [data-no-translate].
 */

import { useEffect } from 'react'
import { getDict, getLang, loadDict, norm, useLang, type Dict } from '@/lib/client/lang'

const ATTRS = ['placeholder', 'title', 'aria-label'] as const
type Attr = (typeof ATTRS)[number]
const SKIP = 'script,style,code,pre,textarea,input,select,svg,[data-no-translate]'

const origText = new Map<Text, string>()
const shownText = new WeakMap<Text, string>()
const origAttr = new Map<Element, Partial<Record<Attr, string>>>()

function lookup(d: Dict, raw: string) {
  if (!/[A-Za-z]/.test(raw)) return null
  const hit = d[norm(raw)]
  if (!hit) return null
  const lead = raw.match(/^\s*/)?.[0] ?? ''
  const trail = raw.match(/\s*$/)?.[0] ?? ''
  return lead + hit + trail
}

// React tags the DOM nodes it has hydrated with an own "__reactFiber$…" key. Text under a parent without it
// is still server HTML waiting to hydrate; editing it would trigger a hydration mismatch, so it is left for
// a later sweep.
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber$'))

function textNode(d: Dict, n: Text) {
  const v = n.nodeValue ?? ''
  if (shownText.get(n) === v) return
  const p = n.parentElement
  if (!p || !hydrated(p) || p.closest(SKIP)) return
  const t = lookup(d, v)
  if (t == null) return
  origText.set(n, v)
  shownText.set(n, t)
  n.nodeValue = t
}

function element(d: Dict, el: Element) {
  if (!hydrated(el) || el.closest(SKIP)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v) continue
    const saved = origAttr.get(el)
    const was = saved?.[a]
    if (was !== undefined && d[norm(was)] === v) continue
    const t = d[norm(v)]
    if (!t) continue
    origAttr.set(el, { ...saved, [a]: v })
    el.setAttribute(a, t)
  }
}

function pass(d: Dict, root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return textNode(d, root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (el.closest(SKIP)) return
  element(d, el)
  el.querySelectorAll('[placeholder],[title],[aria-label]').forEach((e) => element(d, e))
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) textNode(d, n as Text)
}

function revert() {
  origText.forEach((v, n) => {
    if (n.isConnected && shownText.get(n) === n.nodeValue) n.nodeValue = v
  })
  origText.clear()
  origAttr.forEach((saved, el) => {
    for (const [a, v] of Object.entries(saved)) if (el.isConnected && v != null) el.setAttribute(a, v)
  })
  origAttr.clear()
}

// The first pass waits until the page has loaded and hydration has settled: changing text React has not
// hydrated yet would make it throw away that subtree. Later switches (the toggle) apply at once.
let settled = false
function afterHydration(): Promise<void> {
  if (settled) return Promise.resolve()
  return new Promise((resolve) => {
    const idle = () => {
      const done = () => {
        settled = true
        resolve()
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(done, { timeout: 700 })
      else setTimeout(done, 200)
    }
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
}

export function LangRuntime() {
  const lang = useLang()

  useEffect(() => {
    const html = document.documentElement
    if (lang !== 'id') {
      revert()
      html.removeAttribute('data-lang-pending')
      return
    }
    let obs: MutationObserver | null = null
    let dead = false
    const sweeps: number[] = []
    void Promise.all([loadDict(), afterHydration()])
      .then(([d]) => {
        if (dead || getLang() !== 'id') return
        pass(d, document.body)
        obs = new MutationObserver((records) => {
          const dd = getDict()
          if (!dd) return
          for (const r of records) {
            if (r.type === 'characterData') textNode(dd, r.target as Text)
            else if (r.type === 'attributes') element(dd, r.target as Element)
            else r.addedNodes.forEach((n) => pass(dd, n))
          }
        })
        obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
        // hydration fires no mutations, so sweep again while late boundaries finish hydrating
        for (const ms of [300, 900, 2000, 4000, 7000]) sweeps.push(window.setTimeout(() => !dead && pass(d, document.body), ms))
      })
      .finally(() => html.removeAttribute('data-lang-pending'))
    return () => {
      dead = true
      obs?.disconnect()
      sweeps.forEach((t) => window.clearTimeout(t))
    }
  }, [lang])

  return null
}
