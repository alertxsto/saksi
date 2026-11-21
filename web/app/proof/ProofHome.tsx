'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip, TwoTone } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconQr, IconQuestion, IconUpload, IconX } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { readReceiptFile } from '@/lib/data'
import type { ReceiptOpening } from '@/lib/shared/types'
import { ProofResult } from './ProofResult'

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
    <div className="flex flex-col gap-10">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <TwoTone head="Don’t trust us." tail="Check it yourself." className="text-[34px] md:text-[48px]" />
          <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
            Paste the proof link a citizen shared, scan its QR, or upload a receipt file. Your browser asks the chain directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-5 lg:justify-end">
          <Chip>No login</Chip>
          <Chip>Verified in your browser</Chip>
        </div>
      </div>

      <section aria-label="Find a receipt" className="rounded-xl border border-line bg-card p-4 md:p-6">
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            onFind()
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Proof link or receipt JSON
          </label>
          <input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Proof link or receipt JSON"
            spellCheck={false}
            autoComplete="off"
            className="h-[52px] min-w-0 shrink-0 rounded-md md:flex-1 border border-line-strong bg-paper-2 px-4 font-mono text-[15px] text-ink outline-none focus:border-blue"
          />
          <Button type="submit" variant="dark" arrow loading={finding}>
            Verify
          </Button>
        </form>
        <div className="mt-3 grid grid-cols-2 gap-3 md:flex">
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
      </section>

      <div aria-live="polite">
        {missing ? (
          <EmptyState
            icon={<IconQuestion size={20} />}
            title="A fingerprint alone can’t be checked"
            body="It carries no receipt details to compare with the chain. This is not proof of tampering. Open the full proof link the citizen shared (the receipt travels after “#”) or upload the receipt file."
          />
        ) : null}
      </div>

      {opening ? <ProofResult key={opening.eventId} opening={opening} /> : null}

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

