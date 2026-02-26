/**
 * Tests for AdminDocsCenter component
 *
 * Covers: rendering, navigation list, document loading, search, TOC, copy button
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminDocsCenter } from '../AdminDocsCenter';

// Mock DOMPurify
jest.mock('dompurify', () => ({
  sanitize: (html: string) => html,
}));

// Mock the admin components
jest.mock('../../../components/admin', () => ({
  AdminPageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="admin-page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Mock fetch for loading markdown docs
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock clipboard
const mockClipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

const SAMPLE_MARKDOWN = `# Sample Document

**Version:** 1.0 | **Last Updated:** 2025-01-15 | **Status:** Final

## Executive Summary

This is a sample document for testing.

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 15+

### Steps

1. Clone the repository
2. Install dependencies

\`\`\`bash
npm install
\`\`\`

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| DB_HOST | db.local | Database host |
| DB_PORT | 5432 | Database port |

## Troubleshooting

Check the logs for errors.
`;

describe('AdminDocsCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_MARKDOWN),
    });
  });

  describe('Rendering', () => {
    it('should render the docs center page', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('docs-center-page')).toBeInTheDocument();
      });
    });

    it('should render the page header with correct title', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('admin-page-header')).toBeInTheDocument();
      });
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    it('should render the document navigation list', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('docs-nav-list')).toBeInTheDocument();
      });
    });

    it('should display all 7 documents in navigation', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByText('Installation & Deployment Guide')).toBeInTheDocument();
      });
      expect(screen.getByText('Infrastructure & Operations')).toBeInTheDocument();
      expect(screen.getByText('Technical Architecture')).toBeInTheDocument();
      expect(screen.getByText('ITSM Module')).toBeInTheDocument();
      expect(screen.getByText('GRC Module')).toBeInTheDocument();
      expect(screen.getByText('ITSM-GRC Bridges')).toBeInTheDocument();
      expect(screen.getByText('AI Features')).toBeInTheDocument();
    });

    it('should show document status chips (Final/Outline)', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('docs-nav-list')).toBeInTheDocument();
      });
      const navList = screen.getByTestId('docs-nav-list');
      expect(navList.textContent).toContain('Final');
      expect(navList.textContent).toContain('Outline');
    });
  });

  describe('Document Loading', () => {
    it('should fetch the first document on mount', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('01A_INSTALLATION_GUIDE.md')
        );
      });
    });

    it('should render markdown content after loading', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('doc-content')).toBeInTheDocument();
      });
      const content = screen.getByTestId('doc-content');
      expect(content.innerHTML).toContain('Sample Document');
    });

    it('should show error message when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load document/)).toBeInTheDocument();
      });
    });

    it('should fetch different document when nav item clicked', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const infraNav = screen.getByTestId('doc-nav-01');
      fireEvent.click(infraNav);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('01_INFRASTRUCTURE.md')
        );
      });
    });
  });

  describe('Table of Contents', () => {
    it('should render the TOC panel', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
      });
    });

    it('should display Executive Summary heading in TOC', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toHaveTextContent('Executive Summary');
      });
    });

    it('should display Installation heading in TOC', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toHaveTextContent('Installation');
      });
    });

    it('should display Configuration heading in TOC', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toHaveTextContent('Configuration');
      });
    });

    it('should toggle TOC visibility', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
      });

      const tocToggle = screen.getByTestId('toc-toggle');
      fireEvent.click(tocToggle);

      expect(screen.queryByTestId('toc-panel')).not.toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should render the search input', async () => {
      render(<AdminDocsCenter />);
      await waitFor(() => {
        expect(screen.getByTestId('doc-search-input')).toBeInTheDocument();
      });
    });

    it('should show match count when searching', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('doc-content')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Database' } });

      await waitFor(() => {
        expect(screen.getByTestId('search-match-count')).toBeInTheDocument();
      });
    });

    it('should not show match count for short queries', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('doc-content')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'a' } });

      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
    });
  });

  describe('Document Metadata', () => {
    it('should display version from document metadata', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByText('v1.0')).toBeInTheDocument();
      });
    });

    it('should display last updated date from metadata', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByText(/Updated:.*2025-01-15/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Block Copy', () => {
    it('should render code blocks with copy buttons', async () => {
      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(screen.getByTestId('doc-content').innerHTML).toContain('copy-code-btn');
      });
    });
  });

  describe('XSS Safety', () => {
    it('should pass content through DOMPurify sanitize', async () => {
      const DOMPurify = require('dompurify');
      const sanitizeSpy = jest.spyOn(DOMPurify, 'sanitize');

      render(<AdminDocsCenter />);

      await waitFor(() => {
        expect(sanitizeSpy).toHaveBeenCalled();
      });

      sanitizeSpy.mockRestore();
    });
  });
});
