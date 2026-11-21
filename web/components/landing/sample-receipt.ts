// A real, public receipt (synthetic data) sealed on Sepolia: the landing verifier checks it live from the visitor's
// browser against a public node. Same receipt as the README "try it" link. Nothing here is a placeholder.
import type { ReceiptOpening } from '@/lib/shared/types'

export const SAMPLE_RECEIPT: ReceiptOpening = {
  "eventId": "04bbba14-3619-46f0-b0d1-61e4196f6013",
  "controllerId": "0x9da7d677b86cad4006e4b9b1e8dcd1780889f82c90a79b47768fd323f464bc9b",
  "controllerName": "Demo Spare",
  "subjectPseudonym": "0x820e3fcd2df869ab498a79ae76149960a944f7809fd53700bbefda8f74138403",
  "purposeText": "Share contact details with a debt collection partner (synthetic demo for judges)",
  "purposeSalt": "0xd3f989519bf20764277b10f1bcd83976c0f50836e96df1cf0f13d856df3fb609",
  "legalBasisKey": "0x5044502d32302d322d6200000000000000000000000000000000000000000000",
  "eventType": 3,
  "evidence": {
    "v": 1,
    "eventId": "04bbba14-3619-46f0-b0d1-61e4196f6013",
    "nonce": "0x9b5b5ee2d7ff7341b9158bfacf57cd6722f40e9590492afedb18ba4048eaaaf6",
    "controllerId": "0x9da7d677b86cad4006e4b9b1e8dcd1780889f82c90a79b47768fd323f464bc9b",
    "system": "core-banking",
    "dataCategories": [
      "account profile",
      "account activity"
    ],
    "operatorRef": "synthetic-operator",
    "requestedAt": "2026-11-21T12:54:35.844Z"
  },
  "txHash": "0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11",
  "logIndex": 130,
  "status": "anchored",
  "createdAt": "2026-11-21T12:54:35.845Z"
}

/** Block that mined SAMPLE_RECEIPT.txHash (eth_getTransactionReceipt). */
export const SAMPLE_BLOCK = 12181964
export const SAMPLE_PROOF_HREF = `/proof/${SAMPLE_RECEIPT.txHash}/${SAMPLE_RECEIPT.logIndex}#eyJldmVudElkIjoiMDRiYmJhMTQtMzYxOS00NmYwLWIwZDEtNjFlNDE5NmY2MDEzIiwiY29udHJvbGxlcklkIjoiMHg5ZGE3ZDY3N2I4NmNhZDQwMDZlNGI5YjFlOGRjZDE3ODA4ODlmODJjOTBhNzliNDc3NjhmZDMyM2Y0NjRiYzliIiwiY29udHJvbGxlck5hbWUiOiJEZW1vIFNwYXJlIiwic3ViamVjdFBzZXVkb255bSI6IjB4ODIwZTNmY2QyZGY4NjlhYjQ5OGE3OWFlNzYxNDk5NjBhOTQ0Zjc4MDlmZDUzNzAwYmJlZmRhOGY3NDEzODQwMyIsInB1cnBvc2VUZXh0IjoiU2hhcmUgY29udGFjdCBkZXRhaWxzIHdpdGggYSBkZWJ0IGNvbGxlY3Rpb24gcGFydG5lciAoc3ludGhldGljIGRlbW8gZm9yIGp1ZGdlcykiLCJwdXJwb3NlU2FsdCI6IjB4ZDNmOTg5NTE5YmYyMDc2NDI3N2IxMGYxYmNkODM5NzZjMGY1MDgzNmU5NmRmMWNmMGYxM2Q4NTZkZjNmYjYwOSIsImxlZ2FsQmFzaXNLZXkiOiIweDUwNDQ1MDJkMzIzMDJkMzIyZDYyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJldmVudFR5cGUiOjMsImV2aWRlbmNlIjp7InYiOjEsImV2ZW50SWQiOiIwNGJiYmExNC0zNjE5LTQ2ZjAtYjBkMS02MWU0MTk2ZjYwMTMiLCJub25jZSI6IjB4OWI1YjVlZTJkN2ZmNzM0MWI5MTU4YmZhY2Y1N2NkNjcyMmY0MGU5NTkwNDkyYWZlZGIxOGJhNDA0OGVhYWFmNiIsImNvbnRyb2xsZXJJZCI6IjB4OWRhN2Q2NzdiODZjYWQ0MDA2ZTRiOWIxZThkY2QxNzgwODg5ZjgyYzkwYTc5YjQ3NzY4ZmQzMjNmNDY0YmM5YiIsInN5c3RlbSI6ImNvcmUtYmFua2luZyIsImRhdGFDYXRlZ29yaWVzIjpbImFjY291bnQgcHJvZmlsZSIsImFjY291bnQgYWN0aXZpdHkiXSwib3BlcmF0b3JSZWYiOiJzeW50aGV0aWMtb3BlcmF0b3IiLCJyZXF1ZXN0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ0WiJ9LCJ0eEhhc2giOiIweGMzMDczNjAwYWE2NDRiMTgyNWI0ZmM1NDMxOTExZTc1YmQ5MTRiODA3NTg1ZDVhZDExMzExNGUwOGEyNTlhMTEiLCJsb2dJbmRleCI6MTMwLCJzdGF0dXMiOiJhbmNob3JlZCIsImNyZWF0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ1WiJ9`
export const SAMPLE_TX_SHORT = `${SAMPLE_RECEIPT.txHash!.slice(0, 14)}…${SAMPLE_RECEIPT.txHash!.slice(-12)}`
