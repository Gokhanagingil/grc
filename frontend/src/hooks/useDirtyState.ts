import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook to track dirty state of form data
 * Compares current form data against original data to determine if changes have been made
 */
export function useDirtyState<T extends Record<string, unknown>>(
  originalData: T | null,
  currentData: T | null
): {
  isDirty: boolean;
  changedFields: string[];
  resetDirtyState: () => void;
} {
  const [baselineData, setBaselineData] = useState<T | null>(null);
  const initializedRef = useRef(false);

  // Initialize baseline when original data is first loaded
  useEffect(() => {
    if (originalData && !initializedRef.current) {
      setBaselineData(originalData);
      initializedRef.current = true;
    }
  }, [originalData]);

  const resetDirtyState = useCallback(() => {
    if (currentData) {
      setBaselineData(currentData);
    }
  }, [currentData]);

  // Compare current data against baseline to find changed fields
  const changedFields: string[] = [];
  
  if (baselineData && currentData) {
    const allKeys = new Set([
      ...Object.keys(baselineData),
      ...Object.keys(currentData),
    ]);

    allKeys.forEach((key) => {
      const originalValue = baselineData[key];
      const currentValue = currentData[key];

      // Deep comparison for objects, simple comparison for primitives
      if (typeof originalValue === 'object' && typeof currentValue === 'object') {
        if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
          changedFields.push(key);
        }
      } else if (originalValue !== currentValue) {
        changedFields.push(key);
      }
    });
  }

  const isDirty = changedFields.length > 0;

  return {
    isDirty,
    changedFields,
    resetDirtyState,
  };
}

export default useDirtyState;
