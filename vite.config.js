import { defineConfig, loadEnv } from 'vite';
import { createDemoApi } from './server/api.js';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  function attachApi(server) {
    server.middlewares.use('/api', createDemoApi(env));
  }
  return {
    plugins: [{
      name: 'torque-demo-api',
      configureServer: attachApi,
      configurePreviewServer: attachApi,
    }],
  };
});
