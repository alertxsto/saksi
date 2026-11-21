'use client'

import { useState } from 'react'
import { Cite } from '@/components/ui/Cite'
import type { SourceId } from '@/lib/sources'
import { Cta } from './Cta'
import { Heading } from './Words'

// Copy: riset-ui/15 S8, with 5, 6 and 9 checked against PRD-00 (§1, §3, §4.2–4.3): the controller signs and
// pays gas from its registered wallet; Sepolia is the demo network; Merkle batching and L2 are roadmap,
// not built; AI only explains and drafts; citizens need no wallet. `cite` points at lib/sources.ts (shown on /why).
export const FAQ: { q: string; a: string; cite?: readonly SourceId[] }[] = [
  {
    q: 'Who uses Saksi?',
    a: 'Three people. A company (the controller) records each access from its registered wallet. A citizen gets a receipt and checks it on their phone. A regulator sees on-time or late breach notices and altered rows, without asking the company for access.',
  },
  {
    q: 'Why don’t citizens need a wallet?',
    a: 'Checking is reading, and reading a public chain is free. Your phone asks a public RPC node and recomputes the fingerprint itself. Only the company signs, because only the company makes claims.',
  },
  {
    q: 'How is this different from a normal audit log?',
    a: 'A normal log lives in the company’s own database, so whoever can write to it can rewrite it. Saksi seals a fingerprint of each entry on a public chain the moment it is written. If someone changes the row later, the fingerprint no longer matches.',
    cite: ['djp-npwp-2024'],
  },
  {
    q: 'Doesn’t the law already require access logs?',
    a: 'Yes. UU PDP Art. 31 requires every controller to record all processing of personal data, and OJK’s lending rule (POJK 40/2024) asks for non-repudiation and an audit trail usable in disputes. Both leave the log inside the company. Saksi makes that same record checkable by the person it is about.',
    cite: ['uu-pdp-31', 'pojk-40-2024'],
  },
  {
    q: 'What does Saksi not prove?',
    a: 'It does not prove that the access was lawful, that the stated reason is true, or that every access was recorded. It proves three things: the record has not changed since it was sealed, when it was sealed, and which registered wallet sealed it.',
  },
  {
    q: 'What goes on chain? Is my data public?',
    a: 'A fingerprint of the record and a keyed pseudonym (HMAC) in place of your identity, plus a salted hash of the purpose, the access type, the legal-basis code and the time. No names, no ID numbers, no record contents. The readable details stay on the company’s server.',
    cite: ['uu-pdp-20'],
  },
  {
    q: 'What does it cost, and who pays?',
    a: 'The company (the controller) signs every record in its own wallet, so it pays the gas: one small transaction per access. Saksi’s server never holds a key and pays nothing. Saksi runs on the Sepolia testnet, where gas costs no real money. Batching many records into one transaction (Merkle) and moving to an L2 are on the roadmap, not built.',
  },
  {
    q: 'What if a company never records an access?',
    a: 'Then there is no receipt, and Saksi cannot invent one. We state that limit openly. What Saksi does is make recorded history impossible to quietly rewrite, and make a breach notice that never arrives show up as late.',
  },
  {
    q: 'How does the 72-hour rule (UU PDP Art. 46) work here?',
    a: 'The breach notice is sealed with its own block time. The contract compares that time with the declared discovery time. On time or late is computed by code, not claimed in a PDF.',
    cite: ['uu-pdp-46'],
  },
  {
    q: 'Why Sepolia and not mainnet?',
    a: 'Saksi uses synthetic data only for now. A public testnet gives judges real, checkable transactions without anyone spending real money. The contracts and the in-browser verifier are ordinary EVM code; moving to mainnet or an L2 is a roadmap step we have not taken.',
  },
  {
    q: 'What does the AI do?',
    a: 'It explains a receipt in plain language and drafts the Art. 46 breach notice. It never decides. MATCH, ALTERED, on time and late are always computed by code and the contract, and every AI output is labelled with its model.',
  },
]


/**
 * S8 FAQ (17 B.7 / C.6): sticky heading column, plain hairline rows, a bare + / − glyph (the whole row is the
 * hit area), 400 ms height via grid rows, one open at a time, first open by default. Without JS every
 * answer is shown (scripting: none).
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative scroll-mt-24 border-t border-line py-16 md:py-[104px]">
      <div className="frame grid gap-10 px-3 md:px-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-4">
          <div className="flex flex-col justify-between gap-8 lg:sticky lg:top-28 lg:h-[calc(100svh-208px)] lg:max-h-[560px]">
            <Heading id="faq-title" lead="Questions people ask." tail="Short answers." className="text-[34px] leading-[1.04] md:text-[56px]" />
            <div className="hidden lg:block">
              <Cta href="/enter">Open the app</Cta>
            </div>
          </div>
        </div>
        <ul className="faq border-b border-line lg:col-span-7 lg:col-start-6" data-stagger="">
          {FAQ.map((f, i) => {
            const on = open === i
            return (
              <li key={f.q} className="border-t border-line">
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`faq-a-${i}`}
                    id={`faq-q-${i}`}
                    onClick={() => setOpen(on ? null : i)}
                    className="group grid min-h-11 w-full grid-cols-[1fr_24px] items-baseline gap-x-4 py-6 text-left md:gap-x-6"
                  >
                    <span className="text-[19px] font-medium leading-[1.3] tracking-[-0.015em] text-ink md:text-[22px]">{f.q}</span>
                    <span
                      aria-hidden="true"
                      className="relative grid size-6 translate-y-[3px] place-items-center self-start text-ink transition-colors duration-150 group-hover:text-blue"
                    >
                      <span className="absolute h-[1.5px] w-3.5 rounded-full bg-current" />
                      <span
                        className={`absolute h-3.5 w-[1.5px] rounded-full bg-current transition-transform duration-[400ms] ease-[cubic-bezier(.23,1,.32,1)] ${on ? 'rotate-90' : ''}`}
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  inert={!on}
                  data-open={on || undefined}
                  className="faq-panel grid"
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[62ch] pb-7 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]">
                      {f.a}
                      {f.cite ? <Cite ids={f.cite} /> : null}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
