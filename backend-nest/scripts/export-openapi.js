const fs = require('fs');
const path = require('path');

// This script will be run after build to export OpenAPI spec
// In production, use swagger-cli or similar tools

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'GRC Platform API',
    version: '0.1.0',
    description: 'GRC backend API with MFA, tenant isolation, and audit logging',
  },
  servers: [
    {
      url: 'http://localhost:5002/api/v2',
      description: 'Development server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  mfaCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-id',
      },
    },
  },
};

fs.writeFileSync(
  path.join(__dirname, '../openapi.json'),
  JSON.stringify(openApiSpec, null, 2),
);
console.log('✅ OpenAPI spec exported to openapi.json');

