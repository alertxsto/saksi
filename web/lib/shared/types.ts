import type { Hex } from 'viem';
export const EVENT_TYPES = ['READ', 'UPDATE', 'EXPORT', 'SHARE_THIRD_PARTY'] as const;
export type EventTypeName = (typeof EVENT_TYPES)[number];
export type EventTypeCode = 0 | 1 | 2 | 3;
/** Human-readable UI labels for each event type. */
export const EVENT_LABELS: Record<EventTypeName, string> = {
  READ: 'Read', UPDATE: 'Update', EXPORT: 'Export', SHARE_THIRD_PARTY: 'Shared with third party',
};
export const LEGAL_BASES = {
  'PDP-20-2-a': 'Consent', 'PDP-20-2-b': 'Contract', 'PDP-20-2-c': 'Legal obligation',
  'PDP-20-2-d': 'Vital interest', 'PDP-20-2-e': 'Public task', 'PDP-20-2-f': 'Legitimate interest',
} as const;
export type LegalBasisKey = keyof typeof LEGAL_BASES;
export const LEGAL_BASIS_KEYS = Object.keys(LEGAL_BASES) as LegalBasisKey[];
export type RecordStatus = 'pending' | 'submitted' | 'anchored' | 'failed';
export type ReceiptOpening = {
  eventId: string; controllerId: Hex; controllerName: string; subjectPseudonym: Hex;
  purposeText: string; purposeSalt: Hex; legalBasisKey: Hex; eventType: 0 | 1 | 2 | 3;
  evidence: Record<string, unknown>; txHash: Hex | null; logIndex: number | null; status: RecordStatus; createdAt: string;
};
export type VerifyResult = {
  status: 'MATCH' | 'MISMATCH' | 'NOT_FOUND';
  mismatches: { field: 'eventType' | 'legalBasis' | 'purpose' | 'evidence' | 'pseudonym' | 'contract'; db: string; chain: string }[];
  blockNumber?: bigint; blockTime?: number; confirmations?: number; elapsedMs: number; rpc: string;
};
export type WatchRow = {
  eventId: string | null; txHash: Hex; logIndex: number; controllerName: string;
  status: 'MATCH' | 'ALTERED' | 'DELETED' | 'NOT_ANCHORED';
  field?: string; dbValue?: string; chainValue?: string; blockNumber?: number;
};
export type BreachRow = {
  id: string; controllerName: string; title: string; detectedAt: number; anchoredAt: number | null;
  mode: 'on_time' | 'late'; lateBySec: number; hoursUsed: number; txHash: Hex | null; status: RecordStatus;
};
export type AiMeta = { provider: string; model: string; fallbackLevel: 'primary' | 'fallback' | 'cached' | 'template'; latencyMs: number };
export type Pasal46Fields = { dataAffected: string; whenAndHow: string; actionsTaken: string; contact: string };
/** Error body returned by every API route. `message` is English and safe to show in the UI. */
export type ApiError = { error: { code: string; message: string } };
