import { randomUUID } from 'node:crypto';

// Payment is a simulated sandbox authorization: no card is charged.
export function authorizePayment(totalCents) {
  return { paymentRef: `PAY-SBX-${randomUUID().slice(0, 8).toUpperCase()}`, paymentStatus: 'authorized', amountCents: totalCents };
}

// Sends the order to the seller's ordering API when SUPPLIER_ORDER_URL is set.
// Without it, the order is held so the technician can place it with the seller by hand.
export function createSupplierClient(env, { fetch: fetcher = globalThis.fetch } = {}) {
  const endpoint = env.SUPPLIER_ORDER_URL?.trim();
  return async function submitOrder(order) {
    if (!endpoint) return 'not_connected';
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      return response.ok ? 'submitted' : `rejected_${response.status}`;
    } catch {
      return 'unreachable';
    }
  };
}
