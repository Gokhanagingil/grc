import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AI_ENCRYPTION_KEY') return undefined;
              if (key === 'JWT_SECRET')
                return 'test-jwt-secret-for-encryption-key-derivation';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a string (roundtrip)', () => {
    const plaintext = 'my-super-secret-api-key-12345';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toBeTruthy();

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-secret';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    // Due to random IV, ciphertexts should differ
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same value
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should handle empty strings', () => {
    const encrypted = service.encrypt('');
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long strings', () => {
    const longString = 'a'.repeat(10000);
    const encrypted = service.encrypt(longString);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(longString);
  });

  it('should handle special characters and unicode', () => {
    const special = 'sk-12345!@#$%^&*()_+{}|:"<>?ñ中文日本語';
    const encrypted = service.encrypt(special);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(special);
  });

  it('should return null on invalid ciphertext', () => {
    expect(service.decrypt('invalid-base64')).toBeNull();
  });
});
