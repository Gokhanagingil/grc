import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Description as DocIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Toc as TocIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import { AdminPageHeader } from '../../components/admin';

/* ------------------------------------------------------------------ */
/*  Document Registry                                                  */
/* ------------------------------------------------------------------ */

interface DocEntry {
  id: string;
  title: string;
  filename: string;
  status: 'final' | 'outline';
  version?: string;
}

const DOC_REGISTRY: DocEntry[] = [
  {
    id: '01A',
    title: 'Installation & Deployment Guide',
    filename: '01A_INSTALLATION_GUIDE.md',
    status: 'final',
    version: '1.1',
  },
  {
    id: '01',
    title: 'Infrastructure & Operations',
    filename: '01_INFRASTRUCTURE.md',
    status: 'final',
    version: '1.1',
  },
  {
    id: '02',
    title: 'Technical Architecture',
    filename: '02_TECHNICAL.md',
    status: 'outline',
    version: '1.0',
  },
  {
    id: '03',
    title: 'ITSM Module',
    filename: '03_ITSM.md',
    status: 'outline',
    version: '1.0',
  },
  {
    id: '04',
    title: 'GRC Module',
    filename: '04_GRC.md',
    status: 'outline',
    version: '1.0',
  },
  {
    id: '05',
    title: 'ITSM-GRC Bridges',
    filename: '05_ITSM_GRC_BRIDGES.md',
    status: 'outline',
    version: '1.0',
  },
  {
    id: '06',
    title: 'AI Features',
    filename: '06_AI_FEATURES.md',
    status: 'outline',
    version: '1.0',
  },
];

