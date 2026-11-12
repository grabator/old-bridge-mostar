// Cloudflare Worker: serves the built site from dist/ (static assets) and handles POST /api/enquiry.
import { onRequestPost } from './functions/api/enquiry.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/enquiry') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
    }
    return env.ASSETS.fetch(request);
  }
};
