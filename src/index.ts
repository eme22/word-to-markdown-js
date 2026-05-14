import {
  convertWithWarnings,
  UnsupportedFileError,
  InvalidFileError,
  ConversionError,
  validateFileExtension,
} from './main.js';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import ClipboardJS from 'clipboard';
import './dark-mode.css';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});

worker.onerror = (e) => {
  console.error('Worker error:', e);
  showError('The conversion worker failed to start or encountered an error.');
  const loadingElement = document.getElementById('loading');
  const inputElement = document.getElementById('input');
  if (loadingElement) loadingElement.classList.add('d-none');
  if (inputElement) inputElement.classList.remove('d-none');
};

worker.onmessage = async (e: MessageEvent): Promise<void> => {
  const { type, result, html, error, errorType } = e.data;

  const inputElement = document.getElementById('input');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');

  // Hide loading spinner
  if (loadingElement) loadingElement.classList.add('d-none');

  if (type === 'success') {
    try {
      // Display warnings if any
      if (result.warnings.length > 0) {
        showWarnings(result.warnings);
      }

      const outputElement = document.getElementById('output');
      if (outputElement) outputElement.innerText = result.markdown;

      const renderedElement = document.getElementById('rendered');
      if (renderedElement) renderedElement.innerHTML = String(html);

      const filenameElement = document.getElementById('filename');
      if (filenameElement) {
        // Filename should already be set in handleFile
      }

      if (resultsElement) resultsElement.classList.remove('d-none');
    } catch (err) {
      console.error('Error displaying results:', err);
      showError('An error occurred while displaying the conversion results.');
      if (inputElement) inputElement.classList.remove('d-none');
    }
  } else {
    // Handle worker errors
    if (
      errorType === 'UnsupportedFileError' ||
      errorType === 'InvalidFileError' ||
      errorType === 'ConversionError'
    ) {
      showError(error);
    } else {
      showError(
        'An error occurred during conversion: ' + (error || 'Unknown error'),
      );
    }
    console.error('Conversion error:', error);
    if (inputElement) inputElement.classList.remove('d-none');
  }
};

async function handleFile(): Promise<void> {
  const file = (this as HTMLInputElement).files?.[0];
  if (!file) return;

  const inputElement = document.getElementById('input');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const errorAlert = document.getElementById('error-alert');
  const filenameElement = document.getElementById('filename');

  // Check file extension before processing
  try {
    validateFileExtension(file.name);
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      showError(error.message);
      return;
    }
    throw error;
  }

  // Set filename immediately
  if (filenameElement) filenameElement.innerText = file.name;

  // Clear previous errors and hide results
  if (errorAlert) errorAlert.classList.add('d-none');
  if (resultsElement) resultsElement.classList.add('d-none');

  // Show loading spinner
  if (inputElement) inputElement.classList.add('d-none');
  if (loadingElement) loadingElement.classList.remove('d-none');

  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = (): void => {
    worker.postMessage({ input: reader.result });
  };
}



function showError(message: string): void {
  // Create or update error alert
  let errorElement = document.getElementById('error-alert');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = 'error-alert';
    errorElement.className = 'alert alert-danger alert-dismissible fade show';
    errorElement.innerHTML = `
      <span id="error-message"></span>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    const inputElement = document.getElementById('input');
    if (inputElement) {
      inputElement.insertBefore(errorElement, inputElement.firstChild);
    }
  }

  const messageElement = document.getElementById('error-message');
  messageElement.textContent = message;

  // Show the error element
  errorElement.classList.remove('d-none');
}

function showWarnings(warnings: string[]): void {
  // Remove any existing warning alerts
  const existingWarnings = document.getElementById('warning-alert');
  if (existingWarnings) {
    existingWarnings.remove();
  }

  // Create warning alert with proper ARIA attributes for accessibility
  const warningElement = document.createElement('div');
  warningElement.id = 'warning-alert';
  warningElement.className = 'alert alert-warning alert-dismissible fade show';
  warningElement.setAttribute('role', 'alert');
  warningElement.setAttribute('aria-live', 'polite');

  // Create a list of warnings for better semantic structure
  const warningList = document.createElement('ul');
  warningList.className = 'mb-0';
  warnings.forEach((warning) => {
    const listItem = document.createElement('li');
    listItem.textContent = warning;
    warningList.appendChild(listItem);
  });

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn-close';
  closeButton.setAttribute('data-bs-dismiss', 'alert');
  closeButton.setAttribute('aria-label', 'Close');

  warningElement.appendChild(warningList);
  warningElement.appendChild(closeButton);

  const resultsElement = document.getElementById('results');
  if (resultsElement) {
    resultsElement.insertBefore(warningElement, resultsElement.firstChild);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const inputElement = document.getElementById('file');
  inputElement.addEventListener('change', handleFile, false);

  const copyButton = document.getElementById('copy-button');
  if (copyButton !== null) {
    new ClipboardJS('#copy-button');
  }

  // Theme changes are handled automatically by CSS using prefers-color-scheme media query.
  // If manual theme switching is needed in the future, add a MediaQuery listener here.
});
