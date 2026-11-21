'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { ProofStepper } from '@/components/proof/ProofStepper'
import { IconCheck, IconClock, IconQr, IconShield, IconUpload, IconX } from '@/components/ui/icons'
import { DOES_NOT_PROVE, PROVES } from '@/components/ui/Limits'
import { useToast } from '@/components/ui/Toast'
import { readReceiptFile } from '@/lib/data'
import type { ReceiptOpening } from '@/lib/shared/types'
import { ProofResult } from './ProofResult'
import '@/components/proof/proof.css'

const PROMISES = ['No login', 'Runs in your browser', 'Any public node']

const GHOST =
  'inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-ink hover:bg-ink/[.04]'

/** The idle stepper preview: four steps waiting, nothing checked. */
const IDLE_CHECK = { phase: 'idle' as const, ticked: 0, result: null, error: null }
const SAMPLE = { controllerName: '' } as ReceiptOpening

/** What a match does and does not prove, as two quiet lists (riset-ui/37: legal limits stay visible). */
function Limits() {
  return (
    <section aria-label="What a check can and cannot show" className="grid gap-6 sm:grid-cols-2 md:gap-8">
      {[
        { h: 'A match proves', items: PROVES, ok: true },
        { h: 'A match does not prove', items: DOES_NOT_PROVE, ok: false },
      ].map((col) => (
        <div key={col.h}>
          <h2 className="text-[15px] font-semibold text-ink">{col.h}</h2>
          <ul className="mt-2">
            {col.items.map((t) => (
              <li key={t} className="flex gap-2.5 border-t border-line py-2.5 text-[14px] leading-snug text-ink-2 first:border-t-0">
                {col.ok ? (
                  <IconCheck size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
                ) : (
                  <IconX size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-3" />
                )}
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/**
 * `initialQuery` (dev gallery) or `?q=` runs one lookup on load. A proof link (/proof/<tx>/<logIndex>#<receipt>)
 * or pasted receipt JSON is verified in this browser; a bare fingerprint carries no receipt details to compare.
 */
export function ProofHome({ initialQuery }: { initialQuery?: string } = {}) {
  const params = useSearchParams()
  const startQuery = initialQuery ?? params.get('q') ?? ''
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState(startQuery)
  const [finding, setFinding] = useState(false)
  const [opening, setOpening] = useState<ReceiptOpening | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanDialog = useRef<HTMLDialogElement>(null)
  const stopScan = useRef<() => void>(() => {})
  const inputId = useId()
  const formId = useId()

  const lookup = async (raw: string) => {
    const value = raw.trim()
    setMissing(null)
    setOpening(null)
    if (!value) return
    // A full proof link pasted in: follow it (the receipt stays in the #fragment).
    const hashAt = value.indexOf('#')
    if (value.includes('/proof/') && hashAt > 0) {
      const url = new URL(value, window.location.origin)
      router.push(`${url.pathname}${url.hash}`)
      return
    }
    setFinding(true)
    try {
      // Pasted receipt JSON (the downloaded receipt file's contents) can be verified directly.
      const pasted = value.startsWith('{') ? await readReceiptFile({ text: async () => value }) : null
      if (pasted) setOpening(pasted)
      else setMissing(value)
    } finally {
      setFinding(false)
    }
  }

  const lookupRef = useRef(lookup)
  useEffect(() => {
    lookupRef.current = lookup
  })
  useEffect(() => {
    if (startQuery) void lookupRef.current(startQuery)
  }, [startQuery])

  const onFind = () => void lookup(query)

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    const op = await readReceiptFile(file)
    if (!op) {
      toast('That file is not a Saksi receipt', 'bad')
      return
    }
    setMissing(null)
    setOpening(op)
    toast('Receipt loaded')
  }

  const closeScan = () => {
    stopScan.current()
    scanDialog.current?.close()
    setScanning(false)
  }

  const onScan = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      toast('This browser can’t scan here — open the QR with your camera app', 'bad')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const detector = new Detector({ formats: ['qr_code'] })
      setScanning(true)
      scanDialog.current?.showModal()
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      let alive = true
      stopScan.current = () => {
        alive = false
        stream.getTracks().forEach((t) => t.stop())
      }
      const tick = async () => {
        if (!alive) return
        const codes = await detector.detect(video).catch(() => [])
        if (codes[0]?.rawValue) {
          closeScan()
          setQuery(codes[0].rawValue)
          void lookup(codes[0].rawValue)
          return
        }
        setTimeout(tick, 300)
      }
      void tick()
    } catch {
      toast('Camera permission was denied', 'bad')
      closeScan()
    }
  }

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <header className="max-w-[640px]">
        <h1 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[34px]">Check a Saksi receipt</h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2 md:text-[16px]">
          Paste the proof link a citizen shared, open the receipt file, or scan its QR. Your browser asks the public ledger
          directly and compares every field. Saksi’s server is not involved.
        </p>
        <p className="mt-3 text-[13px] text-ink-3">{PROMISES.join(' · ')}</p>
      </header>

      <section aria-label="Find a receipt" className="rounded-lg border border-line bg-card p-4 sm:p-5">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault()
            onFind()
          }}
        >
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-2">
            Proof link or receipt
          </label>
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
            <input
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="https://saksiku.web.id/proof/0x…#…"
              spellCheck={false}
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-paper px-3.5 font-mono text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 focus:border-blue focus:shadow-[0_0_0_4px_var(--color-blue-bg)]"
            />
            <button
              type="submit"
              disabled={finding}
              className="hidden h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-6 text-[16px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c] disabled:opacity-60 sm:flex"
            >
              <IconShield size={17} /> Verify
            </button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={GHOST}>
            <IconUpload size={15} /> Open receipt file
          </button>
          <button type="button" onClick={onScan} className={GHOST}>
            <IconQr size={15} /> Scan QR
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
        </div>
      </section>

      {missing ? (
        <div aria-live="polite" className="pf-rise flex items-start gap-3 rounded-lg border border-line bg-unknown-bg/70 p-4">
          <IconClock size={18} className="mt-0.5 shrink-0 text-unknown" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-snug text-ink">A fingerprint alone can’t be checked</p>
            <p className="mt-1 text-[15px] leading-[1.55] text-ink-2">
              <span className="text-ink">This is not proof of tampering.</span> It carries no receipt details to compare with the
              ledger. Open the full proof link the citizen shared (the receipt travels after “#”) or the receipt file.
            </p>
          </div>
        </div>
      ) : null}

      {opening ? (
        <ProofResult key={opening.eventId} opening={opening} autoStart />
      ) : (
        <section aria-labelledby="pf-how" className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 id="pf-how" className="text-[15px] font-semibold text-ink">
              What your browser will do
            </h2>
            <div className="mt-4">
              <ProofStepper check={IDLE_CHECK} opening={SAMPLE} node="a public Sepolia node" />
            </div>
          </div>
          <Limits />
        </section>
      )}

      {opening ? <Limits /> : null}

      {!opening ? (
        <div className="pf-sticky sm:hidden">
          <button
            type="submit"
            form={formId}
            disabled={finding}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-[16px] font-medium text-paper transition-colors duration-150 hover:bg-[#3a332c] disabled:opacity-60"
          >
            <IconShield size={17} /> Verify
          </button>
        </div>
      ) : null}

      <dialog
        ref={scanDialog}
        aria-label="Scan a QR code"
        onClose={() => {
          stopScan.current()
          setScanning(false)
        }}
        className="m-auto w-[calc(100%-32px)] max-w-[420px] overflow-hidden rounded-lg bg-card p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-1.5">
          <p className="text-[15px] font-medium text-ink">{scanning ? 'Point at a Saksi QR' : 'Camera'}</p>
          <button type="button" onClick={closeScan} aria-label="Close scanner" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-sm text-ink-2 hover:text-ink">
            <IconX size={18} />
          </button>
        </div>
        <video ref={videoRef} className="aspect-square w-full bg-black object-cover" muted playsInline />
      </dialog>
    </div>
  )
}
