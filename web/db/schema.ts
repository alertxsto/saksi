import { sql } from 'drizzle-orm';
import { bigint, char, check, index, integer, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const epoch = (name: string) => bigint(name, { mode: 'number' });
const status = pgEnum('record_status', ['pending', 'submitted', 'anchored', 'failed']);
const mode = pgEnum('breach_mode', ['on_time', 'late']);
const feature = pgEnum('ai_feature', ['explain', 'draft']);
const fallback = pgEnum('ai_fallback', ['primary', 'fallback', 'cached', 'template']);
const action = pgEnum('tamper_action', ['edit', 'delete', 'restore']);
export const controllers = pgTable('controllers', {
  id: text().primaryKey(), slug: text().notNull().unique(), name: text().notNull(),
  eoa: text().notNull(), registryTx: text('registry_tx'), createdAt: createdAt(),
});
export const subjects = pgTable('subjects', {
  id: uuid().primaryKey().defaultRandom(), code: char({ length: 6 }).notNull().unique(),
  displayName: text('display_name').notNull(), pseudonymSaltEnc: text('pseudonym_salt_enc'),
  pseudonymSaltIv: text('pseudonym_salt_iv'), createdAt: createdAt(),
}, (t) => [check('subject_salt_pair', sql`(${t.pseudonymSaltEnc} is null) = (${t.pseudonymSaltIv} is null)`)]);
export const accessEvents = pgTable('access_events', {
  id: uuid().primaryKey().defaultRandom(), controllerId: text('controller_id').notNull().references(() => controllers.id),
  subjectId: uuid('subject_id').references(() => subjects.id), subjectPseudonym: text('subject_pseudonym').notNull(),
  purposeTextEnc: text('purpose_text_enc').notNull(), purposeSaltEnc: text('purpose_salt_enc').notNull(), encIv: text('enc_iv').notNull(),
  purposeHash: text('purpose_hash').notNull(), legalBasisKey: text('legal_basis_key').notNull(), eventType: smallint('event_type').notNull(),
  evidenceEnc: text('evidence_enc').notNull(), evidenceIv: text('evidence_iv').notNull(), evidenceHash: text('evidence_hash').notNull(),
  status: status().default('pending').notNull(), failReason: text('fail_reason'), txHash: text('tx_hash'), logIndex: integer('log_index'),
  blockNumber: epoch('block_number'), blockTime: epoch('block_time'), createdAt: createdAt(),
}, (t) => [index('access_by_subject').on(t.subjectId, t.createdAt), index('access_by_controller').on(t.controllerId, t.createdAt),
  uniqueIndex('access_event_log').on(t.txHash, t.logIndex), check('access_event_type', sql`${t.eventType} between 0 and 3`)]);
export const aiRuns = pgTable('ai_runs', {
  id: uuid().primaryKey().defaultRandom(), feature: feature().notNull(), provider: text().notNull(), model: text().notNull(),
  promptVersion: text('prompt_version').notNull(), inputHash: text('input_hash').notNull(), outputJson: jsonb('output_json').notNull(),
  outputHash: text('output_hash').notNull(), latencyMs: integer('latency_ms').notNull(), fallbackLevel: fallback('fallback_level').notNull(), createdAt: createdAt(),
}, (t) => [index('ai_cache_lookup').on(t.feature, t.inputHash, t.createdAt)]);
export const breachReports = pgTable('breach_reports', {
  id: uuid().primaryKey().defaultRandom(), controllerId: text('controller_id').notNull().references(() => controllers.id),
  reportJsonEnc: text('report_json_enc').notNull(), reportIv: text('report_iv').notNull(), reportHash: text('report_hash').notNull(),
  affectedCountEnc: text('affected_count_enc').notNull(), countSaltEnc: text('count_salt_enc').notNull(), affectedCountHash: text('affected_count_hash').notNull(),
  detectedAt: epoch('detected_at').notNull(), mode: mode().notNull(), status: status().default('pending').notNull(),
  txHash: text('tx_hash'), logIndex: integer('log_index'), anchoredAt: epoch('anchored_at'), lateBySec: epoch('late_by_sec'),
  aiRunId: uuid('ai_run_id').references(() => aiRuns.id), createdAt: createdAt(),
}, (t) => [uniqueIndex('breach_event_log').on(t.txHash, t.logIndex)]);
export const tamperLog = pgTable('tamper_log', {
  id: uuid().primaryKey().defaultRandom(), targetTable: text('target_table').notNull(), targetId: uuid('target_id').notNull(),
  action: action().notNull(), beforeSnapshotEnc: text('before_snapshot_enc').notNull(), beforeHash: text('before_hash').notNull(),
  afterHash: text('after_hash'), at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('tamper_by_target').on(t.targetId, t.at)]);
export const citizenRateLimits = pgTable('citizen_rate_limits', {
  key: text().primaryKey(), window: epoch('window').notNull(), count: integer().notNull(),
});
