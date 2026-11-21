import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Nav } from '@/components/landing/Nav'
import { OdoText } from '@/components/landing/OdoText'
import { RevealRoot } from '@/components/landing/RevealRoot'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { FrameRules, Heading } from '@/components/landing/Words'
import { Cite } from '@/components/ui/Cite'
import { IconArrow, IconArrowUpRight } from '@/components/ui/icons'
import { formatSourceDate, SOURCES, type SourceId } from '@/lib/sources'
import { RealCases } from './RealCases'

export const metadata: Metadata = {
  title: 'Real cases',
  description:
    'Four real situations, what happens today and what changes with Saksi, plus the public evidence and the UU PDP duties behind it.',
}

type Stat = { value: string; unit?: string; label: string; body: string; cite: SourceId[] }
const STATS: Stat[] = [
  {
    value: '56.1',
    unit: 'M',
    label: 'Records on the dark web · 2024',
    body: '56,128,160 Indonesian records from 461 organisations; 58.34% came from government administration.',
    cite: ['bssn-dark-web-2024'],
  },
  {
    value: '282',
    label: 'Tenants hit at once · 2024',
    body: 'Government tenants hit by one ransomware attack on the National Data Centre (PDNS 2) in June 2024.',
    cite: ['pdns-ransomware-2024'],
  },
  {
    value: '1.22',
    unit: 'M',
    label: 'Leaked accounts · H1 2026',
    body: 'The most of any of 11 Southeast Asian countries in the first half of 2026.',
    cite: ['surfshark-asean-2026'],
  },
  {
    value: '28.7',
    unit: '%',
    label: 'Say their data leaked · 2021',
    body: '3,246 of 11,305 people in a national Kominfo survey. They rated data protection 6.05 out of 10.',
    cite: ['kominfo-survey-2021'],
  },
]

type Row = { k: string; v: string; cite: SourceId[] }
const OVERSIGHT: Row[] = [
  { k: 'Websites with potential violations', v: '115 / 280 · 41%', cite: ['komdigi-monitoring-2025'] },
  { k: 'Apps with potential violations', v: '24 / 70 · 34%', cite: ['komdigi-monitoring-2025'] },
  { k: 'Suspected UU PDP cases', v: '56', cite: ['komdigi-monitoring-2025'] },
  { k: 'OJK consumer complaints · 2025', v: '56,620', cite: ['ojk-complaints-2025'] },
  { k: 'From fintech · banking', v: '21,886 · 20,972', cite: ['ojk-complaints-2025'] },
  { k: 'UU PDP agency', v: 'Not formed · Nov 2026', cite: ['pdp-agency-2026'] },
]