/* ------------------------------------------------------------------ */
/*  Markdown Rendering Helpers                                         */
/* ------------------------------------------------------------------ */

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const toc: TocItem[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`[\]()]/g, '').trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      toc.push({ id, text, level });
    }
  }
  return toc;
}

function extractMetadata(markdown: string): { version?: string; lastUpdated?: string; status?: string } {
  const meta: { version?: string; lastUpdated?: string; status?: string } = {};
  const versionMatch = markdown.match(/\*\*Version:\*\*\s*([^\s|*]+)/);
  if (versionMatch) meta.version = versionMatch[1];
  const updatedMatch = markdown.match(/\*\*Last Updated:\*\*\s*([^\s|*]+)/);
  if (updatedMatch) meta.lastUpdated = updatedMatch[1];
  const statusMatch = markdown.match(/\*\*Status:\*\*\s*([^|*\n]+)/);
  if (statusMatch) meta.status = statusMatch[1].trim();
  return meta;
}

/** Convert markdown to safe HTML (no rendering library — simple regex-based) */
function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks (fenced) — extract into placeholders to protect from subsequent regexes
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const langAttr = lang ? ` data-lang="${lang}"` : '';
    const rendered = `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${lang || 'text'}</span><button class="copy-code-btn" title="Copy code">Copy</button></div><pre><code${langAttr}>${escaped}</code></pre></div>`;
    const idx = codeBlocks.length;
    codeBlocks.push(rendered);
    return `%%CODE_BLOCK_${idx}%%`;
  });

  // Inline code — escape angle brackets to prevent DOMPurify stripping placeholders
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<code class="inline-code">${escaped}</code>`;
  });

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow, _separator, bodyRows) => {
      const headers = (headerRow as string)
        .split('|')
        .filter((c: string) => c.trim())
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join('');
      const rows = (bodyRows as string)
        .trim()
        .split('\n')
        .filter((r: string) => r.trim())
        .map((row: string) => {
          const cells = row
            .split('|')
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('\n');
      return `<div class="table-wrapper"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  );

  // Headings (with IDs for TOC)
  html = html.replace(/^#### (.+)$/gm, (_m, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    return `<h4 id="${id}">${t}</h4>`;
  });
  html = html.replace(/^### (.+)$/gm, (_m, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    return `<h3 id="${id}">${t}</h3>`;
  });
  html = html.replace(/^## (.+)$/gm, (_m, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    return `<h2 id="${id}">${t}</h2>`;
  });
  html = html.replace(/^# (.+)$/gm, (_m, t) => {
    const id = t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    return `<h1 id="${id}">${t}</h1>`;
  });

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');

  // Blockquotes
  html = html.replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists — use temporary <oli> tag to distinguish from unordered
  html = html.replace(/^\d+\.\s(.+)$/gm, '<oli>$1</oli>');
  html = html.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (_m, items) => {
    const fixed = (items as string).replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>');
    return `<ol>${fixed}</ol>`;
  });

  // Checkbox lists
  html = html.replace(/<li>\[x\]\s*/g, '<li class="checklist checked">');
  html = html.replace(/<li>\[ \]\s*/g, '<li class="checklist unchecked">');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr/>');

  // Paragraphs — wrap remaining non-tag lines
  html = html.replace(/^(?!<[a-z/])(.+)$/gm, '<p>$1</p>');
  // Remove empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Restore code blocks from placeholders (use function replacement to avoid $-pattern issues)
  for (let i = 0; i < codeBlocks.length; i++) {
    html = html.replace(`%%CODE_BLOCK_${i}%%`, () => codeBlocks[i]);
  }

  return html;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const markdownStyles = `
  .markdown-body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #24292e;
    max-width: 100%;
    overflow-wrap: break-word;
  }
  .markdown-body h1 { font-size: 1.8em; margin: 1.5em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
  .markdown-body h2 { font-size: 1.5em; margin: 1.4em 0 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
  .markdown-body h3 { font-size: 1.25em; margin: 1.2em 0 0.4em; }
  .markdown-body h4 { font-size: 1.1em; margin: 1em 0 0.3em; }
  .markdown-body p { margin: 0.6em 0; }
  .markdown-body a { color: #0366d6; text-decoration: none; }
  .markdown-body a:hover { text-decoration: underline; }
  .markdown-body blockquote {
    padding: 0.5em 1em;
    margin: 0.8em 0;
    border-left: 4px solid #1976d2;
    background: #f1f8ff;
    color: #24292e;
  }
  .markdown-body ul, .markdown-body ol { padding-left: 2em; margin: 0.5em 0; }
  .markdown-body li { margin: 0.25em 0; }
  .markdown-body li.checklist { list-style: none; margin-left: -1.5em; }
  .markdown-body li.checked::before { content: '\\2611 '; color: #2e7d32; }
  .markdown-body li.unchecked::before { content: '\\2610 '; color: #757575; }
  .markdown-body hr { border: none; border-top: 1px solid #eaecef; margin: 1.5em 0; }
  .markdown-body .inline-code {
    background: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  }
  .markdown-body .code-block-wrapper {
    margin: 1em 0;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    overflow: hidden;
  }
  .markdown-body .code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #f6f8fa;
    border-bottom: 1px solid #e1e4e8;
    font-size: 12px;
  }
  .markdown-body .code-lang { color: #586069; font-weight: 600; text-transform: uppercase; }
  .markdown-body .copy-code-btn {
    background: none;
    border: 1px solid #d1d5da;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 11px;
    color: #586069;
    transition: all 0.15s;
  }
  .markdown-body .copy-code-btn:hover { background: #e1e4e8; color: #24292e; }
  .markdown-body .copy-code-btn.copied { background: #2e7d32; color: white; border-color: #2e7d32; }
  .markdown-body pre {
    margin: 0;
    padding: 12px 16px;
    background: #f6f8fa;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
  }
  .markdown-body code {
    font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  }
  .markdown-body .table-wrapper { overflow-x: auto; margin: 1em 0; }
  .markdown-body table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  .markdown-body th, .markdown-body td {
    border: 1px solid #dfe2e5;
    padding: 6px 13px;
    text-align: left;
  }
  .markdown-body th { background: #f6f8fa; font-weight: 600; }
  .markdown-body tr:nth-child(even) td { background: #fafbfc; }
  .markdown-body strong { font-weight: 600; }

  .search-highlight { background: #fff59d; padding: 1px 2px; border-radius: 2px; }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AdminDocsCenter: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<DocEntry>(DOC_REGISTRY[0]);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /* ------ fetch doc content ------ */
  const fetchDoc = useCallback(async (doc: DocEntry) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/docs/suite/${doc.filename}`);
      if (!response.ok) throw new Error(`Failed to load document: ${response.status}`);
      const text = await response.text();
      setMarkdownContent(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load document';
      setError(msg);
      setMarkdownContent('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoc(selectedDoc);
  }, [selectedDoc, fetchDoc]);

  /* ------ TOC ------ */
  const toc = useMemo(() => extractToc(markdownContent), [markdownContent]);
  const metadata = useMemo(() => extractMetadata(markdownContent), [markdownContent]);

  /* ------ Rendered HTML ------ */
  const renderedHtml = useMemo(() => {
    if (!markdownContent) return '';
    let html = markdownToHtml(markdownContent);

    // Search highlighting (client-side)
    if (searchQuery.trim().length >= 2) {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      // Only highlight inside text nodes (not inside HTML tags)
      html = html.replace(/>([^<]+)</g, (_match, text) => {
        const highlighted = (text as string).replace(regex, '<span class="search-highlight">$1</span>');
        return `>${highlighted}<`;
      });
    }

    // Sanitize with DOMPurify — allow safe tags only
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['button'],
      ADD_ATTR: ['data-lang', 'class', 'id', 'rel'],
    });
  }, [markdownContent, searchQuery]);

  /* ------ Copy code block handler ------ */
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('copy-code-btn')) {
      const wrapper = target.closest('.code-block-wrapper');
      const codeEl = wrapper?.querySelector('code');
      if (codeEl) {
        const text = codeEl.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
          target.textContent = 'Copied!';
          target.classList.add('copied');
          setTimeout(() => {
            target.textContent = 'Copy';
            target.classList.remove('copied');
          }, 2000);
        });
      }
    }
  }, []);

  /* ------ TOC click handler ------ */
  const scrollToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  /* ------ search match count ------ */
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return 0;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const matches = markdownContent.match(regex);
    return matches ? matches.length : 0;
  }, [markdownContent, searchQuery]);

  /* ------ doc selection handler ------ */
  const handleSelectDoc = useCallback((doc: DocEntry) => {
    setSelectedDoc(doc);
    setSearchQuery('');
  }, []);

  /* ------ copy TOC ID ------ */
  const handleCopyTocLink = useCallback((id: string) => {
    navigator.clipboard.writeText(`#${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <Box data-testid="docs-center-page">
      <style>{markdownStyles}</style>
      <AdminPageHeader
        title="Documentation"
        subtitle="Platform documentation and deployment guides"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Documentation' },
        ]}
      />

      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 180px)', minHeight: 500 }}>
        {/* Left Panel — Document List */}
        <Paper
          sx={{
            width: 280,
            minWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          elevation={1}
        >
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Documents
            </Typography>
          </Box>
          <List sx={{ flexGrow: 1, overflow: 'auto', py: 0 }} data-testid="docs-nav-list">
            {DOC_REGISTRY.map((doc) => (
              <ListItem key={doc.id} disablePadding>
                <ListItemButton
                  selected={selectedDoc.id === doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  data-testid={`doc-nav-${doc.id}`}
                  sx={{
                    py: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' },
                      '& .MuiChip-root': { color: 'white', borderColor: 'rgba(255,255,255,0.5)' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <DocIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.title}
                    secondary={`${doc.id} — v${doc.version || '1.0'}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: selectedDoc.id === doc.id ? 600 : 400 }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      color: selectedDoc.id === doc.id ? 'inherit' : 'text.secondary',
                    }}
                  />
                  <Chip
                    label={doc.status === 'final' ? 'Final' : 'Outline'}
                    size="small"
                    variant="outlined"
                    color={doc.status === 'final' ? 'success' : 'default'}
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Center Panel — Document Content */}
        <Paper
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          elevation={1}
        >
          {/* Toolbar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'grey.50',
            }}
          >
            <TextField
              size="small"
              placeholder="Search in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ width: 300 }}
              data-testid="doc-search-input"
            />
            {searchQuery.trim().length >= 2 && (
              <Chip
                label={`${searchMatchCount} match${searchMatchCount !== 1 ? 'es' : ''}`}
                size="small"
                color={searchMatchCount > 0 ? 'primary' : 'default'}
                variant="outlined"
                data-testid="search-match-count"
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            {metadata.version && (
              <Chip label={`v${metadata.version}`} size="small" variant="outlined" />
            )}
            {metadata.lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated: {metadata.lastUpdated}
              </Typography>
            )}
            {metadata.status && (
              <Chip
                label={metadata.status}
                size="small"
                variant="outlined"
                color={metadata.status.toLowerCase().includes('final') ? 'success' : 'info'}
              />
            )}
            <Tooltip title={tocOpen ? 'Hide table of contents' : 'Show table of contents'}>
              <IconButton size="small" onClick={() => setTocOpen(!tocOpen)} data-testid="toc-toggle">
                <TocIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Content Area */}
          <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
            {/* Main Content */}
            <Box
              ref={contentRef}
              onClick={handleContentClick}
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: 3,
              }}
              data-testid="doc-content"
            >
              {loading ? (
                <Box>
                  <Skeleton variant="text" width="60%" height={40} />
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="85%" />
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="80%" sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="75%" />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : (
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              )}
            </Box>

            {/* Right Panel — Table of Contents */}
            {tocOpen && toc.length > 0 && !loading && (
              <>
                <Divider orientation="vertical" flexItem />
                <Box
                  sx={{
                    width: 260,
                    minWidth: 260,
                    overflow: 'auto',
                    p: 1.5,
                    backgroundColor: 'grey.50',
                  }}
                  data-testid="toc-panel"
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 0.5 }}>
                    Table of Contents
                  </Typography>
                  <List dense sx={{ py: 0 }}>
                    {toc.map((item, index) => (
                      <ListItem
                        key={`${item.id}-${index}`}
                        disablePadding
                        secondaryAction={
                          <Tooltip title="Copy link">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyTocLink(item.id);
                              }}
                              sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                            >
                              {copiedId === item.id ? (
                                <CheckIcon sx={{ fontSize: 14 }} color="success" />
                              ) : (
                                <CopyIcon sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemButton
                          onClick={() => scrollToHeading(item.id)}
                          sx={{
                            py: 0.3,
                            pl: (item.level - 1) * 1.5 + 0.5,
                            borderRadius: 0.5,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        >
                          <ListItemText
                            primary={item.text}
                            primaryTypographyProps={{
                              variant: 'caption',
                              fontSize: item.level <= 2 ? '0.78rem' : '0.72rem',
                              fontWeight: item.level <= 2 ? 600 : 400,
                              color: item.level <= 2 ? 'text.primary' : 'text.secondary',
                              noWrap: true,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default AdminDocsCenter;
