/**
 * Tests for AdminDocsCenter component
 *
 * Covers: rendering, navigation list, document loading, search, TOC, copy button
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      expect(screen.getByTestId('docs-center-page')).toBeInTheDocument();
    });

    it('should render the page header with correct title', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      expect(screen.getByTestId('admin-page-header')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    it('should render the document navigation list', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      expect(screen.getByTestId('docs-nav-list')).toBeInTheDocument();
    });

    it('should display all 7 documents in navigation', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      expect(screen.getByText('Installation & Deployment Guide')).toBeInTheDocument();
      expect(screen.getByText('Infrastructure & Operations')).toBeInTheDocument();
      expect(screen.getByText('Technical Architecture')).toBeInTheDocument();
      expect(screen.getByText('ITSM Module')).toBeInTheDocument();
      expect(screen.getByText('GRC Module')).toBeInTheDocument();
      expect(screen.getByText('ITSM-GRC Bridges')).toBeInTheDocument();
      expect(screen.getByText('AI Features')).toBeInTheDocument();
    });

    it('should show document status chips (Final/Outline)', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      // Check that both Final and Outline chips exist in the nav list
      const navList = screen.getByTestId('docs-nav-list');
      expect(navList.textContent).toContain('Final');
      expect(navList.textContent).toContain('Outline');
    });
  });

  describe('Document Loading', () => {
    it('should fetch the first document on mount', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('01A_INSTALLATION_GUIDE.md')
        );
      });
    });

    it('should render markdown content after loading', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      await waitFor(() => {
        expect(screen.getByTestId('doc-content')).toBeInTheDocument();
      });
      // Check that some markdown-rendered content appears
      const content = screen.getByTestId('doc-content');
      expect(content.innerHTML).toContain('Sample Document');
    });

    it('should show error message when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load document/)).toBeInTheDocument();
      });
    });

    it('should fetch different document when nav item clicked', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Click on Infrastructure doc
      const infraNav = screen.getByTestId('doc-nav-01');
      await act(async () => {
        fireEvent.click(infraNav);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('01_INFRASTRUCTURE.md')
        );
      });
    });
  });

  describe('Table of Contents', () => {
    it('should render the TOC panel', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
      });
    });

    it('should display headings from the document in TOC', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        const tocPanel = screen.getByTestId('toc-panel');
        expect(tocPanel).toHaveTextContent('Executive Summary');
        expect(tocPanel).toHaveTextContent('Installation');
        expect(tocPanel).toHaveTextContent('Configuration');
        expect(tocPanel).toHaveTextContent('Troubleshooting');
      });
    });

    it('should toggle TOC visibility', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
      });

      // Click TOC toggle to hide
      const tocToggle = screen.getByTestId('toc-toggle');
      await act(async () => {
        fireEvent.click(tocToggle);
      });

      expect(screen.queryByTestId('toc-panel')).not.toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should render the search input', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });
      expect(screen.getByTestId('doc-search-input')).toBeInTheDocument();
    });

    it('should show match count when searching', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('doc-content')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('doc-search-input').querySelector('input');
      expect(searchInput).toBeTruthy();

      await act(async () => {
        fireEvent.change(searchInput!, { target: { value: 'Database' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('search-match-count')).toBeInTheDocument();
      });
    });

    it('should not show match count for short queries', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      const searchInput = screen.getByTestId('doc-search-input').querySelector('input');
      await act(async () => {
        fireEvent.change(searchInput!, { target: { value: 'a' } });
      });

      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
    });
  });

  describe('Document Metadata', () => {
    it('should display version from document metadata', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        const content = screen.getByTestId('doc-content');
        expect(content.innerHTML.length).toBeGreaterThan(0);
      });

      // Version chip should be visible
      expect(screen.getByText('v1.0')).toBeInTheDocument();
    });

    it('should display last updated date from metadata', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Updated:.*2025-01-15/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Block Copy', () => {
    it('should render code blocks with copy buttons', async () => {
      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        const content = screen.getByTestId('doc-content');
        expect(content.innerHTML).toContain('copy-code-btn');
      });
    });
  });

  describe('XSS Safety', () => {
    it('should pass content through DOMPurify sanitize', async () => {
      const DOMPurify = require('dompurify');
      const sanitizeSpy = jest.spyOn(DOMPurify, 'sanitize');

      await act(async () => {
        render(<AdminDocsCenter />);
      });

      await waitFor(() => {
        // DOMPurify.sanitize should be called for rendering
        expect(sanitizeSpy).toHaveBeenCalled();
      });

      sanitizeSpy.mockRestore();
    });
  });
});
