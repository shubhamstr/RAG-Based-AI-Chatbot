/**
 * Application Entry Point
 * Orchestrates modular components: theme management and file upload handling.
 */

import { initTheme } from './js/theme.js';
import { initUpload } from './js/upload.js';

function initApp() {
  initTheme();
  initUpload();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
