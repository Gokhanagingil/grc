import { useState, useEffect, useCallback, useRef } from 'react';
import {
  platformViewsApi,
  TableSchema,
  ViewPreference,
  ColumnFilter,
  FieldSchema,
  unwrapResponse,
} from '../services/grcClient';

interface UseViewPreferencesOptions {
  tenantId: string;
  tableName: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseViewPreferencesResult {
  schema: TableSchema | null;
  preference: ViewPreference | null;
  visibleColumns: string[];
  columnOrder: string[];
  filters: Record<string, ColumnFilter>;
  sort: { field: string; direction: 'ASC' | 'DESC' } | null;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  setVisibleColumns: (columns: string[]) => void;
  setColumnOrder: (order: string[]) => void;
  setFilters: (filters: Record<string, ColumnFilter>) => void;
  setFilter: (fieldName: string, filter: ColumnFilter | null) => void;
  setSort: (sort: { field: string; direction: 'ASC' | 'DESC' } | null) => void;
  setPageSize: (size: number) => void;
  savePreference: () => Promise<void>;
  resetToDefault: () => void;
  getVisibleFields: () => FieldSchema[];
}

export function useViewPreferences({
  tenantId,
  tableName,
  enabled = true,
  debounceMs = 1000,
}: UseViewPreferencesOptions): UseViewPreferencesResult {
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [preference, setPreference] = useState<ViewPreference | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumnsState] = useState<string[]>([]);
  const [columnOrder, setColumnOrderState] = useState<string[]>([]);
  const [filters, setFiltersState] = useState<Record<string, ColumnFilter>>({});
  const [sort, setSortState] = useState<{
    field: string;
    direction: 'ASC' | 'DESC';
  } | null>(null);
  const [pageSize, setPageSizeState] = useState(20);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    if (!enabled || !tenantId || !tableName) {
      return;
    }

    const fetchSchemaAndPreference = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [schemaResponse, preferenceResponse] = await Promise.all([
          platformViewsApi.getTableSchema(tenantId, tableName),
          platformViewsApi.getViewPreference(tenantId, tableName),
        ]);

        const schemaData = unwrapResponse<TableSchema>(schemaResponse);
        const preferenceData = unwrapResponse<{ preference: ViewPreference }>(
          preferenceResponse,
        );

        setSchema(schemaData);

        const pref = preferenceData.preference;
        setPreference(pref);

        if (pref.visibleColumns && pref.visibleColumns.length > 0) {
          setVisibleColumnsState(pref.visibleColumns);
        } else {
          const defaultVisible = schemaData.fields
            .filter((f) => f.defaultVisible)
            .map((f) => f.name);
          setVisibleColumnsState(defaultVisible);
        }

        if (pref.columnOrder && pref.columnOrder.length > 0) {
          setColumnOrderState(pref.columnOrder);
        } else {
          setColumnOrderState(schemaData.fields.map((f) => f.name));
        }

        setFiltersState(pref.filters || {});
        setSortState(pref.sort || null);
        setPageSizeState(pref.pageSize || 20);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load view preferences';
        setError(message);
        console.error('Failed to load view preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchemaAndPreference();
  }, [enabled, tenantId, tableName]);

  const savePreference = useCallback(async () => {
    if (!tenantId || !tableName) return;

    try {
      await platformViewsApi.saveViewPreference(tenantId, tableName, {
        visibleColumns,
        columnOrder,
        filters,
        sort: sort || undefined,
        pageSize,
      });
      pendingSaveRef.current = false;
    } catch (err) {
      console.error('Failed to save view preference:', err);
    }
  }, [tenantId, tableName, visibleColumns, columnOrder, filters, sort, pageSize]);

  const debouncedSave = useCallback(() => {
    pendingSaveRef.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePreference();
    }, debounceMs);
  }, [savePreference, debounceMs]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        savePreference();
      }
    };
  }, [savePreference]);

  const setVisibleColumns = useCallback(
    (columns: string[]) => {
      setVisibleColumnsState(columns);
      debouncedSave();
    },
    [debouncedSave],
  );

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setColumnOrderState(order);
      debouncedSave();
    },
    [debouncedSave],
  );

  const setFilters = useCallback(
    (newFilters: Record<string, ColumnFilter>) => {
      setFiltersState(newFilters);
      debouncedSave();
    },
    [debouncedSave],
  );

  const setFilter = useCallback(
    (fieldName: string, filter: ColumnFilter | null) => {
      setFiltersState((prev) => {
        const next = { ...prev };
        if (filter) {
          next[fieldName] = filter;
        } else {
          delete next[fieldName];
        }
        return next;
      });
      debouncedSave();
    },
    [debouncedSave],
  );

  const setSort = useCallback(
    (newSort: { field: string; direction: 'ASC' | 'DESC' } | null) => {
      setSortState(newSort);
      debouncedSave();
    },
    [debouncedSave],
  );

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      debouncedSave();
    },
    [debouncedSave],
  );

  const resetToDefault = useCallback(() => {
    if (!schema) return;

    const defaultVisible = schema.fields
      .filter((f) => f.defaultVisible)
      .map((f) => f.name);
    const defaultOrder = schema.fields.map((f) => f.name);

    setVisibleColumnsState(defaultVisible);
    setColumnOrderState(defaultOrder);
    setFiltersState({});
    setSortState(null);
    setPageSizeState(20);
    debouncedSave();
  }, [schema, debouncedSave]);

  const getVisibleFields = useCallback((): FieldSchema[] => {
    if (!schema) return [];

    const fieldMap = new Map(schema.fields.map((f) => [f.name, f]));
    return visibleColumns
      .map((col) => fieldMap.get(col))
      .filter((f): f is FieldSchema => f !== undefined);
  }, [schema, visibleColumns]);

  return {
    schema,
    preference,
    visibleColumns,
    columnOrder,
    filters,
    sort,
    pageSize,
    isLoading,
    error,
    setVisibleColumns,
    setColumnOrder,
    setFilters,
    setFilter,
    setSort,
    setPageSize,
    savePreference,
    resetToDefault,
    getVisibleFields,
  };
}

export default useViewPreferences;
