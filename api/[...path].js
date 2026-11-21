import { createDemoApi } from '../server/api.js';

// Vercel entry point: serves the same demo API the Vite dev server mounts at /api.
const handle = createDemoApi(process.env);

export default function handler(req, res) {
  req.url = req.url.replace(/^\/api/, '') || '/';
  return handle(req, res);
}
