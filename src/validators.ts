import path from 'path';
import { UnsupportedFileError } from './errors.js';

// Check if a file path has a .doc extension (unsupported format)
export function validateFileExtension(filePath: string): void {
  // Use manual extension parsing (works in both Node.js and browser)
  const filename = filePath.toLowerCase();
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';

  if (ext === '.doc') {
    throw new UnsupportedFileError(
      'This tool only supports .docx files, not .doc files. Please save your document as a .docx file and try again.',
    );
  }
}

// Validates that a file path is safe to use (Node.js only)
// Prevents path traversal attacks by checking for parent directory references
export function validateFilePath(filePath: string): void {
  // Check for path traversal attempts
  if (filePath.includes('..')) {
    throw new Error('Invalid file path: path traversal not allowed');
  }

  // Resolve to absolute path to check for traversal
  // Note: This uses the path module which is Node.js-only, but this function
  // is only called in Node.js contexts (CLI, server, direct API use with file paths)
  const resolvedPath = path.resolve(filePath);

  // Check for absolute paths to dangerous system directories (Unix-like systems)
  const dangerousPaths = ['/etc/', '/sys/', '/proc/', '/root/', '/boot/'];
  for (const dangerousPath of dangerousPaths) {
    if (resolvedPath.startsWith(dangerousPath)) {
      throw new Error(
        'Invalid file path: access to system directories not allowed',
      );
    }
  }

  // Check for Windows system directories
  const windowsDangerousPaths = ['C:\\Windows\\', 'C:\\Program Files\\'];
  for (const dangerousPath of windowsDangerousPaths) {
    if (resolvedPath.toUpperCase().startsWith(dangerousPath.toUpperCase())) {
      throw new Error(
        'Invalid file path: access to system directories not allowed',
      );
    }
  }
}
