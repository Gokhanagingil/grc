/**
 * useFormLayout Hook
 * 
 * Provides form layout functionality based on user role.
 * Supports field ordering, sections, hidden fields, and readonly fields.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formLayoutApi, FormLayoutConfig, FormLayoutSection } from '../services/platformApi';

export interface UseFormLayoutResult {
  layout: FormLayoutConfig | null;
  isLoading: boolean;
  error: string | null;
  isDefault: boolean;
  isFieldHidden: (fieldName: string) => boolean;
  isFieldReadonly: (fieldName: string) => boolean;
  getFieldsForSection: (sectionTitle: string) => string[];
  getSections: () => FormLayoutSection[];
  refreshLayout: () => Promise<void>;
}

export function useFormLayout(tableName: string): UseFormLayoutResult {
  const { user } = useAuth();
  const [layout, setLayout] = useState<FormLayoutConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  const fetchLayout = useCallback(async () => {
    if (!tableName) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await formLayoutApi.resolve(tableName);
      setLayout(response.data.layout);
      setIsDefault(response.data.isDefault);
    } catch (err) {
      console.error('Error fetching form layout:', err);
      setError('Failed to load form layout');
      // Set a default layout on error
      setLayout({
        sections: [{ title: 'Details', fields: [] }],
        hiddenFields: [],
        readonlyFields: ['created_at', 'updated_at'],
      });
      setIsDefault(true);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout, user?.role]);

  const hiddenFieldsSet = useMemo(
    () => new Set(layout?.hiddenFields || []),
    [layout?.hiddenFields]
  );

  const readonlyFieldsSet = useMemo(
    () => new Set(layout?.readonlyFields || []),
    [layout?.readonlyFields]
  );

  const isFieldHidden = useCallback(
    (fieldName: string): boolean => {
      return hiddenFieldsSet.has(fieldName);
    },
    [hiddenFieldsSet]
  );

  const isFieldReadonly = useCallback(
    (fieldName: string): boolean => {
      return readonlyFieldsSet.has(fieldName);
    },
    [readonlyFieldsSet]
  );

  const getFieldsForSection = useCallback(
    (sectionTitle: string): string[] => {
      const section = layout?.sections.find((s) => s.title === sectionTitle);
      return section?.fields || [];
    },
    [layout?.sections]
  );

  const getSections = useCallback((): FormLayoutSection[] => {
    return layout?.sections || [];
  }, [layout?.sections]);

  return {
    layout,
    isLoading,
    error,
    isDefault,
    isFieldHidden,
    isFieldReadonly,
    getFieldsForSection,
    getSections,
    refreshLayout: fetchLayout,
  };
}

export default useFormLayout;
