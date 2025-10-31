import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/auth/user.entity';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async generateSecret(userId: string): Promise<{ secret: string; qrCode: string; otpauthUrl: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'GRC Platform',
      secret,
    );

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Save secret (not yet enabled)
    user.mfa_secret = secret;
    await this.usersRepo.save(user);

    return { secret, qrCode, otpauthUrl };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || !user.mfa_secret) return false;

    return authenticator.verify({ token, secret: user.mfa_secret });
  }

  async enableMfa(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { mfa_enabled: true });
  }
}

