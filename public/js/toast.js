/**
 * Toast Notification Utility
 */

let toastTimeout = null;

const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');

const HIDDEN_CLASSES = 'fixed bottom-6 left-1/2 -translate-x-1/2 translate-y-24 opacity-0 pointer-events-none max-w-[90vw] sm:max-w-md px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 z-50 transition-all duration-300 ease-out bg-[#1f2937] text-[#f9fafb] border border-white/10 dark:bg-[#16291e] dark:text-[#f0fdf4] dark:border-[#234633]';

/**
 * Display a toast notification
 * @param {string} message - Notification text
 * @param {'default' | 'success' | 'error'} [type='default'] - Visual style of toast
 * @param {number} [duration=3800] - Duration in ms before auto-dismiss
 */
export function showToast(message, type = 'default', duration = 3800) {
  if (!toastEl || !toastMessageEl) return;

  clearTimeout(toastTimeout);
  toastMessageEl.textContent = message;

  let typeClasses = 'border-white/10 dark:border-[#234633]';
  if (type === 'error') {
    typeClasses = 'border-red-500/60 text-red-200';
  } else if (type === 'success') {
    typeClasses = 'border-emerald-500/60 text-emerald-200';
  }

  toastEl.className = `fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-md px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 z-50 transition-all duration-300 ease-out translate-y-0 opacity-100 pointer-events-auto bg-[#1f2937] text-[#f9fafb] border dark:bg-[#16291e] dark:text-[#f0fdf4] ${typeClasses}`;

  toastTimeout = setTimeout(() => {
    toastEl.className = HIDDEN_CLASSES;
  }, duration);
}

