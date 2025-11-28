import { Controller, Get } from '@nestjs/common';

@Controller({ path: 'version', version: '2' })
export class VersionController {
  @Get()
  getVersion() {
    const version =
      process.env.APP_VERSION ??
      process.env.npm_package_version ??
      process.env.BUILD_TAG ??
      'dev';
    return {
      version,
      build: process.env.BUILD_TAG ?? 'LOCAL',
      commit: process.env.GIT_SHA ?? 'unknown',
      time: new Date().toISOString(),
    };
  }
}

