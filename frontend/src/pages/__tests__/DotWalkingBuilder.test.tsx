/**
 * Regression tests for DotWalkingBuilder component
 * 
 * These tests ensure the component handles undefined/null API responses
 * without crashing (fixes white-screen crash bug).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DotWalkingBuilder } from '../DotWalkingBuilder';

// Mock the api module
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock('../../services/api', () => ({
  api: {
    get: (url: string) => mockApiGet(url),
    post: (url: string, data: unknown) => mockApiPost(url, data),
    defaults: { baseURL: 'http://localhost:3002' },
  },
}));

// Mock the safeHelpers module
jest.mock('../../utils/safeHelpers', () => ({
  safeArray: <T,>(value: T[] | null | undefined): T[] => {
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  },
}));

describe('DotWalkingBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Loading', () => {
    it('should not crash when schema endpoint returns null', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Dot-Walking Query Builder')).toBeInTheDocument();
      });
    });

    it('should not crash when schema endpoint returns empty object', async () => {
      mockApiGet.mockResolvedValue({ data: {} });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Dot-Walking Query Builder')).toBeInTheDocument();
      });
    });

    it('should not crash when schema endpoint returns NestJS envelope with null data', async () => {
      mockApiGet.mockResolvedValue({ data: { success: true, data: null } });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Dot-Walking Query Builder')).toBeInTheDocument();
      });
    });

    it('should handle schema with missing entities array', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          success: true,
          data: {
            fields: {},
            relationships: {},
          },
        },
      });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Schema Reference')).toBeInTheDocument();
      });
    });

    it('should render entities when schema is valid', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          success: true,
          data: {
            entities: ['risks', 'policies', 'users'],
            fields: {},
            relationships: {},
          },
        },
      });

      render(<DotWalkingBuilder />);

      await waitFor(() => {
        expect(screen.getByText('risks')).toBeInTheDocument();
      });

      expect(screen.getByText('policies')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    it('should handle API error gracefully and show error message', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load schema/)).toBeInTheDocument();
      });
    });
  });

  describe('Suggestions Handling', () => {
    it('should not crash when suggestions endpoint returns null', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/dotwalking/schema')) {
          return Promise.resolve({
            data: { success: true, data: { entities: [], fields: {}, relationships: {} } },
          });
        }
        if (url.includes('/dotwalking/suggestions')) {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: {} });
      });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();
    });

    it('should handle suggestions as direct array', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/dotwalking/schema')) {
          return Promise.resolve({
            data: { success: true, data: { entities: [], fields: {}, relationships: {} } },
          });
        }
        if (url.includes('/dotwalking/suggestions')) {
          return Promise.resolve({ data: { success: true, data: ['suggestion1', 'suggestion2'] } });
        }
        return Promise.resolve({ data: {} });
      });

      expect(() => {
        render(<DotWalkingBuilder />);
      }).not.toThrow();
    });
  });

  describe('Component renders without errors', () => {
    it('should render the page title', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: { entities: [], fields: {}, relationships: {} } },
      });

      render(<DotWalkingBuilder />);
      expect(screen.getByText('Dot-Walking Query Builder')).toBeInTheDocument();
    });

    it('should render quick examples section', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: { entities: [], fields: {}, relationships: {} } },
      });

      render(<DotWalkingBuilder />);

      await waitFor(() => {
        expect(screen.getByText('Quick Examples')).toBeInTheDocument();
      });

      expect(screen.getByText('risks.owner.email')).toBeInTheDocument();
    });

    it('should show loading state while fetching schema', () => {
      mockApiGet.mockImplementation(() => new Promise(() => {}));

      render(<DotWalkingBuilder />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
