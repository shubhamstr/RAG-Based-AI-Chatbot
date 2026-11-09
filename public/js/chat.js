/**
 * Chat Interface Controller
 * Handles document file view popup in iframe, previous page redirection, and RAG messaging.
 */

import { initTheme } from './theme.js';

// Fallback sample file matching the user's initial screen
const DEFAULT_FILE = {
  originalName: 'Mercer Executive Summary.pdf',
  fileName: 'Mercer-Executive-Summary.pdf',
  url: '/uploads/Mercer-Executive-Summary.pdf',
  size: 584
};

// State
let uploadedFiles = [];
let currentViewingFile = null;

// DOM Element References
const filePillsContainer = document.getElementById('file-pills-container');
const newUploadBtn = document.getElementById('new-upload-btn');
const emptyState = document.getElementById('empty-state');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Modal Elements
const fileModal = document.getElementById('file-modal');
const fileModalCard = document.getElementById('file-modal-card');
const modalFileTitle = document.getElementById('modal-file-title');
const modalFileSubtitle = document.getElementById('modal-file-subtitle');
const modalOpenNewtab = document.getElementById('modal-open-newtab');
const modalCloseBtn = document.getElementById('modal-close-btn');
const fileViewerIframe = document.getElementById('file-viewer-iframe');
const modalFileTabs = document.getElementById('modal-file-tabs');

/**
 * Format bytes into human-readable string
 */
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

/**
 * Load files from localStorage or backend
 */
async function loadFiles() {
  const stored = localStorage.getItem('rag_uploaded_files');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        uploadedFiles = parsed.map(f => ({
          ...f,
          url: f.url || `/uploads/${f.fileName}`
        }));
      }
    } catch (e) {
      console.warn('Failed to parse stored files', e);
    }
  }

  // If no files in localStorage, query backend
  if (uploadedFiles.length === 0) {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          uploadedFiles = data.files.map(f => ({
            ...f,
            url: `/uploads/${f.fileName}`
          }));
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  // If still empty, use default sample
  if (uploadedFiles.length === 0) {
    uploadedFiles = [DEFAULT_FILE];
  }

  renderFilePills();
}

/**
 * Truncate filename with ellipsis like the user screenshot
 */
function truncateFileName(name, maxChars = 24) {
  if (name.length <= maxChars) return name;
  return name.slice(0, maxChars - 3) + '...';
}

/**
 * Render the file view pill(s) in the top toolbar
 */
function renderFilePills() {
  if (!filePillsContainer) return;
  filePillsContainer.innerHTML = '';

  uploadedFiles.forEach((file) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'file-view-btn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#eef4f0] hover:bg-[#e2ebe5] dark:bg-[#101b15] dark:hover:bg-[#15231c] text-[#2b4235] dark:text-[#c4d8ce] border border-[#d2dfd7] dark:border-[#1f3427] hover:border-emerald-500/40 dark:hover:border-[#2e4c3a] transition-all duration-200 cursor-pointer shadow-sm group shrink-0 active:scale-95';
    pill.title = `Click to view ${file.originalName}`;

    pill.innerHTML = `
      <svg class="w-3.5 h-3.5 text-[#52705f] dark:text-[#7f988b] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      <span class="file-name truncate max-w-[150px] sm:max-w-[210px]">${escapeHtml(truncateFileName(file.originalName))}</span>
      <span class="file-view-icon-wrapper ml-0.5 text-[#52705f] dark:text-[#7f988b] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title="View file in popup">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </span>
    `;

    pill.addEventListener('click', (e) => {
      e.preventDefault();
      openFileModal(file);
    });

    filePillsContainer.appendChild(pill);
  });
}

/**
 * Open the popup modal to view a file in an iframe tag
 */
export function openFileModal(file) {
  currentViewingFile = file;
  if (!fileModal || !fileViewerIframe) return;

  const fileUrl = file.url || `/uploads/${file.fileName}`;
  const fileName = file.originalName || file.fileName || 'Document Preview';

  // Update modal header
  if (modalFileTitle) modalFileTitle.textContent = fileName;
  if (modalFileSubtitle) {
    const sizeStr = formatSize(file.size);
    modalFileSubtitle.textContent = sizeStr ? `PDF Document &middot; ${sizeStr}` : 'PDF Document';
  }
  if (modalOpenNewtab) {
    modalOpenNewtab.href = fileUrl;
  }

  // Render modal file switcher tabs if multiple files
  renderModalTabs();

  // Load PDF into iframe
  fileViewerIframe.src = fileUrl;

  // Show modal
  fileModal.classList.remove('opacity-0', 'pointer-events-none');
  fileModal.classList.add('opacity-100', 'pointer-events-auto');
  fileModalCard?.classList.remove('scale-95');
  fileModalCard?.classList.add('scale-100');

  // Prevent background body scroll
  document.body.classList.add('overflow-hidden');
}

/**
 * Render modal tabs for multiple uploaded files
 */
