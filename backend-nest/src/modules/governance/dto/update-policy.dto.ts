import { PartialType } from '@nestjs/swagger';
import { CreateGovernancePolicyDto } from './create-policy.dto';

// Renamed to avoid conflict with PolicyModule's UpdatePolicyDto
export class UpdateGovernancePolicyDto extends PartialType(CreateGovernancePolicyDto) {}
