import 'server-only';
import { count, desc, eq, max, ne } from 'drizzle-orm';
import { db } from '../../db/client';
import { accessEvents, controllers, subjects } from '../../db/schema';
import type { EventTypeCode, RecordStatus } from '../shared/types';

// Public counters for the projected /stage screen. Only display fields leave the server: no purpose text,
// no pseudonyms, and the citizen code is masked to its first two characters.
const RECENT = 8;
export const maskCode = (code: string | null) => (code ? `${code.slice(0, 2)}••••` : '••••••');

export type StageStats = {
  citizens: number; receipts: number; lastSealAt: string | null;
  recent: { id: string; controllerName: string; eventType: EventTypeCode; citizenMasked: string; createdAt: string; status: RecordStatus }[];
};

export async function stageStats(): Promise<StageStats> {
  const anchored = eq(accessEvents.status, 'anchored');
  const [[citizens], [sealed], recent] = await Promise.all([
    db().select({ n: count() }).from(subjects),
    db().select({ n: count(), last: max(accessEvents.createdAt) }).from(accessEvents).where(anchored),
    db().select({
      id: accessEvents.id, controllerName: controllers.name, eventType: accessEvents.eventType,
      code: subjects.code, createdAt: accessEvents.createdAt, status: accessEvents.status,
    }).from(accessEvents)
      .innerJoin(controllers, eq(controllers.id, accessEvents.controllerId))
      .leftJoin(subjects, eq(subjects.id, accessEvents.subjectId))
      .where(ne(accessEvents.status, 'failed'))
      .orderBy(desc(accessEvents.createdAt)).limit(RECENT),
  ]);
  return {
    citizens: citizens?.n ?? 0,
    receipts: sealed?.n ?? 0,
    lastSealAt: sealed?.last ? new Date(sealed.last).toISOString() : null,
    recent: recent.map((r) => ({
      id: r.id, controllerName: r.controllerName, eventType: r.eventType as EventTypeCode,
      citizenMasked: maskCode(r.code), createdAt: new Date(r.createdAt).toISOString(), status: r.status,
    })),
  };
}
