export const requiredLiveCredentials = [
  'COGNEE_API_KEY',
  'SINGLESTORE_HOST',
  'SINGLESTORE_DATABASE',
  'SINGLESTORE_USER',
  'SINGLESTORE_PASSWORD',
];

export function getDemoConfig(env) {
  const mode = (env.TORQUE_MODE || 'mock').trim().toLowerCase();
  if (!['mock', 'live'].includes(mode)) throw new Error('TORQUE_MODE must be mock or live.');
  const missing = mode === 'live'
    ? requiredLiveCredentials.filter((key) => !env[key]?.trim())
    : [];
  return { mode, missing };
}
