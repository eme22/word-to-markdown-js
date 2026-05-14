// Custom error class for unsupported file formats
export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

// Custom error class for file not found
export class FileNotFoundError extends Error {
  constructor(filePath?: string) {
    const location = filePath ? `: "${filePath}"` : '';
    super(
      `File not found${location}. Please check that the file exists and the path is correct.`,
    );
    this.name = 'FileNotFoundError';
  }
}

// Custom error class for invalid/corrupted files
export class InvalidFileError extends Error {
  constructor(filePath?: string) {
    const location = filePath ? `: "${filePath}"` : '';
    super(
      `Invalid file${location}. The file is not a valid .docx file or is corrupted. Please ensure the file is a valid Microsoft Word document (.docx format).`,
    );
    this.name = 'InvalidFileError';
  }
}

// Custom error class for permission errors
export class FilePermissionError extends Error {
  constructor(filePath?: string) {
    const location = filePath ? `: "${filePath}"` : '';
    super(
      `Permission denied${location}. Cannot read the file. Please check file permissions.`,
    );
    this.name = 'FilePermissionError';
  }
}

// Custom error class for general conversion errors
export class ConversionError extends Error {
  public cause?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'ConversionError';
    // Capture stack trace if available (Node.js/V8 specific)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ErrorWithCapture = Error as any;
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, this.constructor);
    }
    if (originalError) {
      // Use standard error chaining for better debugging tool support
      this.cause = originalError;
    }
  }
}
