import { getDemoConfig } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';
import { createPartsStore } from './singlestore.js';

async function seedDemo() {
  const config = getDemoConfig(process.env);
  if (config.mode !== 'live') throw new Error('Set TORQUE_MODE=live in .env.local before seeding.');
  if (config.missing.length) throw new Error(`Missing credentials: ${config.missing.join(', ')}.`);

  const store = createPartsStore(process.env);
  const results = await Promise.allSettled([
    Promise.resolve().then(() => createLiveDiagnosis(process.env).seed()),
    Promise.resolve().then(() => store.seed()),
  ]);
  await store.close?.();

  const labels = ['Cognee Silvia M catalog', 'SingleStore Silvia M parts catalog'];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      console.log(`${labels[index]} is ready.`);
    } else {
      const error = result.reason;
      console.error(`${labels[index]} could not be seeded.`, error.diagnostic ?? error.code ?? error.name);
      process.exitCode = 1;
    }
  }
}

try {
  await seedDemo();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
