import { z } from 'zod';
import { accessInput, confirmAccess, confirmInput, prepareAccess, recentAccess, submitAccess, submitInput } from '../../../lib/server/access';
import { breachDetails, confirmBreach, listBreaches, prepareBreach, prepareBreachInput, submitBreach } from '../../../lib/server/breach';
import { createCitizen, citizenReceipts, deleteCitizen } from '../../../lib/server/citizen';
import { hash } from '../../../lib/server/chain';
import { HttpError, clientIp, describeError, input, json, missing, requireDemoToken, sameOrigin, secureCookies, validate } from '../../../lib/server/http';
import { consume } from '../../../lib/server/rate-limit';
import { draft, draftInput, explain, explainInput } from '../../../lib/server/ai';
import { demoReceipts } from '../../../lib/server/demo';
import { stageStats } from '../../../lib/server/stats';
import { serviceStatus } from '../../../lib/server/status';
import { tamper, tamperInput } from '../../../lib/server/tamper';
import { watch } from '../../../lib/server/watch';
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
// Prepare writes a draft for any citizen code and answers 404 for unknown codes, so cap it per client IP.
async function limitPrepare(request: Request) {
  if (!await consume(`prepare:${clientIp(request)}`, 20)) throw new HttpError(429, 'RATE_LIMITED', 'Too many drafts from this network. Wait a minute and try again.');
}
// AI calls cost provider quota and draft is unauthenticated, so cap each network and every client together.
const aiLimits = { draft: { perIp: 6, global: 60 }, explain: { perIp: 20, global: 120 } } as const;
async function limitAi(request: Request, feature: keyof typeof aiLimits) {
  const { perIp, global } = aiLimits[feature];
  if (!await consume(`ai-${feature}:${clientIp(request)}`, perIp) || !await consume(`ai-${feature}:all`, global)) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many AI requests. Wait a minute and try again.');
  }
}
async function route(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  const url = new URL(request.url);
  try {
    if (request.method !== 'GET' && !sameOrigin(request)) throw new HttpError(403, 'BAD_ORIGIN', 'Cross-site requests are not allowed.');
    switch (request.method + ' ' + path.join('/')) {
      case 'POST citizen/session': {
        await input(request, z.strictObject({}));
        return json(await createCitizen(clientIp(request), secureCookies(request)), 201);
      }
      case 'GET citizen/receipts': return json(await citizenReceipts());
      case 'DELETE citizen/session': await deleteCitizen(); return new Response(null, { status: 204 });
      case 'POST controller/access/prepare': {
        const body = await input(request, accessInput);
        await limitPrepare(request);
        return json(await prepareAccess(body), 201);
      }
      case 'POST controller/access/submit': return json(await submitAccess(await input(request, submitInput)));
      case 'POST controller/access/confirm': return json(await confirmAccess((await input(request, confirmInput)).id));
      case 'GET controller/access/recent': return json(await recentAccess(validate(hash, url.searchParams.get('controllerId'))));
      case 'POST controller/breach/prepare': {
        const body = await input(request, prepareBreachInput);
        await limitPrepare(request);
        return json(await prepareBreach(body), 201);
      }
      case 'POST controller/breach/submit': return json(await submitBreach(await input(request, submitInput)));
      case 'POST controller/breach/confirm': return json(await confirmBreach((await input(request, confirmInput)).id));
      case 'GET regulator/breaches': return json(await listBreaches());
      case 'GET stats': return json(await stageStats());
      case 'GET watch': {
        const controllerId = url.searchParams.get('controllerId');
        return json(await watch(controllerId === null ? undefined : validate(hash, controllerId)));
      }
      case 'POST demo/tamper': {
        requireDemoToken(request);
        const body = await input(request, tamperInput);
        if (!await consume(`demo:${clientIp(request)}`, 30)) throw new HttpError(429, 'RATE_LIMITED', 'Too many tamper actions. Wait a minute and try again.');
        return json(await tamper(body));
      }
      case 'GET demo/receipts':
        requireDemoToken(request);
        return json(await demoReceipts());
      case 'POST ai/explain': {
        const body = await input(request, explainInput);
        await limitAi(request, 'explain');
        return json(await explain(body));
      }
      case 'POST controller/breach/draft': {
        const body = await input(request, draftInput);
        await limitAi(request, 'draft');
        return json(await draft(body));
      }
      case 'GET status':
        requireDemoToken(request);
        return json(await serviceStatus());
      default:
        if (request.method === 'GET' && path.length === 3 && path[0] === 'regulator' && path[1] === 'breaches') return json(await breachDetails(validate(z.uuid(), path[2])));
        throw missing();
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
    // Request input is validated with HttpError(400) above; anything else (configuration, stored data, DB, RPC) is ours.
    console.error('[api]', request.method, path.join('/'), describeError(error));
    return json({ error: { code: 'UNAVAILABLE', message: 'Saksi is temporarily unavailable. Try again.' } }, 503);
  }
}
export { route as GET, route as POST, route as DELETE };
