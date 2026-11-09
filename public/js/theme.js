/**
 * Theme Management (Dark Mode / Light Mode)
 */

const STORAGE_KEY = 'rag_theme';
const htmlEl = document.documentElement;

/**
 * Get current active theme
 * @returns {'dark' | 'light'}
 */
export function getTheme() {
  return htmlEl.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Apply theme to document and persist in localStorage
 * @param {'dark' | 'light'} theme
 */
export function setTheme(theme) {
  if (theme === 'dark') {
    htmlEl.classList.add('dark');
    htmlEl.setAttribute('data-theme', 'dark');
  } else {
    htmlEl.classList.remove('dark');
    htmlEl.setAttribute('data-theme', 'light');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Toggle between dark and light themes
 * @returns {'dark' | 'light'} The newly applied theme
 */
export function toggleTheme() {
  const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
  return nextTheme;
}

/**
 * Initialize theme from localStorage or default to dark
 * and attach listener to theme toggle button
 */
export function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    setTheme(savedTheme);
  } else {
    // Default to dark mode
    setTheme('dark');
  }

  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
    });
  }
}

