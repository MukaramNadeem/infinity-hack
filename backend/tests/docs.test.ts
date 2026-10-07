import SwaggerParser from '@apidevtools/swagger-parser';
import type { Router } from 'express';
import { API_ROUTERS } from '../src/app';
import { loadOpenApiSpec } from '../src/docs';
import { api } from './helpers';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type Operation = {
  summary?: string;
  requestBody?: { content: Record<string, MediaType> };
  responses: Record<string, { content?: Record<string, MediaType> }>;
};
type MediaType = { example?: unknown; examples?: Record<string, unknown> };
type Spec = { paths: Record<string, Partial<Record<(typeof METHODS)[number], Operation>>> };

// "GET /projects/{id}" for every route registered on the API routers.
function expressRoutes(): string[] {
  const routes: string[] = [];
  for (const [prefix, router] of API_ROUTERS) {
    for (const layer of (router as Router & { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack) {
      if (!layer.route) continue;
      const path = (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(/:(\w+)/g, '{$1}');
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled && method !== '_all') routes.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return routes.sort();
}

function documentedOperations(spec: Spec): string[] {
  return Object.entries(spec.paths)
    .flatMap(([path, item]) => METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`))
    .sort();
}

describe('OpenAPI document (docs/openapi.yaml)', () => {
  const spec = loadOpenApiSpec() as unknown as Spec;

  it('is a valid OpenAPI 3 document', async () => {
    await expect(SwaggerParser.validate(structuredClone(spec) as never)).resolves.toBeDefined();
  });

  it('documents exactly the routes the app serves', () => {
    expect(documentedOperations(spec)).toEqual(expressRoutes());
    expect(expressRoutes().length).toBeGreaterThanOrEqual(20);
  });

  it('gives every operation a summary, and an example for every request body and JSON response', () => {
    const missing: string[] = [];
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = item[method];
        if (!op) continue;
        const name = `${method.toUpperCase()} ${path}`;
        if (!op.summary) missing.push(`${name}: summary`);

        const body = op.requestBody?.content['application/json'];
        if (op.requestBody && !body?.example && !body?.examples) missing.push(`${name}: request example`);

        for (const [status, response] of Object.entries(op.responses)) {
          const json = response.content?.['application/json'];
          if (response.content && !json?.example && !json?.examples) missing.push(`${name} ${status}: response example`);
        }
        if (!Object.keys(op.responses).some((s) => s.startsWith('2'))) missing.push(`${name}: success response`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('expands the shared examples (no unresolved references inside examples)', () => {
    const text = JSON.stringify(spec);
    expect(text).not.toContain('#/components/examples');
    expect(text).not.toContain('x-examples');
    const login = spec.paths['/auth/login'].post!.responses['200'].content!['application/json'].example as { user: { code: string } };
    expect(login.user.code).toBe('DEV01');
  });
});

describe('GET /api/docs', () => {
  it('serves Swagger UI', async () => {
    const res = await api().get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('redirects /api/docs to /api/docs/ so the UI assets resolve', async () => {
    const res = await api().get('/api/docs');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/api/docs/');
  });

  it('serves the raw OpenAPI JSON', async () => {
    const res = await api().get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toContain('/transcripts');
  });

  it('is public (no token needed)', async () => {
    expect((await api().get('/api/docs/openapi.json')).status).toBe(200);
  });
});

describe('CORS', () => {
  it('answers a preflight from the frontend URL', async () => {
    const res = await api()
      .options('/api/projects')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('allows every origin listed in FRONTEND_URL (comma-separated, trailing slash ignored)', async () => {
    const res = await api().get('/api/health').set('Origin', 'https://crm.novaworks.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://crm.novaworks.example');
  });

  it('treats localhost and 127.0.0.1 as the same frontend origin', async () => {
    const res = await api().get('/api/health').set('Origin', 'http://127.0.0.1:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');

    const otherPort = await api().get('/api/health').set('Origin', 'http://127.0.0.1:3000');
    expect(otherPort.status).toBe(403);
  });

  it('rejects other origins', async () => {
    const res = await api().get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_NOT_ALLOWED');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not affect requests without an Origin header (curl, server-to-server)', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
  });
});
