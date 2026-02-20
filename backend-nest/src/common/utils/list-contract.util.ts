/**
 * LIST-CONTRACT Normalization Utility
 *
 * Provides a pure function to normalize API responses to the standard
 * LIST-CONTRACT format. This utility is side-effect free and can be
 * safely imported in tests without triggering any initialization code.
 */

export interface NormalizedListContract {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Normalize a LIST-CONTRACT response from various envelope formats.
 *
 * Supports these response shapes:
 * A) { data: { items: [], total, page, pageSize, totalPages } }
 * B) { data: { data: { items: [], total, page, pageSize, totalPages } } } (double envelope)
 * C) { items: [], total, page, pageSize, totalPages } (raw list-contract)
 *
 * @param json - The raw JSON response from the API
 * @param silent - If true, suppress console warnings (useful for tests)
 * @returns NormalizedListContract - The normalized list contract
 * @throws Error if the response cannot be normalized to a valid list contract
 */
export function normalizeListContract(
  json: unknown,
  silent = false,
): NormalizedListContract {
  if (!json || typeof json !== 'object') {
    throw new Error('Response is not an object');
  }

  const obj = json as Record<string, unknown>;

  // Helper to extract list contract fields from an object
  function extractListContract(
    candidate: Record<string, unknown>,
  ): NormalizedListContract | null {
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    // Check if this object has the required list contract fields
    if (Array.isArray(candidate.items)) {
      const items = candidate.items;
      const total =
        typeof candidate.total === 'number' ? candidate.total : items.length;
      const page = typeof candidate.page === 'number' ? candidate.page : 1;
      const pageSize =
        typeof candidate.pageSize === 'number' ? candidate.pageSize : 10;

      // Calculate totalPages if missing
      let totalPages: number;
      if (typeof candidate.totalPages === 'number') {
        totalPages = candidate.totalPages;
      } else {
        totalPages = Math.ceil(total / pageSize);
        // Log warning about missing totalPages (contract warning, not error)
        if (!silent) {
          console.log(
            `    [CONTRACT WARNING] 'totalPages' missing, computed as ${totalPages}`,
          );
        }
      }

      return { items, total, page, pageSize, totalPages };
    }

    return null;
  }

  // Try format C: raw list-contract { items: [], total, ... }
  const rawContract = extractListContract(obj);
  if (rawContract) {
    return rawContract;
  }

  // Try format A: { data: { items: [], total, ... } }
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    const singleEnvelopeContract = extractListContract(dataObj);
    if (singleEnvelopeContract) {
      return singleEnvelopeContract;
    }

    // Try format B: { data: { data: { items: [], total, ... } } } (double envelope)
    if (dataObj.data && typeof dataObj.data === 'object') {
      const innerDataObj = dataObj.data as Record<string, unknown>;
      const doubleEnvelopeContract = extractListContract(innerDataObj);
      if (doubleEnvelopeContract) {
        if (!silent) {
          console.log(
            '    [CONTRACT WARNING] Double envelope detected (data.data.items)',
          );
        }
        return doubleEnvelopeContract;
      }
    }
  }

  // Could not normalize - throw with helpful message
  throw new Error(
    `Cannot normalize response to LIST-CONTRACT. Expected 'items' array at root, data.items, or data.data.items`,
  );
}
