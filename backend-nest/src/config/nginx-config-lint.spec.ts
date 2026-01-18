/**
 * Nginx Configuration Lint Tests
 *
 * These tests validate critical nginx configuration settings to prevent
 * routing regressions. They run in CI without requiring Docker or network access.
 *
 * Key guardrail: Ensures the /api/ location block uses proxy_pass with a
 * trailing slash to strip the /api/ prefix when forwarding to backend.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('NginxConfigLint', () => {
  // Path from backend-nest/src/config/ to frontend/nginx.conf
  // Goes up 3 levels (config -> src -> backend-nest -> grc) then into frontend/
  const nginxConfigPath = path.resolve(
    __dirname,
    '../../../frontend/nginx.conf',
  );
  let nginxConfig: string;

  beforeAll(() => {
    // Read the nginx config file
    nginxConfig = fs.readFileSync(nginxConfigPath, 'utf-8');
  });

  describe('/api/ location block', () => {
    // Regex to extract the /api/ location block
    // Matches: location ^~ /api/ { ... }
    const apiLocationBlockRegex =
      /location\s+\^~\s+\/api\/\s*\{[\s\S]*?\n\s*\}/m;

    it('should have a location ^~ /api/ block', () => {
      const match = nginxConfig.match(apiLocationBlockRegex);
      expect(match).not.toBeNull();
      expect(match).toBeDefined();
    });

    it('should have proxy_pass http://backend/ with trailing slash in /api/ block', () => {
      const match = nginxConfig.match(apiLocationBlockRegex);
      expect(match).not.toBeNull();

      const apiBlock = match![0];

      // The trailing slash is CRITICAL - it strips the /api/ prefix
      // Without it: /api/grc/... -> backend receives /api/grc/... (404)
      // With it: /api/grc/... -> backend receives /grc/... (correct)
      expect(apiBlock).toContain('proxy_pass http://backend/;');
    });

    it('should NOT have proxy_pass http://backend; (without trailing slash) in /api/ block', () => {
      const match = nginxConfig.match(apiLocationBlockRegex);
      expect(match).not.toBeNull();

      const apiBlock = match![0];

      // This regex matches "proxy_pass http://backend;" but NOT "proxy_pass http://backend/;"
      // We use a negative lookahead to ensure there's no slash before the semicolon
      const incorrectProxyPassRegex = /proxy_pass\s+http:\/\/backend(?!\/);/;

      expect(apiBlock).not.toMatch(incorrectProxyPassRegex);
    });
  });

  describe('nginx config file existence', () => {
    it('should exist at the expected path', () => {
      expect(fs.existsSync(nginxConfigPath)).toBe(true);
    });
  });
});
