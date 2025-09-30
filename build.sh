#!/bin/bash

echo "🔧 Building HBIClipboard Manager for macOS..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the app
echo "🚀 Building macOS app..."
npm run build:mac

echo "✅ Build complete!"
echo ""
echo "📁 Output files:"
echo "   DMG: dist/Clipboard Manager-1.0.0.dmg"
echo "   ZIP: dist/Clipboard Manager-1.0.0-mac.zip"
echo ""
echo "🍃 To install:"
echo "   1. Open the DMG file"
echo "   2. Drag 'HBIClipboard Manager' to Applications folder"
echo "   3. Run from Applications or Launchpad"