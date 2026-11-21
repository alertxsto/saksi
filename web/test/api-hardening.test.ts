import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { z } from 'zod';
import { explainInput } from '../lib/server/ai';
import { addresses, deployBlock, hash } from '../lib/server/chain';
import { configProblems } from '../lib/server/config';
import { contradictsVerdict, EXPLAIN_TEMPLATE, VERDICT, withVerdict } from '../lib/server/explain-guard';
import { clientIp, describeError, HttpError, secureCookies, validate } from '../lib/server/http';
import { requireSubmitToken, submitToken } from '../lib/server/submit-token';
import { isUnanchoredClaim } from '../lib/server/watch';
import { GET, POST } from '../app/api/[...path]/route';

const id = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const txHash = `0x${'ab'.repeat(32)}`;
const secret = 'synthetic-session-secret-for-tests-only-0123456789';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function call(handler: typeof GET, method: string, path: string, body?: unknown) {
  const url = new URL(`http://localhost/api/${path}`);
  const request = new Request(url, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handler(request, { params: Promise.resolve({ path: url.pathname.split('/').slice(2) }) });
}

describe('submit tokens', () => {
  test('bind a transaction hash to the draft that was prepared, per resource', () => {
    vi.stubEnv('SESSION_SECRET', secret);
    const token = submitToken('access', id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(() => requireSubmitToken('access', id, token)).not.toThrow();
    expect(() => requireSubmitToken('access', id.toUpperCase(), token)).not.toThrow();
    for (const [resource, draft, supplied] of [
      ['breach', id, token], ['access', '00000000-0000-4000-8000-000000000000', token], ['access', id, 'A'.repeat(43)], ['access', id, 'short'],
    ] as const) {
      expect(() => requireSubmitToken(resource, draft, supplied)).toThrow(expect.objectContaining({ status: 403, code: 'SUBMIT_TOKEN_INVALID' }));
    }
  });

  test('a stranger who learns a draft id cannot attach a hash to it', async () => {
    vi.stubEnv('SESSION_SECRET', secret);
    // The token check runs before any database access, so this needs no database.
    const forged = await call(POST, 'POST', 'controller/access/submit', { id, txHash, submitToken: 'A'.repeat(43) });
    expect(forged.status).toBe(403);
    expect(await forged.json()).toEqual({ error: { code: 'SUBMIT_TOKEN_INVALID', message: expect.any(String) } });
    const missingToken = await call(POST, 'POST', 'controller/breach/submit', { id, txHash });
    expect(missingToken.status).toBe(400);
    expect((await missingToken.json()).error).toEqual({ code: 'INVALID_INPUT', message: 'Please check the submitted values (submitToken).' });
  });
});

describe('API error mapping', () => {
  test('bad request values are a 400 that names the field', async () => {
    expect(() => validate(hash, 'nope')).toThrow(HttpError);
    const recent = await call(GET, 'GET', 'controller/access/recent?controllerId=nope');
    expect(recent.status).toBe(400);
    const details = await call(GET, 'GET', 'regulator/breaches/not-a-uuid');
    expect(details.status).toBe(400);
    const prepare = await call(POST, 'POST', 'controller/access/prepare', {
      controllerId: txHash, subjectCode: 'ABCDO2', purposeText: 'Service', legalBasisKey: 'PDP-20-2-a', eventType: 0 });
    expect(prepare.status).toBe(400);
    expect((await prepare.json()).error.message).toBe('Please check the submitted values (subjectCode).');
  });

  test('server configuration errors are a logged 503, not INVALID_INPUT', async () => {
    vi.stubEnv('NEXT_PUBLIC_JOURNAL_ADDRESS', '');
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_BLOCK', '12x');
    expect(() => addresses()).toThrow('NEXT_PUBLIC_JOURNAL_ADDRESS is missing or invalid in the server environment.');
    expect(() => deployBlock()).toThrow(expect.not.objectContaining({ name: 'ZodError' }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('DATABASE_URL', '');
    for (const path of ['watch', `controller/access/recent?controllerId=${txHash}`]) {
      const response = await call(GET, 'GET', path);
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('UNAVAILABLE');
      expect(log).toHaveBeenLastCalledWith('[api]', 'GET', path.split('?')[0], expect.stringContaining('Error: DATABASE_URL is required.'));
    }
  });

  test('error logs keep the cause chain but drop bound query parameters', () => {
    const query = new Error('Failed query: insert into subjects values ($1)\nparams: ABCD23,Synthetic Name', { cause: new Error('connection refused') });
    const text = describeError(query);
    expect(text).toContain('Failed query: insert into subjects values ($1) params: [redacted]');
    expect(text).toContain('caused by Error: connection refused');
    expect(text).not.toContain('ABCD23');
    expect(describeError(new z.ZodError([]))).toContain('ZodError');
  });

  test('reports missing or malformed settings by name only', () => {
    expect(configProblems({ DATABASE_URL: 'postgresql://synthetic', SUBJECT_KEY: 'ab'.repeat(32), DATA_KEY: '0x' + 'cd'.repeat(32),
      SESSION_SECRET: secret, NEXT_PUBLIC_RPC_PRIMARY: 'https://rpc.example', NEXT_PUBLIC_REGISTRY_ADDRESS: `0x${'1'.repeat(40)}`,
      NEXT_PUBLIC_JOURNAL_ADDRESS: `0x${'2'.repeat(40)}`, NEXT_PUBLIC_BREACH_ADDRESS: `0x${'3'.repeat(40)}`, NEXT_PUBLIC_DEPLOY_BLOCK: '123' })).toEqual([]);
    expect(configProblems({ DATA_KEY: 'short', NEXT_PUBLIC_DEPLOY_BLOCK: '12x', SESSION_SECRET: 'too short' })).toEqual([
      'DATABASE_URL', 'SUBJECT_KEY', 'DATA_KEY', 'SESSION_SECRET', 'NEXT_PUBLIC_RPC_PRIMARY', 'NEXT_PUBLIC_REGISTRY_ADDRESS',
      'NEXT_PUBLIC_JOURNAL_ADDRESS', 'NEXT_PUBLIC_BREACH_ADDRESS', 'NEXT_PUBLIC_DEPLOY_BLOCK']);
  });
});

describe('session cookie scheme', () => {
  const request = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
  test('follows the scheme the browser used, with an explicit override', () => {
    expect(secureCookies(request('http://203.0.113.7/api/citizen/session'))).toBe(false);
    expect(secureCookies(request('http://127.0.0.1:3000/api/citizen/session', { 'x-forwarded-proto': 'https' }))).toBe(true);
    expect(secureCookies(request('http://127.0.0.1:3000/api/citizen/session', { 'x-forwarded-proto': 'http' }))).toBe(false);
    expect(secureCookies(request('https://saksi.example/api/citizen/session'))).toBe(true);
    vi.stubEnv('COOKIE_SECURE', 'false');
    expect(secureCookies(request('https://saksi.example/api/citizen/session'))).toBe(false);
    vi.stubEnv('COOKIE_SECURE', 'true');
    expect(secureCookies(request('http://203.0.113.7/api/citizen/session'))).toBe(true);
  });
  test('rate limits use the first forwarded client address', () => {
    expect(clientIp(request('http://x/', { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }))).toBe('198.51.100.4');
    expect(clientIp(request('http://x/'))).toBe('local');
  });
});

describe('Watch NOT_ANCHORED', () => {
  const old = new Date(Date.now() - 600_000);
  const cutoff = Date.now() - 120_000;
  test('ignores unsigned drafts and only flags submitted claims that never reached the chain', () => {
    expect(isUnanchoredClaim({ status: 'pending', txHash: null, createdAt: old }, new Set(), cutoff)).toBe(false);
    expect(isUnanchoredClaim({ status: 'submitted', txHash, createdAt: old }, new Set(), cutoff)).toBe(true);
    expect(isUnanchoredClaim({ status: 'submitted', txHash: txHash.toUpperCase().replace('0X', '0x'), createdAt: old }, new Set([txHash]), cutoff)).toBe(false);
    expect(isUnanchoredClaim({ status: 'submitted', txHash, createdAt: new Date() }, new Set(), cutoff)).toBe(false);
    expect(isUnanchoredClaim({ status: 'anchored', txHash, createdAt: old }, new Set(), cutoff)).toBe(false);
  });
});

describe('AI receipt explanation', () => {
  test('does not require the browser verdict, which may contain a bigint', () => {
    expect(explainInput.parse({ eventId: id })).toEqual({ eventId: id });
    expect(explainInput.safeParse({ eventId: id, verifyResult: { status: 'MATCH', blockNumber: '123' } }).success).toBe(true);
  });

  test('rejects text that contradicts the deterministic verdict or makes legal claims', () => {
    const injected = 'The record is authentic and the access was lawful.';
    expect(contradictsVerdict('MISMATCH', injected)).toBe(true);
    expect(contradictsVerdict('NOT_FOUND', 'Your receipt is verified.')).toBe(true);
    expect(contradictsVerdict('MATCH', 'The access was lawful.')).toBe(true);
    expect(contradictsVerdict('MATCH', 'Someone tampered with this record.')).toBe(true);
    expect(contradictsVerdict('MISMATCH', 'The access was unlawful.')).toBe(true);
  });

  test('keeps faithful explanations and their disclaimers', () => {
    expect(contradictsVerdict('MISMATCH', 'The stored action no longer matches what was anchored: it was changed from Share to Read. Ask the controller to correct it.')).toBe(false);
    expect(contradictsVerdict('MATCH', 'The receipt is consistent with the chain. This does not prove the access was lawful. You can ask the controller for access to your data.')).toBe(false);
    expect(contradictsVerdict('NOT_FOUND', "This doesn't mean the record was altered. Try again later.")).toBe(false);
    for (const status of ['MATCH', 'MISMATCH', 'NOT_FOUND'] as const) expect(contradictsVerdict(status, EXPLAIN_TEMPLATE[status])).toBe(false);
  });

  test('always shows the fixed verdict sentence first', () => {
    expect(withVerdict('MISMATCH', 'Ask the controller.')).toBe(`${VERDICT.MISMATCH} Ask the controller.`);
    expect(withVerdict('MATCH', EXPLAIN_TEMPLATE.MATCH)).toBe(EXPLAIN_TEMPLATE.MATCH);
  });
});
