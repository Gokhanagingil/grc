/**
 * NormalizationModule
 * 
 * Module for the normalization pipe.
 * This module exports NormalizationPipe for global use.
 */

import { Module } from '@nestjs/common';
import { NormalizationPipe } from './normalization.pipe';

@Module({
  providers: [NormalizationPipe],
  exports: [NormalizationPipe],
})
export class NormalizationModule {}

