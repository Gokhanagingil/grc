/**
 * JWT için iat/exp değerlerini manuel hesaplar.
 * Artık expiresIn kullanmıyoruz; exp'i kendimiz set ediyoruz.
 */
export interface JwtTimes {
  iat: number; // issued at (seconds since epoch)
  exp: number; // expires at (seconds since epoch)
}

/**
 * JWT için iat ve exp değerlerini manuel olarak hesaplar.
 * 
 * @param ttlSeconds - Token ömrü (saniye cinsinden)
 * @returns JwtTimes objesi (iat ve exp içerir)
 * @throws Error - ttlSeconds geçersizse (0 veya negatif)
 */
export function buildJwtTimes(ttlSeconds: number): JwtTimes {
  const nowSec = Math.floor(Date.now() / 1000);
  
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`[jwt-timing] Invalid ttlSeconds: ${ttlSeconds}`);
  }
  
  return {
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
}

