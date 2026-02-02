# NILES Brand Assets

This directory contains the branding assets for the NILES platform.

## Assets

**niles-logo.svg** - Full logo with icon and "NILES" text. Use this for larger displays where horizontal space is available.

**niles-icon.svg** - Icon-only version (source of truth). Use this for smaller spaces like the sidebar header, login page, and favicon generation.

## Favicon Files

The favicon files in the parent directory (`frontend/public/`) are generated from `niles-icon.svg`:

- `favicon.ico` - Multi-resolution ICO file (16x16, 32x32)
- `favicon-16x16.png` - 16x16 PNG favicon
- `favicon-32x32.png` - 32x32 PNG favicon
- `apple-touch-icon.png` - 180x180 PNG for iOS devices
- `logo192.png` - 192x192 PNG for PWA manifest
- `logo512.png` - 512x512 PNG for PWA manifest

## Regenerating Favicons

To regenerate favicon files after updating `niles-icon.svg`, use the Node.js script:

```bash
cd frontend
npm run generate:favicons
```

This script uses `sharp` and `png-to-ico` (devDependencies) to generate all PNG sizes and the multi-resolution ICO file from the source SVG.

After regenerating, update the cache-busting version in `public/index.html` (e.g., `?v=YYYYMMDDNN`) to ensure browsers fetch the new favicons.

## Usage in Code

The logo is used in:

- **Sidebar header** (`src/components/Layout.tsx`) - Icon + "NILES" text
- **Login page** (`src/pages/Login.tsx`) - Icon + "NILES" text

## Design Notes

The logo uses the Material UI primary blue color (`#1976d2`) with a gradient effect. The icon features a stylized "N" mark within a rounded rectangle. The design is intentionally minimal and modern to maintain a professional appearance.
