/** Public proof gallery states (?s=…). Plain module so the server page can validate the param. */
export const PROOF_STATES = {
  home: 'Idle · paste, open file or scan',
  missing: 'Fingerprint only · grey note',
  checking: 'Checking · stepper waits on the node',
  match: 'MATCH · green stamp',
  altered: 'ALTERED · red stamp + action diff',
  'altered-fields': 'ALTERED · two fields',
  notfound: 'NOT FOUND · grey, no stamp',
  error: 'Node did not answer · nothing decided',
  entry: 'Shared link without the receipt · sealed entry, nothing to compare',
  'entry-missing': 'Shared link without the receipt · no entry on this node',
  incomplete: 'Damaged link · grey',
} as const
export type ProofState = keyof typeof PROOF_STATES
