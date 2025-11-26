#!/usr/bin/env node

/**
 * Post-build script to inject environment variables into web builds
 * This script runs after `expo export` and modifies the index.html
 * to include environment configuration.
 */

/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist');
const indexPath = path.join(distPath, 'index.html');

// Check if dist/index.html exists
if (!fs.existsSync(indexPath)) {
  console.log('[POST-BUILD] No dist/index.html found, skipping env injection');
  process.exit(0);
}

console.log('[POST-BUILD] Injecting environment variables into index.html...');

// Read index.html
let html = fs.readFileSync(indexPath, 'utf8');

// Create environment config script
const envScript = `
<script>
  // Environment configuration injected at build time
  window.EXPO_FILE_SYNC_URL = 'https://tracker.tecclk.com/Tracker/api';
  window.EXPO_PUBLIC_FILE_SYNC_URL = 'https://tracker.tecclk.com/Tracker/api';
  window.EXPO_PUBLIC_RORK_API_BASE_URL = 'https://tracker.tecclk.com';
  window.EXPO_PUBLIC_JSONBIN_KEY = '';
  window.EXPO_JSONBIN_KEY = '';
  console.log('[ENV CONFIG] Environment variables loaded:', {
    FILE_SYNC_URL: window.EXPO_PUBLIC_FILE_SYNC_URL,
    API_BASE_URL: window.EXPO_PUBLIC_RORK_API_BASE_URL,
    JSONBIN_KEY_SET: !!window.EXPO_PUBLIC_JSONBIN_KEY
  });
</script>
`;

// Inject script before closing </head> tag
if (html.includes('</head>')) {
  html = html.replace('</head>', `${envScript}\n  </head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[POST-BUILD] ✓ Environment variables injected successfully');
} else {
  console.error('[POST-BUILD] ✗ Could not find </head> tag in index.html');
  process.exit(1);
}
