import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/auth/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async login(tenantId: string | undefined, email: string, password: string) {
    if (!tenantId) throw new BadRequestException('x-tenant-id required');
    // Find user by email and tenant_id
    const user = await this.users.findOne({ 
      where: { 
        email: email,
        tenant_id: tenantId
      } 
    });
    if (!user) throw new ForbiddenException('Invalid credentials or tenant mismatch');
    if (!user.is_active) throw new ForbiddenException('User inactive');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ForbiddenException('Invalid credentials');
    // Minimal token placeholder (in real app: sign JWT)
    const accessToken = `tok_${user.id}_${Date.now()}`;
    return { accessToken, user: { id: user.id, email: user.email, tenant_id: user.tenant_id } };
  }
}


