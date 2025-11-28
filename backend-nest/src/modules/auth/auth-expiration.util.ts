/**
 * Safely parse JWT expiration value with strict validation.
 * Rejects 0, negative numbers, and invalid formats.
 * 
 * @param value - Raw expiration value from environment
 * @param defaultValue - Default value to use if value is invalid
 * @returns Valid expiration string or defaultValue
 */
export function parseExpiresIn(
  value: string | undefined,
  defaultValue: string,
): string {
  // Empty or undefined → use default
  if (!value || value.trim() === '') {
    return defaultValue;
  }

  const trimmed = value.trim();

  // Check if it's numeric (e.g., "0", "60", "-5", "000")
  const numValue = Number(trimmed);
  
  // Use Number.isNaN for strict NaN check
  if (!Number.isNaN(numValue)) {
    // Numeric value found
    if (numValue > 0) {
      // Positive number → valid (treat as seconds)
      return String(numValue);
    }
    
    // 0, negative → INVALID
    console.warn(
      `[Auth] Invalid numeric expiresIn (<=0): "${trimmed}", using default "${defaultValue}"`,
    );
    return defaultValue;
  }

  // Not numeric → check if it's a valid time string
  // Pattern: ^[1-9]\d*[smhd]$ - must start with 1-9 (not 0), then any digits, then s/m/h/d
  // This REJECTS "0s", "00m", "0h", "0d" etc.
  if (/^[1-9]\d*[smhd]$/i.test(trimmed)) {
    return trimmed;
  }

  // Any other format → INVALID
  console.warn(
    `[Auth] Invalid expiresIn format: "${trimmed}", using default "${defaultValue}"`,
  );
  return defaultValue;
}

