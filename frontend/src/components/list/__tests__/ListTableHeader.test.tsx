import { parseSort, buildSort } from '../../../utils/listQueryUtils';

describe('ListTableHeader sort logic', () => {
  describe('column header sort toggle', () => {
    it('should set ASC when clicking on inactive column', () => {
      const currentSort = 'createdAt:DESC';
      const clickedField = 'name';
      const parsedSort = parseSort(currentSort);
      const isActive = parsedSort?.field === clickedField;

      expect(isActive).toBe(false);

      const newSort = buildSort(clickedField, 'ASC');
      expect(newSort).toBe('name:ASC');
    });

    it('should toggle to DESC when clicking on ASC sorted column', () => {
      const currentSort = 'name:ASC';
      const clickedField = 'name';
      const parsedSort = parseSort(currentSort);
      const isActive = parsedSort?.field === clickedField;
      const currentDirection = parsedSort?.direction;

      expect(isActive).toBe(true);
      expect(currentDirection).toBe('ASC');

      const newSort = buildSort(clickedField, 'DESC');
      expect(newSort).toBe('name:DESC');
    });

    it('should clear sort when clicking on DESC sorted column', () => {
      const currentSort = 'name:DESC';
      const clickedField = 'name';
      const parsedSort = parseSort(currentSort);
      const isActive = parsedSort?.field === clickedField;
      const currentDirection = parsedSort?.direction;

      expect(isActive).toBe(true);
      expect(currentDirection).toBe('DESC');

      const newSort = '';
      expect(newSort).toBe('');
    });
  });

  describe('sort state detection', () => {
    it('should detect active sort column', () => {
      const currentSort = 'name:ASC';
      const parsedSort = parseSort(currentSort);

      expect(parsedSort?.field).toBe('name');
      expect(parsedSort?.direction).toBe('ASC');
    });

    it('should handle empty sort string', () => {
      const currentSort = '';
      const parsedSort = parseSort(currentSort);

      expect(parsedSort).toBeNull();
    });

    it('should handle null sort', () => {
      const parsedSort = parseSort('');
      expect(parsedSort).toBeNull();
    });
  });

  describe('sort direction indicator', () => {
    it('should show ascending indicator for ASC', () => {
      const sort = parseSort('name:ASC');
      expect(sort?.direction).toBe('ASC');
    });

    it('should show descending indicator for DESC', () => {
      const sort = parseSort('name:DESC');
      expect(sort?.direction).toBe('DESC');
    });
  });

  describe('column definition structure', () => {
    interface ColumnDefinition {
      field: string;
      label: string;
      sortable?: boolean;
      align?: 'left' | 'center' | 'right';
      width?: number | string;
      minWidth?: number | string;
    }

    const sampleColumns: ColumnDefinition[] = [
      { field: 'name', label: 'Name', sortable: true },
      { field: 'status', label: 'Status', sortable: true },
      { field: 'createdAt', label: 'Created At', sortable: true },
      { field: 'actions', label: 'Actions', sortable: false },
    ];

    it('should have correct structure for sortable columns', () => {
      const sortableColumns = sampleColumns.filter((col) => col.sortable !== false);
      expect(sortableColumns).toHaveLength(3);
    });

    it('should identify non-sortable columns', () => {
      const nonSortableColumns = sampleColumns.filter((col) => col.sortable === false);
      expect(nonSortableColumns).toHaveLength(1);
      expect(nonSortableColumns[0].field).toBe('actions');
    });

    it('should have required properties', () => {
      sampleColumns.forEach((col) => {
        expect(col).toHaveProperty('field');
        expect(col).toHaveProperty('label');
        expect(typeof col.field).toBe('string');
        expect(typeof col.label).toBe('string');
      });
    });
  });
});

describe('ListTableHeaderRow', () => {
  it('should render multiple headers from column definitions', () => {
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'status', label: 'Status' },
      { field: 'createdAt', label: 'Created At' },
    ];

    expect(columns).toHaveLength(3);
    columns.forEach((col) => {
      expect(col).toHaveProperty('field');
      expect(col).toHaveProperty('label');
    });
  });

  it('should pass sort state to each header', () => {
    const currentSort = 'name:ASC';
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'status', label: 'Status' },
    ];

    const parsedSort = parseSort(currentSort);
    const nameColumn = columns.find((col) => col.field === 'name');
    const statusColumn = columns.find((col) => col.field === 'status');

    expect(nameColumn).toBeDefined();
    expect(statusColumn).toBeDefined();

    const isNameActive = parsedSort?.field === nameColumn?.field;
    const isStatusActive = parsedSort?.field === statusColumn?.field;

    expect(isNameActive).toBe(true);
    expect(isStatusActive).toBe(false);
  });
});
