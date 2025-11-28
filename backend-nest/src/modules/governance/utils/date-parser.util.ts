/**
 * Parse Turkish date format (dd/MM/yyyy) to ISO format (yyyy-MM-dd)
 * @param dateStr Date string in dd/MM/yyyy format
 * @returns ISO date string (yyyy-MM-dd) or undefined if invalid
 */
export function parseTrDateToIso(dateStr?: string): string | undefined {
  if (!dateStr || typeof dateStr !== 'string') {
    return undefined;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return undefined;
  }

  // Parse dd/MM/yyyy format
  const parts = trimmed.split('/');
  if (parts.length !== 3) {
    return undefined;
  }

  const day = parseInt(parts[0] ?? '0', 10);
  const month = parseInt(parts[1] ?? '0', 10);
  const year = parseInt(parts[2] ?? '0', 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return undefined;
  }

  // Validate ranges
  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1900 ||
    year > 2100
  ) {
    return undefined;
  }

  // Format as yyyy-MM-dd
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
}
