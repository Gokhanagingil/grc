import { Injectable, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../entities/auth/user.entity';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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
    
    // Sign JWT
    const payload = { sub: user.id, email: user.email, tenant_id: user.tenant_id };
    const accessToken = this.jwt.sign(payload);
    
    return { 
      accessToken, 
      user: { 
        id: user.id, 
        email: user.email, 
        displayName: user.display_name,
        tenant_id: user.tenant_id 
      } 
    };
  }

  async validateUser(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.is_active) return null;
    return { id: user.id, email: user.email, displayName: user.display_name, tenant_id: user.tenant_id };
  }
}


