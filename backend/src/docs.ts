import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

// docs/openapi.yaml sits next to src/ (dev) or two levels above dist/src/ (build).
const SPEC_PATH = [path.join(__dirname, '..', 'docs', 'openapi.yaml'), path.join(__dirname, '..', '..', 'docs', 'openapi.yaml')].find(
  existsSync,
);

export function loadOpenApiSpec(): Record<string, unknown> {
  if (!SPEC_PATH) throw new Error('docs/openapi.yaml not found');
  // Parsing resolves the YAML aliases used for shared examples; the helper block itself is dropped.
  const { 'x-examples': _examples, ...spec } = parse(readFileSync(SPEC_PATH, 'utf8'), { maxAliasCount: -1 });
  return spec;
}

// GET /api/docs               -> Swagger UI
// GET /api/docs/openapi.json  -> raw OpenAPI 3 document (for client generators / Postman import)
export function docsRouter() {
  const spec = loadOpenApiSpec();
  const router = Router();
  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'NovaWorks CRM API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
  return router;
}
