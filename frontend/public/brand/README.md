# NILES Brand Assets

This directory contains the branding assets for the NILES platform.

## Assets

The following assets are available:

**niles-logo.svg** - Full logo with icon and "NILES" text. Use this for larger displays where horizontal space is available.

**niles-icon.svg** - Icon-only version. Use this for smaller spaces like the sidebar header, login page, and favicon generation.

## Favicon Files

The favicon files in the parent directory (`frontend/public/`) are generated from `niles-icon.svg`:

- `favicon.ico` - Multi-resolution ICO file (16x16, 32x32)
- `favicon-16x16.png` - 16x16 PNG favicon
- `favicon-32x32.png` - 32x32 PNG favicon
- `apple-touch-icon.png` - 180x180 PNG for iOS devices
- `logo192.png` - 192x192 PNG for PWA manifest
- `logo512.png` - 512x512 PNG for PWA manifest

## Updating Assets

To regenerate favicon files from a new SVG:

```bash
cd frontend/public/brand

# Generate PNG files
rsvg-convert -w 16 -h 16 niles-icon.svg -o ../favicon-16x16.png
rsvg-convert -w 32 -h 32 niles-icon.svg -o ../favicon-32x32.png
rsvg-convert -w 180 -h 180 niles-icon.svg -o ../apple-touch-icon.png
rsvg-convert -w 192 -h 192 niles-icon.svg -o ../logo192.png
rsvg-convert -w 512 -h 512 niles-icon.svg -o ../logo512.png

# Generate ICO file (requires ImageMagick)
cd ..
convert favicon-16x16.png favicon-32x32.png -colors 256 favicon.ico
```

## Usage in Code

The logo is used in:

- **Sidebar header** (`src/components/Layout.tsx`) - Icon + "NILES" text
- **Login page** (`src/pages/Login.tsx`) - Icon + "NILES" text

## Design Notes

The logo uses the Material UI primary blue color (`#1976d2`) with a gradient effect. The icon features a stylized "N" mark within a rounded rectangle. The design is intentionally minimal and modern to maintain a professional appearance.
