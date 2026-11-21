import { z } from 'zod';
import { accessInput, confirmAccess, confirmInput, prepareAccess, recentAccess, submitAccess, submitInput } from '../../../lib/server/access';
import { breachDetails, confirmBreach, listBreaches, prepareBreach, prepareBreachInput, submitBreach } from '../../../lib/server/breach';
import { createCitizen, citizenReceipts, deleteCitizen } from '../../../lib/server/citizen';
import { hash } from '../../../lib/server/chain';
import { HttpError, input, json, missing, requireDemoToken } from '../../../lib/server/http';
import { draft, draftInput, explain, explainInput } from '../../../lib/server/ai';
import { serviceStatus } from '../../../lib/server/status';
import { tamper, tamperInput } from '../../../lib/server/tamper';
import { watch } from '../../../lib/server/watch';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
async function route(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  const url = new URL(request.url);
  try {
    switch (request.method + ' ' + path.join('/')) {
      case 'POST citizen/session': {
        await input(request, z.strictObject({}));
        const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local';
        return json(await createCitizen(ip), 201);
      }
      case 'GET citizen/receipts': return json(await citizenReceipts());
      case 'DELETE citizen/session': await deleteCitizen(); return new Response(null, { status: 204 });
      case 'POST controller/access/prepare': return json(await prepareAccess(await input(request, accessInput)), 201);
      case 'POST controller/access/submit': return json(await submitAccess(await input(request, submitInput)));
      case 'POST controller/access/confirm': return json(await confirmAccess((await input(request, confirmInput)).id));
      case 'GET controller/access/recent': return json(await recentAccess(hash.parse(url.searchParams.get('controllerId'))));
      case 'POST controller/breach/prepare': return json(await prepareBreach(await input(request, prepareBreachInput)), 201);
      case 'POST controller/breach/submit': return json(await submitBreach(await input(request, submitInput)));
      case 'POST controller/breach/confirm': return json(await confirmBreach((await input(request, confirmInput)).id));
      case 'GET regulator/breaches': return json(await listBreaches());
      case 'GET watch': {
        const controllerId = url.searchParams.get('controllerId');
        return json(await watch(controllerId === null ? undefined : hash.parse(controllerId)));
      }
      case 'POST demo/tamper':
        requireDemoToken(request);
        return json(await tamper(await input(request, tamperInput)));
      case 'POST ai/explain': return json(await explain(await input(request, explainInput)));
      case 'POST controller/breach/draft': return json(await draft(await input(request, draftInput)));
      case 'GET status':
        requireDemoToken(request);
        return json(await serviceStatus());
      default:
        if (request.method === 'GET' && path.length === 3 && path[0] === 'regulator' && path[1] === 'breaches') return json(await breachDetails(z.uuid().parse(path[2])));
        throw missing();
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof z.ZodError) return json({ error: { code: 'INVALID_INPUT', message: 'Please check the submitted values.' } }, 400);
    return json({ error: { code: 'UNAVAILABLE', message: 'Saksi is temporarily unavailable. Try again.' } }, 503);
  }
}
export { route as GET, route as POST, route as DELETE };