function renderModalTabs() {
  if (!modalFileTabs) return;

  if (uploadedFiles.length <= 1) {
    modalFileTabs.classList.add('hidden');
    modalFileTabs.innerHTML = '';
    return;
  }

  modalFileTabs.classList.remove('hidden');
  modalFileTabs.innerHTML = '';

  uploadedFiles.forEach(file => {
    const isActive = currentViewingFile && currentViewingFile.fileName === file.fileName;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer truncate max-w-[130px] ${
      isActive 
        ? 'bg-emerald-600 text-white' 
        : 'bg-[#e2ebe5] dark:bg-[#1a2c22] text-[#344e40] dark:text-[#a0b8ac] hover:text-white hover:bg-emerald-700'
    }`;
    tab.textContent = file.originalName;
    tab.title = file.originalName;
    tab.addEventListener('click', () => {
      openFileModal(file);
    });
    modalFileTabs.appendChild(tab);
  });
}

/**
 * Close the popup modal
 */
export function closeFileModal() {
  if (!fileModal) return;

  fileModal.classList.remove('opacity-100', 'pointer-events-auto');
  fileModal.classList.add('opacity-0', 'pointer-events-none');
  fileModalCard?.classList.remove('scale-100');
  fileModalCard?.classList.add('scale-95');

  // Reset iframe src to free memory
  if (fileViewerIframe) {
    fileViewerIframe.src = 'about:blank';
  }

  document.body.classList.remove('overflow-hidden');
}

/**
 * Simple markdown-like text formatter
 */
function formatMarkdown(text) {
  let html = escapeHtml(text);
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-emerald-700 dark:text-emerald-300">$1</strong>');
  // Bullet points
  html = html.replace(/^[-\*]\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Newlines to line breaks
  html = html.replace(/\n\n/g, '<div class="h-2"></div>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

/**
 * Smoothly scroll chat messages container to bottom
 */
function scrollToBottom(smooth = true) {
  if (!chatMessages) return;
  requestAnimationFrame(() => {
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  });
}

/**
 * Append chat message bubble to thread
 */
function appendMessage(role, text) {
  if (emptyState) emptyState.classList.add('hidden');
  if (chatMessages) chatMessages.classList.remove('hidden');

  const messageWrapper = document.createElement('div');
  const isUser = role === 'user';

  messageWrapper.className = `w-full flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`;

  const bubble = document.createElement('div');
  bubble.className = isUser
    ? 'max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-emerald-600 text-white text-sm shadow-sm'
    : 'max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-[#101b15] border border-[#d8e3dc] dark:border-[#1d3326] text-[#111a14] dark:text-[#ddead4] text-sm shadow-sm leading-relaxed';

  bubble.innerHTML = formatMarkdown(text);
  messageWrapper.appendChild(bubble);

  chatMessages?.appendChild(messageWrapper);
  scrollToBottom(true);

  return messageWrapper;
}

/**
 * Send chat query to server
 */
async function handleChatSubmit(e) {
  e.preventDefault();
  const query = chatInput?.value.trim();
  if (!query) return;

  // Append user message
  appendMessage('user', query);
  chatInput.value = '';

  // Append temporary bot typing indicator
  const typingIndicator = appendMessage('assistant', 'Thinking...');
  const typingBubble = typingIndicator.querySelector('div');
  if (typingBubble) {
    typingBubble.innerHTML = `
      <div class="flex items-center gap-1.5 py-1">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
      </div>
    `;
  }

  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        files: uploadedFiles
      })
    });

    const data = await res.json();
    if (typingBubble) {
      typingBubble.innerHTML = formatMarkdown(data.reply || "I couldn't process your request.");
    }
    scrollToBottom(true);
  } catch (err) {
    if (typingBubble) {
      typingBubble.innerHTML = `<span class="text-red-500 dark:text-red-400">Failed to connect to assistant: ${escapeHtml(err.message)}</span>`;
    }
    scrollToBottom(true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    chatInput?.focus();
    scrollToBottom(true);
  }
}

/**
 * Handle "New upload" action: redirect to previous page
 */
function handleNewUpload() {
  // If user came from the upload page (e.g. index.html or document.referrer is from same origin)
  if (document.referrer && window.location.origin && document.referrer.startsWith(window.location.origin) && !document.referrer.includes('/chat')) {
    window.location.href = document.referrer;
  } else {
    // Redirect to home/upload page
    window.location.href = '/';
  }
}

/**
 * Setup event listeners
 */
function initEvents() {
  // New upload button listener
  newUploadBtn?.addEventListener('click', handleNewUpload);

  // Modal close handlers
  modalCloseBtn?.addEventListener('click', closeFileModal);
  
  // Close on backdrop click (click outside modal card)
  fileModal?.addEventListener('click', (e) => {
    if (e.target === fileModal) {
      closeFileModal();
    }
  });

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fileModal && !fileModal.classList.contains('pointer-events-none')) {
      closeFileModal();
    }
  });

  // Chat submit handler
  chatForm?.addEventListener('submit', handleChatSubmit);
}

// Initialize on DOM load
function initChatApp() {
  initTheme();
  initEvents();
  loadFiles();
  chatInput?.focus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatApp);
} else {
  initChatApp();
}

