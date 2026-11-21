import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CodePanel } from '@/components/integrate/CodePanel'
import {
  CURL_SNIPPET,
  ENDPOINT_GROUPS,
  ERRORS,
  HELD_BY_SAKSI,
  NEVER_LEAVES,
  ON_CHAIN,
  RESPONSE_SNIPPET,
  RUN_OUTPUT,
  RUN_SNIPPET,
  TS_SNIPPET,
} from '@/components/integrate/content'
import { FlowDiagram } from '@/components/integrate/FlowDiagram'
import { Cta } from '@/components/landing/Cta'
import { Nav } from '@/components/landing/Nav'
import { RevealRoot } from '@/components/landing/RevealRoot'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { FrameRules, Heading } from '@/components/landing/Words'
import { Cite } from '@/components/ui/Cite'
import { IconArrowUpRight, IconCheck, IconLock, IconMinus } from '@/components/ui/icons'
import { CHAIN_NAME, CONTRACTS, explorerAddress } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Integrate your system',
  description:
    'How an agency or bank connects its existing system to Saksi: one hook where a record is opened, a commitment from the API, a logAccess signed with its own key. The data never leaves its database.',
}

const CONTRACT_ROWS = [
  { name: 'AccessJournal', address: CONTRACTS.AccessJournal, fn: 'logAccess(bytes32,bytes32,bytes32,bytes32,uint8,bytes32)' },
  { name: 'ControllerRegistry', address: CONTRACTS.ControllerRegistry, fn: 'isAuthorized(bytes32,address) → bool' },
  { name: 'BreachReport', address: CONTRACTS.BreachNotice, fn: 'anchor(…) · anchorLate(…)' },
]

