import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { RegMarks } from "@/components/ui/RegMarks";
import { QrBlock } from "@/components/ui/QrBlock";
import {
  CHAIN_NAME,
  CONTRACTS as CONTRACT_ADDRS,
  SITE_URL as SITE,
  explorerAddress,
} from "@/lib/env";
import { Cta } from "./Cta";
import { OdoText } from "./OdoText";
import { QrFlash } from "./QrFlash";
import { WitnessSealArt } from "./WitnessSealArt";
import { FrameRules, Heading } from "./Words";

const CONTRACTS = (
  Object.entries(CONTRACT_ADDRS) as [string, string | undefined][]
).filter((e): e is [string, string] => !!e[1]);

const COLS = [
  {
    h: "Try it",
    links: [
      ["/citizen", "Citizen app"],
      ["/controller", "Controller console"],
      ["/regulator/watch", "Regulator Watch"],
      ["/proof", "Public verifier"],
    ],
  },
  {
    h: "Learn",
    links: [
      ["#how", "How it works"],
      ["#breach", "72 hours"],
      ["#roles", "Roles"],
      ["#faq", "FAQ"],
      ["/why", "Why Saksi exists"],
      ["/why#sources", "Sources"],
    ],
  },
] as const;

/**
 * S9 closer + S10 footer as ONE vault (zaro: the page ends dark, closer and footer split by a single
 * hairline). The biggest type on the page lives here; words rise in; the QR's registration marks flash ice
 * once when it arrives (md+ only — on a phone you are already there). Each contract row shows only when its
 * address is set in env; never a placeholder pill. `base` prefixes the section anchors on other pages.
 */
export function SiteFooter({ base = "" }: { base?: string }) {
  return (
    <footer
      id="closer"
      data-surface="vault"
      className="vault grain relative mx-2 overflow-hidden rounded-t-xl bg-vault text-vault-ink md:mx-3"
    >
      <div className="relative">
        <FrameRules vault />
        <div className="frame relative grid gap-12 px-3 pb-20 pt-24 md:px-8 md:pb-[104px] md:pt-40 lg:grid-cols-12 lg:items-end lg:gap-6">
          <div className="lg:col-span-8">
            <Heading
              lead="Scan. Get a receipt."
              tail="Verify it."
              tailClass="text-vault-ink-2"
              className="max-w-[13ch] text-[48px] leading-[0.98] tracking-[-0.03em] sm:text-[64px] lg:text-[clamp(72px,7.4vw,112px)]"
            />
            <p className="mt-8 max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-vault-ink-2 md:text-[18px]">
              Become the citizen on your own phone. The demo company records an
              access, the receipt arrives, and your phone checks it against the
              chain.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Cta href="/citizen" variant="paper">
                Open the citizen demo
              </Cta>
              <Cta href="/proof" variant="ghost-vault">
                Verify a receipt
              </Cta>
            </div>
          </div>
          <QrFlash className="relative hidden w-[260px] justify-self-start md:block lg:col-span-4 lg:w-[min(100%,320px)] lg:justify-self-end">
            <RegMarks className="qr-mark bg-dot-2" size={8} />
            <div className="rounded-md bg-card p-4">
              <QrBlock
                value={`${SITE}/citizen`}
                label="QR code to open the Saksi citizen demo"
              />
            </div>
            <p className="label mt-4 text-center text-[12px] text-vault-ink-2">
              Judges: scan to open {SITE.replace(/^https?:\/\//, "")}/citizen
            </p>
          </QrFlash>
        </div>
      </div>

      <div className="border-t border-vault-line">
        <div className="chrome grid gap-10 pb-8 pt-14 md:grid-cols-4 md:gap-6 md:pt-16">
          <div>
            <Link
              href="/"
              className="flex min-h-11 w-fit items-center gap-2.5"
              aria-label="Saksi home"
            >
              <LogoMark tone="vault" />
              <span className="text-[19px] font-semibold tracking-[-0.04em]">
                saksi
              </span>
            </Link>
            <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-vault-ink-2">
              A witness for personal data under UU PDP. Hackathon build: every
              company and person is fictional, every record synthetic.
            </p>
          </div>
          {COLS.map((c) => (
            <nav key={c.h} aria-label={c.h}>
              <p className="text-[14px] font-medium">{c.h}</p>
              <ul className="mt-3">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href.startsWith("#") ? `${base}${href}` : href}
                      className="flex min-h-10 items-center text-[14px] md:min-h-7 tracking-[0.02em] text-[#dad8ce] transition-colors duration-150 hover:text-paper"
                    >
                      <OdoText>{label}</OdoText>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          {CONTRACTS.length ? (
            <div>
              <p className="flex items-center gap-2 text-[14px] font-medium">
                Contracts
                {CONTRACTS.length ? (
                  <span className="label flex items-center gap-1.5 text-[11px] font-normal text-ice">
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 rounded-full bg-ice motion-safe:animate-ping" />
                      <span className="relative size-2 rounded-full bg-ice" />
                    </span>
                    {CHAIN_NAME}
                  </span>
                ) : null}
              </p>
              {CONTRACTS.length ? (
                <ul className="mt-3">
                  {CONTRACTS.map(([name, a]) => (
                    <li key={name}>
                      <a
                        href={explorerAddress(a)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-10 items-center gap-2 font-mono md:min-h-7 text-[12px] text-[#dad8ce] transition-colors duration-150 hover:text-ice"
                      >
                        {name}{" "}
                        <span className="text-vault-ink-2">
                          {a.slice(0, 6)}…{a.slice(-4)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="chrome pb-6">
          <WitnessSealArt />
          <p className="sr-only">Saksi — tamper-evident access records</p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-vault-line pt-4">
            <p className="label text-[11px] text-vault-ink-2/70">
              © 2026 Saksi · hackathon build · synthetic data
            </p>
            <p className="label hidden text-[11px] text-vault-ink-2/70 pointer-fine:block">
              Move your cursor over the mark: Saksi witnesses it
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
