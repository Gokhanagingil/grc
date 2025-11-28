#!/bin/bash
# Retry build script - npm ci → npm run build:once with 3 retries

set -e

MAX_RETRIES=3
retry_count=0

echo "🔨 Retry Build Script"

# Log versions
echo "Checking versions..."
if command -v node &> /dev/null; then
  node_version=$(node --version)
  echo "  Node.js: $node_version"
else
  echo "  ❌ Node.js not found"
  exit 1
fi

if command -v npx &> /dev/null && npx tsc --version &> /dev/null; then
  tsc_version=$(npx tsc --version)
  echo "  TypeScript: $tsc_version"
else
  echo "  ⚠️  TypeScript not found (will use from node_modules)"
fi

# Clean install
echo ""
echo "📦 Running npm ci..."
if npm ci; then
  echo "✅ npm ci completed"
else
  echo "❌ npm ci failed"
  exit 1
fi

# Retry build
while [ $retry_count -lt $MAX_RETRIES ]; do
  retry_count=$((retry_count + 1))
  echo ""
  echo "🔨 Build attempt $retry_count/$MAX_RETRIES..."
  
  if npm run build:once; then
    echo "✅ Build successful!"
    exit 0
  else
    echo "❌ Build failed (exit code: $?)"
    if [ $retry_count -lt $MAX_RETRIES ]; then
      echo "Retrying in 2 seconds..."
      sleep 2
    fi
  fi
done

echo ""
echo "❌ Build failed after $MAX_RETRIES attempts"
exit 1

