/** Receipt-ticket gallery states (?s=…). Plain module so the server page can validate the param. */
export const TICKET_STATES = {
  match: 'MATCH · green stamp + readout',
  'match-ai': 'MATCH · AI answered',
  long: 'Long agency name · MATCH caught in background',
  'long-rsud': 'RSUD · two fields altered',
  checking: 'Checking · stamp ring breathing',
  idle: 'Before verify',
  pending: 'Pending · amber Sealing…',
  altered: 'ALTERED · red stamp + diff (tamper demo)',
  'altered-fields': 'ALTERED · two fields',
  notfound: 'NOT FOUND · grey note, no stamp',
  error: 'Verify error',
  missing: 'Receipt not found',
  deleted: 'Deleted by the company + report',
  profile: 'Profile · pass + who opened your data',
  'profile-altered': 'Profile · one record altered',
  'profile-empty': 'Profile · no receipts yet',
} as const
export type TicketState = keyof typeof TICKET_STATES
