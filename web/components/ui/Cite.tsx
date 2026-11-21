import type { SourceId } from '@/lib/sources'

/**
 * Inline citation hook. The owner asked for no footnote numbers in the copy (they read as leaked data), so
 * this renders nothing; every source stays listed in full on /why (#sources). Call sites keep their ids so
 * the mapping from claim to source is still in the code.
 */
export function Cite(_props: { ids: readonly SourceId[]; className?: string }) {
  return null
}