const ROLLOUT: { who: string; why: ReactNode; hook: string }[] = [
  {
    who: 'Lenders and banks under OJK',
    why: (
      <>
        POJK 40/2024 already asks P2P lenders for non-repudiation when personal data is accessed and an audit trail
        usable for supervision and disputes.
        <Cite ids={['pojk-40-2024']} /> OJK logged 56,620 consumer complaints in 2025, 21,886 of them about fintech and
        20,972 about banks.
        <Cite ids={['ojk-complaints-2025']} />
      </>
    ),
    hook: 'The customer-data screen in the loan or core-banking back office.',
  },
  {
    who: 'Public registers',
    why: (
      <>
        Government administration made up 58.34% of the Indonesian records BSSN found on the dark web in 2024.
        <Cite ids={['bssn-dark-web-2024']} /> When NPWP data was alleged to have leaked, the only answer available was
        the tax office’s own six years of logs.
        <Cite ids={['djp-npwp-2024']} /> Estonia has shown citizens who opened their register data since 2017.
        <Cite ids={['estonia-data-tracker']} />
      </>
    ),
    hook: 'The officer’s record lookup in the register application.',
  },
  {
    who: 'Every controller under UU PDP',
    why: (
      <>
        Article 31 already requires a record of all processing,
        <Cite ids={['uu-pdp-31']} /> and the agency meant to enforce the law had not been formed by November 2026.
        <Cite ids={['pdp-agency-2026']} /> A sealed record lets anyone check it without waiting for one.
      </>
    ),
    hook: 'Wherever the existing Art. 31 processing log is written today.',
  },
]

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-24 border-t border-line py-16 md:py-[104px] ${className}`}>
      <div className="frame grid gap-10 px-3 md:px-8 lg:grid-cols-12 lg:gap-6">{children}</div>
    </section>
  )
}

const body = 'text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]'
const h2 = 'text-[34px] leading-[1.04] md:text-[48px]'

function RetryTag({ retry }: { retry: boolean }) {
  return (
    <span className={`label inline-flex h-6 shrink-0 items-center rounded-sm px-2 ${retry ? 'bg-pending-bg text-pending' : 'bg-unknown-bg text-unknown'}`}>
      {retry ? 'Retry' : 'Stop'}
    </span>
  )
}

function Method({ m }: { m: 'GET' | 'POST' }) {
  return (
    <span
      className={`inline-flex h-6 w-12 shrink-0 items-center justify-center rounded-sm font-mono text-[11px] font-bold tracking-[0.04em] ${
        m === 'GET' ? 'bg-ok-bg text-ok' : 'bg-blue-bg text-blue'
      }`}
    >
      {m}
    </span>
  )
}

/**
 * /integrate — the answer to "how does the data the government already holds connect to this?". Saksi never
 * ingests the data: the agency adds one hook where a record is opened, signs logAccess with its own key, and
 * Saksi only builds and checks commitments. Structured like /why (same sheet, frame rules, vault footer);
 * every shape and code on the page comes from the implementation (see components/integrate/content.ts).
 */
export default function IntegratePage() {
  return (
    <>
      <SmoothScroll />
      <RevealRoot />
      <Nav base="/" />
      <main id="main" className="overflow-x-clip">
        <div className="relative">
          <FrameRules />

          <section aria-labelledby="integrate-title" className="relative pb-16 pt-32 md:pb-[104px] md:pt-44">
            <div className="frame grid gap-10 px-3 md:px-8 lg:grid-cols-12 lg:gap-6">
              <div className="lg:col-span-7">
                <Heading
                  as="h1"
                  id="integrate-title"
                  lead="Your data stays with you."
                  tail="One hook seals each access."
                  className="max-w-[16ch] text-[40px] leading-[1.03] sm:text-[52px] lg:text-[64px]"
                />
              </div>
              <div className="flex flex-col justify-end gap-6 lg:col-span-5">
                <p className={body}>
                  Saksi never copies a register or a customer table. Where an officer opens a citizen record, your
                  backend makes one call to Saksi, signs one transaction with your own key, and the citizen’s phone
                  gets a receipt it can check against {CHAIN_NAME}.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Cta href="#code" className="max-sm:w-full max-sm:justify-between">
                    Read the code
                  </Cta>
                  <Cta href="#api" variant="light" className="max-sm:w-full max-sm:justify-center">
                    API reference
                  </Cta>
                </div>
              </div>
            </div>

            <dl className="frame mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line px-0 sm:grid-cols-3 md:mt-20" data-stagger="">
              {[
                ['What Saksi receives', 'A 6-character citizen code, the purpose, the legal basis. Never a NIK or a name.'],
                ['Who signs', 'Your registered wallet or HSM. Saksi cannot forge or hide an entry for you.'],
                ['What it costs you', 'One API call and one transaction per access. No database link, no data export.'],
              ].map(([k, v]) => (
                <div key={k} className="bg-paper p-5 md:p-6">
                  <dt className="label text-ink-2">{k}</dt>
                  <dd className="mt-3 text-[16px] font-medium leading-[1.4] tracking-[-0.01em] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Section id="flow">
            <div className="lg:col-span-7">
              <Heading id="flow-title" lead="Six steps." tail="One signature, and it is yours." className={h2} />
            </div>
            <p className={`${body} lg:col-span-5 lg:self-end`}>
              The hook belongs in the code path that opens the record, not in a nightly report: Saksi can only witness
              what the hook reports. Prepare and sign are synchronous; submit and confirm can run in a background job.
            </p>
            <div className="lg:col-span-12">
              <FlowDiagram />
            </div>
          </Section>

          <Section id="data">
            <div className="lg:col-span-12">
              <Heading id="data-title" lead="What goes on chain." tail="What stays with you." className={h2} />
            </div>

            <div className="min-w-0 lg:col-span-7">
              <h3 className="flex items-center gap-2 text-[19px] font-medium tracking-[-0.015em] text-ink">
                <span aria-hidden="true" className="size-2 rounded-full bg-ice ring-2 ring-vault" />
                On {CHAIN_NAME}, public
              </h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">
                The <code className="font-mono text-[13px] text-ink">AccessLogged</code> event. Anyone can read who acted,
                what kind of access, on what basis and when. Whose record and why are hashes that only the citizen’s
                receipt opens.
              </p>
              <ul className="mt-5 border-b border-line md:hidden">
                {ON_CHAIN.map((r) => (
                  <li key={r.field} className="border-t border-line py-3">
                    <p className="flex items-baseline justify-between gap-3 font-mono text-[13px]">
                      <span className="text-ink">{r.field}</span>
                      <span className="text-ink-3">{r.type}</span>
                    </p>
                    <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{r.what}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 hidden overflow-x-auto rounded-lg border border-line bg-card md:block">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="label border-b border-line text-ink-3">
                      <th scope="col" className="px-4 py-3 font-normal">Field</th>
                      <th scope="col" className="px-4 py-3 font-normal">Type</th>
                      <th scope="col" className="px-4 py-3 font-normal">What it is</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ON_CHAIN.map((r) => (
                      <tr key={r.field} className="border-t border-line align-top first:border-t-0">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-ink">{r.field}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-ink-2">{r.type}</td>
                        <td className="px-4 py-3 text-[14px] leading-[1.5] text-ink-2">{r.what}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-10 lg:col-span-5">
              <div>
                <h3 className="flex items-center gap-2 text-[19px] font-medium tracking-[-0.015em] text-ink">
                  <IconMinus size={16} strokeWidth={2.4} className="text-ink-2" />
                  Never leaves your system
                </h3>
                <ul className="mt-4 border-b border-line">
                  {NEVER_LEAVES.map((x) => (
                    <li key={x} className="flex items-center gap-3 border-t border-line py-3 text-[15px] text-ink">
                      <IconCheck size={15} strokeWidth={2.4} className="shrink-0 text-ok" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-[19px] font-medium tracking-[-0.015em] text-ink">
                  <IconLock size={16} className="text-ink-2" />
                  Held by Saksi, encrypted
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-ink-2">
                  AES-256-GCM at rest, opened only to show the citizen their own receipt and let the phone recompute
                  the hashes.
                </p>
                <ul className="mt-4 border-b border-line">
                  {HELD_BY_SAKSI.map((x) => (
                    <li key={x} className="flex items-center gap-3 border-t border-line py-3 text-[15px] text-ink-2">
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-dot-2" />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[13px] leading-[1.5] text-ink-3">
                  In this hackathon build Saksi also generates the evidence descriptor (system, data categories, request
                  time) with synthetic values.
                </p>
              </div>
            </div>
          </Section>

          <Section id="code">
            <div className="lg:col-span-7">
              <Heading id="code-title" lead="The whole hook." tail="One file, plain viem." className={h2} />
            </div>
            <div className="lg:col-span-5 lg:self-end">
              <div>
                <p className={body}>
                  The same flow the controller console runs in the browser, written for a backend. There is no API key:
                  prepare returns a <code className="font-mono text-[14px] text-ink">submitToken</code> bound to the
                  draft, and the only credential that matters is the signature from the wallet registered for your
                  controller.
                </p>
                <ol className="mt-8 border-b border-line text-[14px] leading-[1.5]">
                  {[
                    ['prepare', 'Commitments and a draft token.'],
                    ['logAccess', 'Signed by your key, sent to the journal.'],
                    ['submit', 'Saksi checks contract, arguments and signer on chain.'],
                    ['confirm', 'Poll until anchored.'],
                  ].map(([k, v], i) => (
                    <li key={k} className="flex gap-3 border-t border-line py-3">
                      <span className="w-5 shrink-0 font-mono text-[12px] text-ink-3">{i + 1}</span>
                      <span>
                        <code className="font-mono text-[13px] text-ink">{k}</code>
                        <span className="text-ink-2"> · {v}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-8 lg:col-span-12">
              <CodePanel title="seal-access.ts" lang="ts" code={TS_SNIPPET} />

              <div className="flex min-w-0 flex-col gap-6">
                <CodePanel title="prepare with curl" lang="sh" code={CURL_SNIPPET} />
                <CodePanel
                  title="201 response, annotated"
                  lang="json"
                  code={RESPONSE_SNIPPET}
                  caption="args is exactly the logAccess argument list, in order. Pass it to the contract unchanged."
                />
              </div>

              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                <CodePanel
                  title="run the full example"
                  lang="sh"
                  code={RUN_SNIPPET}
                  caption={
                    <>
                      <code className="font-mono text-[12px] text-ink">web/scripts/agency-example.mjs</code> reads the
                      ABI generated from the contracts and the deployed addresses from the repo. The key is read from
                      the environment and never printed.
                    </>
                  }
                />
                <CodePanel title="output against production" lang="out" code={RUN_OUTPUT} />
              </div>

              <div>
                <h3 className="text-[19px] font-medium tracking-[-0.015em] text-ink">Errors</h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">
                  Every error is <code className="font-mono text-[13px] text-ink">{'{ error: { code, message } }'}</code>
                  ; the message is plain English and safe to show an officer.
                </p>
                <ul className="mt-5 border-b border-line md:hidden">
                  {ERRORS.map((e) => (
                    <li key={e.code} className="border-t border-line py-3">
                      <p className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-all font-mono text-[13px] text-ink">{e.code}</span>
                        <RetryTag retry={e.retry} />
                      </p>
                      <p className="mt-1 font-mono text-[12px] text-ink-3">
                        {e.status} · {e.step}
                      </p>
                      <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{e.meaning}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 hidden overflow-x-auto rounded-lg border border-line bg-card md:block">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="label border-b border-line text-ink-3">
                        <th scope="col" className="px-4 py-3 font-normal">Code</th>
                        <th scope="col" className="px-4 py-3 font-normal">HTTP</th>
                        <th scope="col" className="px-4 py-3 font-normal">Step</th>
                        <th scope="col" className="px-4 py-3 font-normal">Meaning</th>
                        <th scope="col" className="px-4 py-3 font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ERRORS.map((e) => (
                        <tr key={e.code} className="border-t border-line align-top first:border-t-0">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] text-ink">{e.code}</td>
                          <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">{e.status}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] text-ink-2">{e.step}</td>
                          <td className="px-4 py-3 text-[14px] leading-[1.5] text-ink-2">{e.meaning}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <RetryTag retry={e.retry} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Section>

          <Section id="api">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <Heading id="api-title" lead="API reference." tail="Public, JSON, no key." className={h2} />
                <p className={`${body} mt-6`}>
                  POSTs take <code className="font-mono text-[14px] text-ink">application/json</code>. A browser on
                  another origin is refused with <code className="font-mono text-[14px] text-ink">BAD_ORIGIN</code>;
                  calls from your backend carry no Origin header and are accepted.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-12 lg:col-span-8">
              {ENDPOINT_GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="text-[19px] font-medium tracking-[-0.015em] text-ink">{g.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">{g.note}</p>
                  <ul className="mt-4 border-b border-line">
                    {g.rows.map((r) => (
                      <li key={r.path} className="grid gap-2 border-t border-line py-4 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:gap-6">
                        <p className="flex min-w-0 items-center gap-3">
                          <Method m={r.method} />
                          <code className="min-w-0 break-all font-mono text-[13px] text-ink">{r.path}</code>
                        </p>
                        <p className="text-[14px] leading-[1.5] text-ink-2">{r.purpose}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <h3 className="text-[19px] font-medium tracking-[-0.015em] text-ink">Contracts on {CHAIN_NAME}</h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">
                  The registry binds each controller id to one wallet; the journal refuses any other sender.
                </p>
                <ul className="mt-4 border-b border-line">
                  {CONTRACT_ROWS.map((c) => (
                    <li key={c.name} className="grid gap-2 border-t border-line py-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-6">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-ink">{c.name}</p>
                        <p className="mt-1 break-all font-mono text-[12px] text-ink-2">{c.fn}</p>
                      </div>
                      {c.address ? (
                        <a
                          href={explorerAddress(c.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 self-center break-all font-mono text-[12.5px] text-blue underline-offset-2 hover:underline md:break-normal"
                        >
                          <span className="min-w-0">{c.address}</span>
                          <IconArrowUpRight size={12} className="shrink-0" />
                        </a>
                      ) : (
                        <p className="self-center text-[14px] text-ink-3">Address not configured in this deployment.</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section id="rollout" className="pb-24 md:pb-40">
            <div className="lg:col-span-12">
              <Heading id="rollout-title" lead="Who connects first." tail="And where the hook goes." className={`max-w-[22ch] ${h2}`} />
            </div>
            <ol aria-labelledby="rollout-title" className="border-b border-line lg:col-span-12" data-stagger="">
              <li aria-hidden="true" className="label hidden grid-cols-12 gap-6 pb-3 text-ink-3 lg:grid">
                <span className="col-span-3">Who</span>
                <span className="col-span-6">Why them</span>
                <span className="col-span-3">Where the hook goes</span>
              </li>
              {ROLLOUT.map((w, i) => (
                <li key={w.who} className="grid gap-3 border-t border-line py-6 lg:grid-cols-12 lg:gap-6">
                  <p className="flex gap-3 text-[19px] font-medium leading-[1.3] tracking-[-0.015em] text-ink lg:col-span-3">
                    <span className="pt-1 font-mono text-[12px] text-ink-3">0{i + 1}</span>
                    {w.who}
                  </p>
                  <p className="text-[15px] leading-[1.6] text-ink-2 lg:col-span-6">{w.why}</p>
                  <p className="text-[15px] leading-[1.55] text-ink lg:col-span-3">
                    <span className="label mr-2 text-ink-3 lg:hidden">Hook</span>
                    {w.hook}
                  </p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3 lg:col-span-12">
              <Cta href="/controller" className="max-sm:w-full max-sm:justify-between">
                Try the controller console
              </Cta>
              <Cta href="/regulator/watch" variant="light" className="max-sm:w-full max-sm:justify-center">
                See Watch reconcile
              </Cta>
            </div>
          </Section>
        </div>
      </main>
      <SiteFooter base="/" />
    </>
  )
}
