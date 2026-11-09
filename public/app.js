// ==========================================================================
// Theme Management (Dark Mode / Light Mode)
// ==========================================================================
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');

// Initialize theme from localStorage or default to dark
function initTheme() {
  const savedTheme = localStorage.getItem('rag_theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Default to dark mode
    setTheme('dark');
  }
}

function setTheme(theme) {
  if (theme === 'dark') {
    htmlEl.classList.add('dark');
    htmlEl.setAttribute('data-theme', 'dark');
  } else {
    htmlEl.classList.remove('dark');
    htmlEl.setAttribute('data-theme', 'light');
  }
  localStorage.setItem('rag_theme', theme);
}

themeToggleBtn.addEventListener('click', () => {
  const isDark = htmlEl.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  setTheme(newTheme);
});

// ==========================================================================
// Upload & File Selection State
// ==========================================================================
const MAX_FILES = 3;
let selectedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const selectionCount = document.getElementById('selection-count');
const fileList = document.getElementById('file-list');
const uploadBtn = document.getElementById('upload-btn');
const uploadBtnText = document.getElementById('upload-btn-text');
const uploadBtnIcon = document.getElementById('upload-btn-icon');
const uploadBtnSpinner = document.getElementById('upload-btn-spinner');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');

// Format bytes into human-readable string (KB, MB)
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Show Toast notification using pure Tailwind utility classes
let toastTimeout;
function showToast(message, type = 'default') {
  clearTimeout(toastTimeout);
  toastMessageEl.textContent = message;

  // Base visible styles
  let typeClasses = 'border-white/10 dark:border-[#234633]';
  if (type === 'error') {
    typeClasses = 'border-red-500/60 text-red-200';
  } else if (type === 'success') {
    typeClasses = 'border-emerald-500/60 text-emerald-200';
  }

  toastEl.className = `fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-md px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 z-50 transition-all duration-300 ease-out translate-y-0 opacity-100 pointer-events-auto bg-[#1f2937] text-[#f9fafb] border dark:bg-[#16291e] dark:text-[#f0fdf4] ${typeClasses}`;

  toastTimeout = setTimeout(() => {
    toastEl.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 translate-y-24 opacity-0 pointer-events-none max-w-[90vw] sm:max-w-md px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 z-50 transition-all duration-300 ease-out bg-[#1f2937] text-[#f9fafb] border border-white/10 dark:bg-[#16291e] dark:text-[#f0fdf4] dark:border-[#234633]';
  }, 3800);
}

// Update UI elements based on selectedFiles
function updateUI() {
  // Update counter
  selectionCount.textContent = `${selectedFiles.length}/${MAX_FILES} selected`;

  // Update button disabled state
  if (selectedFiles.length > 0) {
    uploadBtn.removeAttribute('disabled');
  } else {
    uploadBtn.setAttribute('disabled', 'true');
  }

  // Render selected files
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-[#e2e8e4] dark:border-[#1a2f23] bg-white dark:bg-[#13241b] hover:bg-[#f3f8f5] dark:hover:bg-[#192d22] hover:border-[#b8d9c5] dark:hover:border-[#223f2f] transition-all duration-200 shadow-sm';
    item.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden text-left min-w-0">
        <span class="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold tracking-wider rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0 uppercase">
          PDF
        </span>
        <div class="flex flex-col min-w-0 overflow-hidden">
          <span class="text-sm font-medium text-[#111a14] dark:text-[#edf4ef] truncate max-w-[220px] sm:max-w-[320px] md:max-w-[360px]" title="${escapeHtml(file.name)}">
            ${escapeHtml(file.name)}
          </span>
          <span class="text-xs text-[#5e6f65] dark:text-[#889e92]">
            ${formatFileSize(file.size)}
          </span>
        </div>
      </div>
      <button type="button" class="shrink-0 p-1.5 rounded-lg text-[#88998f] dark:text-[#576d60] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 ml-2 cursor-pointer focus:outline-none" data-index="${index}" title="Remove file" aria-label="Remove ${escapeHtml(file.name)}">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    item.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(index);
    });

    fileList.appendChild(item);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Remove file by index
function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateUI();
}

// Handle file addition with validation (PDF only, max 3 files)
function handleFiles(files) {
  const fileArray = Array.from(files);

  let nonPdfCount = 0;
  let duplicateCount = 0;
  let addedCount = 0;

  for (const file of fileArray) {
    // Check if max reached
    if (selectedFiles.length >= MAX_FILES) {
      showToast(`Maximum ${MAX_FILES} files allowed. Extra files were ignored.`, 'error');
      break;
    }

    // Check PDF extension or MIME type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      nonPdfCount++;
      continue;
    }

    // Check duplicate
    const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
      duplicateCount++;
      continue;
    }

    selectedFiles.push(file);
    addedCount++;
  }

  if (nonPdfCount > 0) {
    showToast(`Only PDF files are supported. ${nonPdfCount} non-PDF file(s) ignored.`, 'error');
  } else if (duplicateCount > 0 && addedCount === 0) {
    showToast('This file is already selected.', 'error');
  }

  updateUI();
}

// ==========================================================================
// Event Listeners for Drag & Drop and File Picker
// ==========================================================================

// Click dropzone to open native file selector
dropZone.addEventListener('click', () => {
  if (selectedFiles.length >= MAX_FILES) {
    showToast(`You have already selected the maximum of ${MAX_FILES} PDFs. Remove one to replace it.`, 'error');
    return;
  }
  fileInput.click();
});

// Keyboard accessibility (Enter or Space to trigger file browser)
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    dropZone.click();
  }
});

// File picker input change
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFiles(e.target.files);
    fileInput.value = '';
  }
});

// Drag and drop interactive feedback
const dragClasses = ['border-emerald-500', 'dark:border-emerald-400', 'bg-emerald-100/50', 'dark:bg-[#172a20]', 'scale-[1.01]', 'border-solid'];

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('border-dashed');
    dropZone.classList.add(...dragClasses);
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove(...dragClasses);
    dropZone.classList.add('border-dashed');
  });
});

// Prevent document-level accidental drop
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// Handle dropped files
dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    handleFiles(dt.files);
  }
});

// ==========================================================================
// Upload Action
// ==========================================================================
uploadBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0 || uploadBtn.hasAttribute('disabled')) return;

  const formData = new FormData();
  selectedFiles.forEach(file => {
    formData.append('pdfs', file);
  });

  // Enter loading state
  uploadBtn.setAttribute('disabled', 'true');
  uploadBtnSpinner.classList.remove('hidden');
  uploadBtnSpinner.classList.add('inline-block');
  uploadBtnIcon.classList.add('hidden');
  uploadBtnText.textContent = 'Uploading...';

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    showToast(result.message || 'PDFs uploaded successfully!', 'success');
    uploadBtnText.textContent = 'Uploaded!';
    
    // Reset selected files
    setTimeout(() => {
      selectedFiles = [];
      updateUI();
      uploadBtnSpinner.classList.add('hidden');
      uploadBtnSpinner.classList.remove('inline-block');
      uploadBtnIcon.classList.remove('hidden');
      uploadBtnText.textContent = 'Upload';
    }, 1500);

  } catch (error) {
    showToast(error.message || 'Failed to upload files.', 'error');
    uploadBtn.removeAttribute('disabled');
    uploadBtnSpinner.classList.add('hidden');
    uploadBtnSpinner.classList.remove('inline-block');
    uploadBtnIcon.classList.remove('hidden');
    uploadBtnText.textContent = 'Upload';
  }
});

// Initialize on page load
initTheme();
updateUI();
