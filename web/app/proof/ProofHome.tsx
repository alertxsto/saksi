'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconCheck, IconQr, IconUpload, IconX } from '@/components/ui/icons'
import { DOES_NOT_PROVE, PROVES } from '@/components/ui/Limits'
import { useToast } from '@/components/ui/Toast'
import { Quiet } from '@/components/regulator/Quiet'
import { RiseHeading } from '@/components/regulator/Rise'
import { readReceiptFile } from '@/lib/data'
import type { ReceiptOpening } from '@/lib/shared/types'
import { ProofResult } from './ProofResult'

const PROMISES = ['No login', 'In your browser', 'Any public node']

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
    <div className="flex flex-col gap-12 md:gap-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5">
          <RiseHeading as="h1" lead="Don’t trust us." tail="Check it yourself." className="text-[38px] leading-[1.02] md:text-[56px]" />
          <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]">
            Paste the proof link a citizen shared, a transaction or a fingerprint, scan its QR, or upload a receipt file. Your
            browser asks the chain directly.
          </p>
        </div>

        <section aria-label="Find a receipt" className="lg:col-span-6 lg:col-start-7 lg:pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onFind()
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Proof link, transaction, fingerprint or receipt JSON
            </label>
            <div className="rg-input flex min-h-16 items-center gap-3 rounded-md border border-line-strong bg-card py-2 pl-4 pr-2 transition-[border-color,box-shadow] duration-200 focus-within:border-blue focus-within:shadow-[0_0_0_4px_var(--color-blue-bg)]">
              <span aria-hidden="true" className="label hidden shrink-0 text-[11px] text-ink-3 sm:inline">
                Proof
              </span>
              <input
                id={inputId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Link, tx or fingerprint"
                spellCheck={false}
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              <Button type="submit" variant="dark" loading={finding} className="shrink-0">
                Verify
              </Button>
            </div>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:flex">
            <Button variant="light" size="sm" icon={<IconQr size={16} />} onClick={onScan}>
              Scan QR
            </Button>
            <Button variant="light" size="sm" icon={<IconUpload size={16} />} onClick={() => fileRef.current?.click()}>
              Upload receipt JSON
            </Button>
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
          <ul className="mt-8 grid grid-cols-1 border-b border-line sm:grid-cols-3">
            {PROMISES.map((p, i) => (
              <li
                key={p}
                className={`flex items-center gap-2.5 border-t border-line py-3 text-[14px] text-ink-2 ${i ? 'sm:border-l sm:pl-4' : ''}`}
              >
                <DotIcon name="check" size={14} className="shrink-0 text-ink" />
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div aria-live="polite">
        {missing ? (
          <Quiet
            glyph="shield"
            title="A fingerprint alone can’t be checked"
            body="It carries no receipt details to compare with the chain. This is not proof of tampering. Open the full proof link the citizen shared (the receipt travels after “#”) or upload the receipt file."
          />
        ) : null}
      </div>

      {opening ? <ProofResult key={opening.eventId} opening={opening} /> : null}

      <section aria-label="What a check can and cannot show" className="grid gap-10 border-t border-line pt-10 md:grid-cols-2 md:gap-6 md:pt-12">
        {[
          { h: 'A match proves', items: PROVES, ok: true },
          { h: 'A match does not prove', items: DOES_NOT_PROVE, ok: false },
        ].map((col) => (
          <div key={col.h}>
            <h2 className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[22px]">{col.h}</h2>
            <ul className="mt-4 border-b border-line">
              {col.items.map((t) => (
                <li key={t} className="flex gap-3 border-t border-line py-3 text-[16px] leading-snug text-ink">
                  {col.ok ? (
                    <IconCheck size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
                  ) : (
                    <IconX size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-3" />
                  )}
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <dialog
        ref={scanDialog}
        aria-label="Scan a QR code"
        onClose={() => {
          stopScan.current()
          setScanning(false)
        }}
        className="m-auto w-[calc(100%-32px)] max-w-[420px] rounded-xl bg-vault p-0 text-vault-ink backdrop:bg-ink/60"
      >
        <div className="flex items-center justify-between border-b border-vault-line px-4 py-2">
          <p className="label text-ice">{scanning ? 'Point at a Saksi QR' : 'Camera'}</p>
          <button type="button" onClick={closeScan} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center text-vault-ink-2 hover:text-ice">
            <IconX size={18} />
          </button>
        </div>
        <video ref={videoRef} className="aspect-square w-full bg-black object-cover" muted playsInline />
      </dialog>
    </div>
  )
}
