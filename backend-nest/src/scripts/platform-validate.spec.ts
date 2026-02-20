/**
 * Platform Validation Script Unit Tests
 *
 * Tests for the runtime detection and script path resolution logic
 * to ensure correct behavior in both dist (production) and src (development) environments.
 */

import * as path from 'path';

// We need to test the helper functions with mocked __dirname and __filename
// Since these are module-level constants, we'll test the logic directly

describe('PlatformValidate Runtime Detection', () => {
  describe('isDistRuntime logic', () => {
    /**
     * Helper function that replicates the isDistRuntime logic for testing
     * with arbitrary dirname and filename values.
     */
    function testIsDistRuntime(dirname: string, filename: string): boolean {
      try {
        // Normalize path separators for cross-platform compatibility
        const normalizedDirname = dirname.replace(/\\/g, '/');
        const normalizedFilename = (filename || '').replace(/\\/g, '/');

        // Check if __dirname contains '/dist/' or ends with '/dist'
        if (
          normalizedDirname.includes('/dist/') ||
          normalizedDirname.endsWith('/dist')
        ) {
          return true;
        }

        // Check if __filename ends with .js and contains '/dist/'
        if (
          normalizedFilename.endsWith('.js') &&
          normalizedFilename.includes('/dist/')
        ) {
          return true;
        }

        // Check if __filename ends with .ts (definitely in src mode)
        if (normalizedFilename.endsWith('.ts')) {
          return false;
        }

        // Check if __dirname contains '/src/' or ends with '/src'
        if (
          normalizedDirname.includes('/src/') ||
          normalizedDirname.endsWith('/src')
        ) {
          return false;
        }

        // Default to src mode for safety (dev-friendly)
        return false;
      } catch {
        // If all checks fail, default to src mode for safety
        return false;
      }
    }

    describe('Linux/macOS paths', () => {
      it('should detect dist runtime when __dirname contains /dist/', () => {
        const result = testIsDistRuntime(
          '/app/dist/scripts',
          '/app/dist/scripts/platform-validate.js',
        );
        expect(result).toBe(true);
      });

      it('should detect dist runtime when __dirname ends with /dist', () => {
        const result = testIsDistRuntime(
          '/home/ubuntu/repos/grc/backend-nest/dist',
          '/home/ubuntu/repos/grc/backend-nest/dist/platform-validate.js',
        );
        expect(result).toBe(true);
      });

      it('should detect src runtime when __dirname contains /src/', () => {
        const result = testIsDistRuntime(
          '/home/ubuntu/repos/grc/backend-nest/src/scripts',
          '/home/ubuntu/repos/grc/backend-nest/src/scripts/platform-validate.ts',
        );
        expect(result).toBe(false);
      });

      it('should detect src runtime when __dirname ends with /src', () => {
        const result = testIsDistRuntime(
          '/home/ubuntu/repos/grc/backend-nest/src',
          '/home/ubuntu/repos/grc/backend-nest/src/platform-validate.ts',
        );
        expect(result).toBe(false);
      });

      it('should detect src runtime when __filename ends with .ts', () => {
        const result = testIsDistRuntime(
          '/some/random/path',
          '/some/random/path/platform-validate.ts',
        );
        expect(result).toBe(false);
      });

      it('should detect dist runtime when __filename ends with .js and contains /dist/', () => {
        const result = testIsDistRuntime(
          '/some/random/path',
          '/app/dist/scripts/platform-validate.js',
        );
        expect(result).toBe(true);
      });

      it('should default to src mode when path is ambiguous', () => {
        const result = testIsDistRuntime(
          '/some/random/path',
          '/some/random/path/platform-validate.js',
        );
        expect(result).toBe(false);
      });
    });

    describe('Windows paths', () => {
      it('should detect dist runtime with Windows backslashes in __dirname', () => {
        const result = testIsDistRuntime(
          'C:\\Users\\dev\\grc\\backend-nest\\dist\\scripts',
          'C:\\Users\\dev\\grc\\backend-nest\\dist\\scripts\\platform-validate.js',
        );
        expect(result).toBe(true);
      });

      it('should detect src runtime with Windows backslashes in __dirname', () => {
        const result = testIsDistRuntime(
          'C:\\Users\\dev\\grc\\backend-nest\\src\\scripts',
          'C:\\Users\\dev\\grc\\backend-nest\\src\\scripts\\platform-validate.ts',
        );
        expect(result).toBe(false);
      });

      it('should handle mixed path separators', () => {
        const result = testIsDistRuntime(
          'C:/Users/dev/grc/backend-nest/dist/scripts',
          'C:\\Users\\dev\\grc\\backend-nest\\dist\\scripts\\platform-validate.js',
        );
        expect(result).toBe(true);
      });
    });

    describe('Docker container paths', () => {
      it('should detect dist runtime in Docker container (/app/dist)', () => {
        const result = testIsDistRuntime(
          '/app/dist/scripts',
          '/app/dist/scripts/platform-validate.js',
        );
        expect(result).toBe(true);
      });

      it('should detect dist runtime in Docker container (/app/dist without scripts)', () => {
        const result = testIsDistRuntime(
          '/app/dist',
          '/app/dist/platform-validate.js',
        );
        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty filename gracefully', () => {
        const result = testIsDistRuntime('/app/dist/scripts', '');
        expect(result).toBe(true); // __dirname contains /dist/
      });

      it('should handle path with "dist" in directory name but not as segment', () => {
        // "distribution" contains "dist" but is not a /dist/ segment
        const result = testIsDistRuntime(
          '/home/user/distribution/scripts',
          '/home/user/distribution/scripts/platform-validate.ts',
        );
        expect(result).toBe(false); // .ts file, so src mode
      });

      it('should handle path with "src" in directory name but not as segment', () => {
        // "resources" contains "src" but is not a /src/ segment
        const result = testIsDistRuntime(
          '/home/user/resources/scripts',
          '/home/user/resources/scripts/platform-validate.js',
        );
        // Neither /dist/ nor /src/ segment, .js file but no /dist/ in filename
        expect(result).toBe(false);
      });
    });
  });

  describe('resolveScript logic', () => {
    /**
     * Helper function that replicates the resolveScript logic for testing
     * with arbitrary dirname and isDistRuntime values.
     */
    function testResolveScript(
      dirname: string,
      scriptBaseName: string,
      isDist: boolean,
    ): string {
      const extension = isDist ? '.js' : '.ts';
      return path.join(dirname, `${scriptBaseName}${extension}`);
    }

    it('should resolve to .js extension in dist runtime', () => {
      const result = testResolveScript(
        '/app/dist/scripts',
        'validate-env',
        true,
      );
      expect(result).toBe(path.join('/app/dist/scripts', 'validate-env.js'));
    });

    it('should resolve to .ts extension in src runtime', () => {
      const result = testResolveScript(
        '/home/ubuntu/repos/grc/backend-nest/src/scripts',
        'validate-env',
        false,
      );
      expect(result).toBe(
        path.join(
          '/home/ubuntu/repos/grc/backend-nest/src/scripts',
          'validate-env.ts',
        ),
      );
    });

    it('should handle all validation script names', () => {
      const scriptNames = [
        'validate-env',
        'validate-db',
        'validate-migrations',
        'smoke-auth-onboarding',
      ];

      for (const scriptName of scriptNames) {
        const distResult = testResolveScript(
          '/app/dist/scripts',
          scriptName,
          true,
        );
        expect(distResult).toContain('.js');
        expect(distResult).toContain(scriptName);

        const srcResult = testResolveScript(
          '/app/src/scripts',
          scriptName,
          false,
        );
        expect(srcResult).toContain('.ts');
        expect(srcResult).toContain(scriptName);
      }
    });
  });

  describe('integration: actual module exports', () => {
    // Import the actual functions from the module
    // Note: These tests verify the actual implementation works correctly
    // in the current test environment (which runs from src)
    let isDistRuntime: () => boolean;
    let resolveScript: (scriptBaseName: string) => string;

    beforeAll(async () => {
      // Dynamic import to get the actual functions
      const module = await import('./platform-validate');
      isDistRuntime = module.isDistRuntime;
      resolveScript = module.resolveScript;
    });

    it('should detect src runtime in test environment', () => {
      // Tests run from src, so isDistRuntime should return false
      const result = isDistRuntime();
      expect(result).toBe(false);
    });

    it('should resolve scripts to .ts in test environment', () => {
      const result = resolveScript('validate-env');
      expect(result).toContain('validate-env.ts');
      expect(result).toContain('scripts');
    });

    it('should resolve all validation scripts correctly', () => {
      const scriptNames = [
        'validate-env',
        'validate-db',
        'validate-migrations',
        'smoke-auth-onboarding',
      ];

      for (const scriptName of scriptNames) {
        const result = resolveScript(scriptName);
        expect(result).toContain(`${scriptName}.ts`);
      }
    });
  });
});
