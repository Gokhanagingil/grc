import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async validateUser(email: string, pass: string) {
    const u = await this.users.findByEmail(email);
    if (!u) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(pass, u.passwordHash ?? u.password ?? '');
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return u;
  }

  async login(email: string, pass: string) {
    const u = await this.validateUser(email, pass);
    const payload = { sub: String(u.id ?? u.userId), email: u.email, role: u.role ?? 'admin' };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { id: payload.sub, email: u.email, displayName: u.displayName ?? 'Admin', role: payload.role } };
  }
}

