const apiVersion = '2026-09-29';

export class PersonaError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createPersonaVerifier(env, { fetch: fetcher = globalThis.fetch } = {}) {
  const key = env.PERSONA_API_KEY?.trim();
  const fixedInquiryId = env.PERSONA_INQUIRY_ID?.trim();

  // With an inquiry id from this order's selfie check, Persona must report it finished.
  // Without one, the fixed demo inquiry from .env.local must be approved.
  return async function verifyTechnician(orderInquiryId) {
    const perOrder = Boolean(orderInquiryId);
    const inquiryId = orderInquiryId ?? fixedInquiryId;
    if (!key?.startsWith('persona_sandbox_') || !/^inq_[a-z0-9]+$/i.test(inquiryId ?? '')) {
      throw new PersonaError(503, 'Set PERSONA_API_KEY to a Sandbox key and PERSONA_INQUIRY_ID to an approved test inquiry in .env.local.');
    }

    const url = new URL(`https://api.withpersona.com/api/v1/inquiries/${inquiryId}`);
    url.searchParams.set('fields[inquiry]', 'status');
    let response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${key}`, 'Persona-Version': apiVersion },
        redirect: 'error',
        signal: AbortSignal.timeout(6500),
      });
    } catch {
      throw new PersonaError(502, 'Torque could not reach Persona Sandbox. Try approving again.');
    }

    if ([401, 403, 404].includes(response.status)) {
      throw new PersonaError(503, 'Check that the Persona Sandbox key can read inquiries and that the inquiry is in the same Sandbox.');
    }
    if (!response.ok) {
      throw new PersonaError(502, `Persona Sandbox could not check the inquiry (HTTP ${response.status}). Try approving again.`);
    }

    const payload = await response.json().catch(() => null);
    const inquiry = payload?.data;
    const status = inquiry?.attributes?.status;
    if (inquiry?.id !== inquiryId || inquiry?.type !== 'inquiry' || typeof status !== 'string') {
      throw new PersonaError(502, 'Persona Sandbox returned an invalid inquiry response.');
    }
    if (perOrder && status === 'completed') return status;
    if (status !== 'approved') {
      throw new PersonaError(403, 'Persona has not approved the demo technician. Approve the test inquiry in Persona Sandbox, then retry.');
    }
    return status;
  };
}

const inquiryIdPattern = /^inq_[a-z0-9]+$/i;

// Starts a fresh Persona Sandbox check for one order and returns a one-time link for the technician's phone.
export function createPersonaSessions(env, { fetch: fetcher = globalThis.fetch } = {}) {
  const key = env.PERSONA_API_KEY?.trim();
  const templateId = env.PERSONA_TEMPLATE_ID?.trim();

  async function call(path, init = {}) {
    if (!key?.startsWith('persona_sandbox_') || !/^itmpl_[a-z0-9]+$/i.test(templateId ?? '')) {
      throw new PersonaError(503, 'Set PERSONA_API_KEY to a Sandbox key and PERSONA_TEMPLATE_ID to a Sandbox inquiry template in .env.local.');
    }
    let response;
    try {
      response = await fetcher(`https://api.withpersona.com/api/v1${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'Persona-Version': apiVersion, 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(6500),
      });
    } catch {
      throw new PersonaError(502, 'Torque could not reach Persona Sandbox. Try again.');
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new PersonaError(502, `Persona Sandbox refused the request (HTTP ${response.status}).`);
    return payload;
  }

  return {
    async start(requestId) {
      const created = await call('/inquiries', {
        method: 'POST',
        body: JSON.stringify({ data: { attributes: { 'inquiry-template-id': templateId, 'reference-id': `torque-${requestId}` } } }),
      });
      const inquiryId = created?.data?.id;
      if (!inquiryIdPattern.test(inquiryId ?? '')) throw new PersonaError(502, 'Persona Sandbox returned an invalid inquiry.');
      const link = await call(`/inquiries/${inquiryId}/generate-one-time-link`, { method: 'POST' });
      const url = link?.meta?.['one-time-link'];
      if (typeof url !== 'string' || !url.startsWith('https://')) throw new PersonaError(502, 'Persona Sandbox did not return a verification link.');
      return { inquiryId, url };
    },
    async status(inquiryId) {
      if (!inquiryIdPattern.test(inquiryId ?? '')) throw new PersonaError(400, 'Unknown verification.');
      const payload = await call(`/inquiries/${inquiryId}?fields%5Binquiry%5D=status`);
      return payload?.data?.attributes?.status ?? 'unknown';
    },
  };
}