type Duty = {
  law: string
  duty: string
  cite: SourceId[]
  feature: string
  how: string
  href?: string
  cta?: string
}
const DUTIES: Duty[] = [
  {
    law: 'UU PDP Art. 31',
    duty: 'Record every processing of personal data.',
    cite: ['uu-pdp-31'],
    feature: 'Access receipt',
    how: 'Each access becomes a record whose fingerprint is sealed on Sepolia. The citizen’s phone recomputes it against the chain.',
    href: '/enter?as=citizen',
    cta: 'Try it as the citizen',
  },
  {
    law: 'UU PDP Art. 20(2)',
    duty: 'Process only on one of six legal bases, a to f.',
    cite: ['uu-pdp-20'],
    feature: 'Legal basis on every receipt',
    how: 'The controller picks the basis it claims (PDP-20-2-a to f) and it is sealed with the record, so it cannot be swapped later.',
    href: '/enter?as=agency',
    cta: 'Try it as the agency',
  },
  {
    law: 'UU PDP Art. 46',
    duty: 'Notify data subjects and the authority within 3 × 24 hours.',
    cite: ['uu-pdp-46'],
    feature: '72-hour contract clock',
    how: 'BreachReport compares the block time with the declared discovery time. After 72 hours an on-time notice is refused and can only be recorded as late.',
    href: '/enter?as=regulator',
    cta: 'Try it as the regulator',
  },
  {
    law: 'UU PDP Art. 46',
    duty: 'Say which data was exposed, when and how, and what is being done.',
    cite: ['uu-pdp-46'],
    feature: 'AI notice draft',
    how: 'The AI drafts those three parts from the controller’s narrative; the controller edits and seals it. On time or late is decided by the contract, never the AI.',
    href: '/enter?as=agency',
    cta: 'Draft a notice as the agency',
  },
  {
    law: 'Oversight',
    duty: 'Someone outside the company has to check the record.',
    cite: ['pdp-agency-2026', 'komdigi-monitoring-2025'],
    feature: 'Regulator register',
    how: 'Compares each database row with its chain event and flags records that match, were changed after sealing, were deleted, or were never sealed, without asking the agency for access.',
    href: '/enter?as=regulator',
    cta: 'Open the regulator workspace',
  },
  {
    law: 'POJK 40/2024 Art. 161–162',
    duty: 'Non-repudiation when personal data is accessed; an audit trail for supervision and disputes.',
    cite: ['pojk-40-2024'],
    feature: 'Signed, public proof',
    how: 'Each record is sent from the controller’s registered wallet, and anyone can check a receipt in the public verifier, in the browser.',
    href: '/proof',
    cta: 'Public verifier',
  },
  {
    law: 'UU PDP Art. 57 · POJK 22/2023',
    duty: 'Fines up to 2% of annual revenue; in finance, up to Rp15 billion per violation.',
    cite: ['uu-pdp-57', 'pojk-22-2023'],
    feature: 'Why a controller adopts it',
    how: 'Compliance it can prove to a citizen, an auditor or a court, instead of a log only it can read.',
  },
]

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-24 border-t border-line py-16 md:py-[104px] ${className}`}>
      <div className="frame grid gap-10 px-3 md:px-8 lg:grid-cols-12 lg:gap-6">{children}</div>
    </section>
  )
}

/**
 * /why — the problem-fit evidence page. Every figure is a numbered citation into lib/sources.ts, listed in
 * full at the bottom (#source-n anchors, which the landing page's superscripts link to). Same sheet as the
 * landing: paper, frame rules, two-tone headings, mono labels; ends in the shared vault footer.
 */
export default function WhyPage() {
  return (
    <>
      <SmoothScroll />
      <RevealRoot />
      <Nav base="/" />
      <main id="main" className="overflow-x-clip">
        <div className="relative">
          <FrameRules />

          <section aria-labelledby="why-title" className="relative pb-16 pt-32 md:pb-[104px] md:pt-44">
            <div className="frame grid gap-8 px-3 md:px-8 lg:grid-cols-12 lg:gap-6">
              <div className="lg:col-span-7">
                <Heading
                  as="h1"
                  id="why-title"
                  lead="Real cases."
                  tail="What happens today, and what changes with Saksi."
                  className="max-w-[18ch] text-[40px] leading-[1.03] sm:text-[52px] lg:text-[64px]"
                />
              </div>
              <div className="flex flex-col justify-end gap-4 lg:col-span-4 lg:col-start-9">
                <p className="text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[18px]">
                  <span className="tnum font-semibold text-ink">7,833</span> institutions use Dukcapil population
                  data.<Cite ids={['dukcapil-7833-2026']} /> In 2025 they looked it up{' '}
                  <span className="tnum font-semibold text-ink">2.57 billion</span> times.<Cite ids={['dukcapil-hits-2025']} />{' '}
                  Each lookup opens someone’s NIK, and today that person never hears about it.
                </p>
                <p className="text-[14px] leading-[1.6] text-ink-3">
                  UU PDP already asks for the record: Pasal 31 (record all processing), Pasal 32 (the citizen may see it
                  within 3×24 h), Pasal 46 (breach notice within 3×24 h) and Pasal 12 (the right to sue).
                </p>
              </div>
            </div>

            <div className="frame mt-12 px-3 md:mt-16 md:px-8">
              <RealCases />
            </div>
          </section>

          <Section id="evidence">
            <div className="lg:col-span-12">
              <Heading
                id="evidence-title"
                lead="Indonesia keeps leaking personal data."
                tail="Nobody outside can check the logs."
                className="max-w-[22ch] text-[32px] leading-[1.06] md:text-[48px]"
              />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4" data-stagger="">
              {STATS.map((s) => (
                <li key={s.label} className="flex flex-col gap-5 rounded-2xl bg-card p-5">
                  <p className="text-[14px] font-medium text-ink-2">{s.label}</p>
                  <div>
                    <p className="tnum text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">
                      {s.value}
                      {s.unit ? <span className="ml-0.5 text-[24px] text-ink-2">{s.unit}</span> : null}
                    </p>
                    <p className="mt-3 text-[14px] leading-[1.5] text-ink-2">
                      {s.body}
                      <Cite ids={s.cite} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="gap">
            <div className="lg:col-span-5">
              <Heading
                id="gap-title"
                lead="The evidence stays inside."
                tail="So does the doubt."
                className="text-[32px] leading-[1.06] md:text-[48px]"
              />
              <div className="mt-8 max-w-[52ch] space-y-5 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]">
                <p>
                  When taxpayer (NPWP) data was alleged to have leaked in 2024, the tax office answered with six years of
                  its own access logs.<Cite ids={['djp-npwp-2024']} /> It may well have been right. But no citizen,
                  journalist or regulator could check that answer, because the only copy of the evidence belonged to the
                  party being asked.
                </p>
                <p>
                  The checkers are stretched. Komdigi’s own sampling found potential violations on 41% of the websites
                  it checked,<Cite ids={['komdigi-monitoring-2025']} /> OJK received 56,620 consumer complaints in
                  2025,<Cite ids={['ojk-complaints-2025']} /> and the agency UU PDP created to enforce
                  the law had not been formed by November 2026.<Cite ids={['pdp-agency-2026']} />
                </p>
                <p>
                  Estonia has shown citizens who looked at their data in government registers, and why, since
                  2017.<Cite ids={['estonia-data-tracker']} /> Saksi brings that idea to private companies, with proofs
                  anyone can verify instead of logs held by one party.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <figure className="rounded-2xl bg-card p-5 md:p-6">
                <blockquote className="text-[15px] italic leading-[1.6] text-ink">
                  “data log access dalam enam tahun terakhir menunjukkan tidak adanya indikasi yang mengarah kepada
                  kebocoran data langsung”
                </blockquote>
                <figcaption className="mt-4 border-t border-dashed border-line-strong pt-3 text-[14px] leading-[1.5] text-ink-2">
                  “Access-log data from the last six years shows no indication of a direct data leak.” DJP spokesperson,
                  20 Sep 2024.
                  <Cite ids={['djp-npwp-2024']} />
                </figcaption>
              </figure>

              <div className="mt-8 rounded-2xl bg-card px-5 pb-2 pt-4">
                <p className="pb-3 text-[15px] font-semibold text-ink">Who checks the agencies</p>
                <dl className="text-[14px] text-ink">
                  {OVERSIGHT.map((r) => (
                    <div key={r.k} className="wy-fig">
                      <dt className="min-w-0 text-ink-2">{r.k}</dt>
                      <dd className="tnum shrink-0 text-right font-medium">
                        {r.v}
                        <Cite ids={r.cite} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Section>

          <Section id="duties">
            <div className="lg:col-span-12">
              <Heading
                id="duties-title"
                lead="The law already asks for the record."
                tail="Saksi makes it checkable."
                className="max-w-[22ch] text-[32px] leading-[1.06] md:text-[48px]"
              />
            </div>
            <ol aria-labelledby="duties-title" className="border-b border-line lg:col-span-12" data-stagger="">
                            {DUTIES.map((d) => (
                <li key={d.feature} className="grid gap-3 border-t border-line py-6 lg:grid-cols-12 lg:gap-6">
                  <p className="pt-0.5 text-[15px] font-semibold text-ink lg:col-span-3">
                    {d.law}
                    <Cite ids={d.cite} />
                  </p>
                  <p className="text-[16px] leading-[1.5] text-ink-2 lg:col-span-4">{d.duty}</p>
                  <div className="lg:col-span-5">
                    <p className="text-[19px] font-medium leading-[1.3] tracking-[-0.015em] text-ink">{d.feature}</p>
                    <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">{d.how}</p>
                    {d.href && d.cta ? (
                      <Link
                        href={d.href}
                        className="group mt-3 inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:text-blue"
                      >
                        <OdoText>{d.cta}</OdoText>
                        <IconArrow size={14} />
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="sources" className="pb-24 md:pb-40">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <Heading id="sources-title" lead="Sources." tail="Opened and read." className="text-[34px] leading-[1.04] md:text-[56px]" />
                <p className="mt-6 max-w-[36ch] text-[15px] leading-[1.6] text-ink-2">
                  Each quote is the passage a figure comes from, in the source’s language. Notes say where a figure is
                  narrower than it looks.
                </p>
              </div>
            </div>
            <ol aria-labelledby="sources-title" className="border-b border-line lg:col-span-8">
              {SOURCES.map((s, i) => {
                const note: string | undefined = 'note' in s ? s.note : undefined
                return (
                  <li key={s.id} id={`source-${i + 1}`} className="grid scroll-mt-28 grid-cols-[40px_1fr] gap-x-4 border-t border-line py-6 target:bg-blue-bg/40 md:grid-cols-[56px_1fr]">
                    <span className="tnum pt-0.5 text-[20px] font-semibold text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <p className="text-[17px] font-medium leading-[1.4] text-ink">{s.claim}</p>
                      <p className="mt-2 text-[13px] font-medium text-ink-2">{s.figure}</p>
                      <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-[14px] italic leading-[1.6] text-ink-2">
                        “{s.quote}”
                      </blockquote>
                      {note ? <p className="mt-3 text-[13px] leading-[1.5] text-ink-3">Note: {note}</p> : null}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex max-w-full items-baseline gap-1.5 text-[14px] leading-[1.45] text-blue underline-offset-2 hover:underline"
                      >
                        <span className="min-w-0 break-words">
                          {s.title} · {s.publisher} · {formatSourceDate(s.date)}
                        </span>
                        <IconArrowUpRight size={12} className="shrink-0 translate-y-[1px]" />
                      </a>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>
        </div>
      </main>
      <SiteFooter base="/" />
    </>
  )
}
