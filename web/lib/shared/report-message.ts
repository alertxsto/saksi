// Shared by the regulator screen (asks the wallet to sign) and the server (verifies the signature).
export const REPORT_REASONS = ['not_me', 'object', 'altered'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_VERDICTS = ['MATCH', 'ALTERED', 'NOT_FOUND', 'DELETED'] as const;
export type ReportVerdict = (typeof REPORT_VERDICTS)[number];
export const REPORT_NOTE_MAX = 280;
/** A review signature is accepted for 5 minutes after `signedAt`. */
export const REVIEW_WINDOW_MS = 5 * 60_000;
/** The EIP-191 message the ControllerRegistry admin signs to mark one report reviewed. */
export const reviewMessage = (id: string, signedAt: string) => `Saksi: mark report ${id} reviewed at ${signedAt}`;
