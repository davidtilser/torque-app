const apiVersion = '2026-09-29';

export class PersonaError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createPersonaVerifier(env, { fetch: fetcher = globalThis.fetch } = {}) {
  const key = env.PERSONA_API_KEY?.trim();
  const inquiryId = env.PERSONA_INQUIRY_ID?.trim();

  return async function verifyTechnician() {
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
    if (status !== 'approved') {
      throw new PersonaError(403, 'Persona has not approved the demo technician. Approve the test inquiry in Persona Sandbox, then retry.');
    }
    return status;
  };
}
