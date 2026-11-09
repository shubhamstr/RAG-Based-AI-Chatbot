// ==========================================================================
// Theme Management (Dark Mode / Light Mode)
// ==========================================================================
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');

// Initialize theme from localStorage or system preference (defaults to dark to match the design)
function initTheme() {
  const savedTheme = localStorage.getItem('rag_theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Default to dark as requested and shown in design
    setTheme('dark');
  }
}

function setTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  localStorage.setItem('rag_theme', theme);
}

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = htmlEl.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
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
const btnText = uploadBtn.querySelector('.btn-text');
const toastEl = document.getElementById('toast');

// Format bytes into readable string (KB, MB)
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Show Toast notification
let toastTimeout;
function showToast(message, type = 'default') {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = 'toast show';
  
  if (type === 'error') {
    toastEl.classList.add('toast-error');
  } else if (type === 'success') {
    toastEl.classList.add('toast-success');
  }

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3800);
}

// Update UI elements based on selectedFiles
function updateUI() {
  // Update counter
  selectionCount.textContent = `${selectedFiles.length}/${MAX_FILES} selected`;

  // Update button state
  if (selectedFiles.length > 0) {
    uploadBtn.removeAttribute('disabled');
  } else {
    uploadBtn.setAttribute('disabled', 'true');
  }

  // Render selected files
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-info">
        <span class="pdf-badge">PDF</span>
        <div class="file-details">
          <span class="file-name" title="${file.name}">${escapeHtml(file.name)}</span>
          <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
      </div>
      <button type="button" class="file-remove-btn" data-index="${index}" title="Remove file" aria-label="Remove ${escapeHtml(file.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    item.querySelector('.file-remove-btn').addEventListener('click', (e) => {
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

// Keyboard support (Enter or Space to trigger file browser)
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
    // Reset input so re-selecting the same file if removed works
    fileInput.value = '';
  }
});

// Drag and drop events
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
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
  uploadBtn.classList.add('is-loading');
  btnText.textContent = 'Uploading...';

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
    btnText.textContent = 'Uploaded!';
    
    // Reset selected files after a brief celebration
    setTimeout(() => {
      selectedFiles = [];
      updateUI();
      uploadBtn.classList.remove('is-loading');
      btnText.textContent = 'Upload';
    }, 1500);

  } catch (error) {
    showToast(error.message || 'Failed to upload files.', 'error');
    uploadBtn.removeAttribute('disabled');
    uploadBtn.classList.remove('is-loading');
    btnText.textContent = 'Upload';
  }
});

// Initialize on page load
initTheme();
updateUI();
