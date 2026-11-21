import { BreachClock } from '@/components/landing/BreachClock'
import { DotCurtain } from '@/components/landing/DotCurtain'
import { Faq } from '@/components/landing/Faq'
import { HeroDive } from '@/components/landing/HeroDive'
import { Nav } from '@/components/landing/Nav'
import { ProblemMoment } from '@/components/landing/ProblemMoment'
import { RevealRoot } from '@/components/landing/RevealRoot'
import { Roles } from '@/components/landing/Roles'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { StoryPin } from '@/components/landing/StoryPin'
import { Verifier } from '@/components/landing/Verifier'
import { FrameRules } from '@/components/landing/Words'

/**
 * Landing (riset-ui/15 §4, rebuilt against 16–19). One sheet, ruled like a ledger:
 * S1 hero dive (paper → vault) · curtain · S2 problem moment (paper) · curtain · S3+S4 StoryPin (vault) ·
 * curtain · S5 72-hour countdown · S6 roles · S7 verifier + limits · S8 FAQ (paper, frame rules) ·
 * S9 closer + S10 footer (one vault — the page ends dark).
 */
export default function Landing() {
  return (
    <>
      <SmoothScroll />
      <RevealRoot />
      <Nav />
      <main id="main" className="landing overflow-x-clip">
        <HeroDive />
        <DotCurtain from="vault" to="paper" className="dive-only" />

        <div className="relative">
          <FrameRules />
          <ProblemMoment />
        </div>

        <DotCurtain from="paper" to="vault" />
        <div id="how" data-surface="vault" className="scroll-mt-0 bg-vault">
          <StoryPin />
        </div>
        <DotCurtain from="vault" to="paper" />

        <div className="relative pb-24 md:pb-40">
          <FrameRules />
          <BreachClock />
          <Roles />
          <Verifier />
          <Faq />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
