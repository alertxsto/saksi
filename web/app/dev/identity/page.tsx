import Link from 'next/link'

const DIRS = [
  ['a', 'Receipt Stub', 'Every access is a paper stub you can hold; the verdict is an official stamp.'],
  ['b', 'Night Vault', 'The app lives inside the vault; one glowing seal answers “is my data OK?”.'],
  ['c', 'Public Register', 'Civic infrastructure: Saksi blue identity card, serial-numbered register, the chain as real blocks.'],
] as const

export default function IdentityIndex() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Citizen identity directions</h1>
      <p className="mt-2 text-[15px] text-ink-2">Scoped variants for review (riset-ui/36). Production screens are unchanged.</p>
      <ul className="mt-8 flex flex-col gap-4">
        {DIRS.map(([id, name, pitch]) => (
          <li key={id} className="rounded-lg border border-line bg-card p-5">
            <p className="text-[18px] font-semibold">
              {id.toUpperCase()} · {name}
            </p>
            <p className="mt-1 text-[14px] text-ink-2">{pitch}</p>
            <p className="mt-3 flex gap-4 text-[14px] font-medium">
              <Link className="text-blue" href={`/dev/identity/${id}/home`}>Home 390</Link>
              <Link className="text-blue" href={`/dev/identity/${id}/detail`}>Detail 390</Link>
              <Link className="text-blue" href={`/dev/identity/${id}/workspace`}>Workspace 1440</Link>
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
