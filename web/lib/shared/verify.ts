import { createReceiptVerifier } from './chain';
import { evidenceHash, purposeHash } from './commit';

export const verifyReceipt = createReceiptVerifier({ evidenceHash, purposeHash });
