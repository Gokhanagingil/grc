#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_SVG = path.join(__dirname, '../public/brand/niles-icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public');

const SIZES = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'logo192.png': 192,
  'logo512.png': 512,
};

async function generateFavicons() {
  console.log('Generating favicons from:', SOURCE_SVG);
  console.log('Output directory:', OUTPUT_DIR);

  const svgBuffer = fs.readFileSync(SOURCE_SVG);

  for (const [filename, size] of Object.entries(SIZES)) {
    const outputPath = path.join(OUTPUT_DIR, filename);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${filename} (${size}x${size})`);
  }

  const pngToIco = (await import('png-to-ico')).default;
  const favicon16Path = path.join(OUTPUT_DIR, 'favicon-16x16.png');
  const favicon32Path = path.join(OUTPUT_DIR, 'favicon-32x32.png');

  const icoBuffer = await pngToIco([favicon16Path, favicon32Path]);
  const icoPath = path.join(OUTPUT_DIR, 'favicon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Generated: favicon.ico (multi-resolution)');

  console.log('\nFavicon generation complete!');
}

generateFavicons().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
