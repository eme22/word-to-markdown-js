import * as mammoth from 'mammoth';
import fs from 'fs/promises';
import { ConvertOptions, ConvertResult } from './types.js';
import {
  UnsupportedFileError,
  FileNotFoundError,
  InvalidFileError,
  FilePermissionError,
  ConversionError,
} from './errors.js';
import { validateFileExtension, validateFilePath } from './validators.js';
import { processHtml } from './html-processor.js';
import {
  htmlToMd,
  convertNumberedListsToBullets,
  normalizeText,
  lint,
  prettify,
} from './markdown-processor.js';
import {
  extractDocumentProperties,
  generateWarnings,
} from './document-properties.js';

// Converts a Word document to crisp, clean Markdown with warnings
export async function convertWithWarnings(
  input: string | ArrayBuffer,
  options: ConvertOptions = {},
): Promise<ConvertResult> {
  // Normalize input so that the underlying .docx content is read at most once
  let mammothInput:
    | { path: string }
    | { buffer: Buffer }
    | { arrayBuffer: ArrayBuffer };
  let propertiesInput: string | ArrayBuffer = input;

  if (typeof input === 'string') {
    // Validate file extension for file path inputs
    validateFileExtension(input);

    // Validate the file path to prevent path traversal attacks
    validateFilePath(input);

    // Read the file once and share the buffer between
    // property extraction and Mammoth conversion to avoid
    // redundant disk reads for large documents
    const fileBuffer = await fs.readFile(input);
    const slicedBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );

    // Ensure we have an ArrayBuffer (not SharedArrayBuffer) for property extraction
    let arrayBuffer: ArrayBuffer;
    if (slicedBuffer instanceof ArrayBuffer) {
      arrayBuffer = slicedBuffer;
    } else {
      // Convert SharedArrayBuffer to ArrayBuffer by copying the data
      const uint8Array = new Uint8Array(slicedBuffer);
      const newArrayBuffer = new ArrayBuffer(uint8Array.byteLength);
      new Uint8Array(newArrayBuffer).set(uint8Array);
      arrayBuffer = newArrayBuffer;
    }

    propertiesInput = arrayBuffer;
    mammothInput = { buffer: fileBuffer };
  } else {
    propertiesInput = input;
    // In Node.js, mammoth expects { buffer }, in browser it expects { arrayBuffer }
    // Check for Buffer availability to determine the environment
    if (typeof Buffer !== 'undefined') {
      mammothInput = { buffer: Buffer.from(input) };
    } else {
      mammothInput = { arrayBuffer: input };
    }
  }

  // Extract document properties to check for confidentiality flags
  const properties = await extractDocumentProperties(propertiesInput);
  const warnings = generateWarnings(properties);

  const mammothResult = await mammoth.convertToHtml(
    mammothInput,
    options.mammoth,
  );
  const processedHtml = processHtml(mammothResult.value);
  const md = htmlToMd(processedHtml, options.turndown);
  const mdWithBullets = convertNumberedListsToBullets(md);
  const normalizedMd = normalizeText(mdWithBullets);
  const cleanedMd = lint(normalizedMd);
  const formattedMd = await prettify(cleanedMd);

  return {
    markdown: formattedMd,
    warnings,
  };
}

// Converts a Word document to crisp, clean Markdown
export default async function convert(
  input: string | ArrayBuffer,
  options: ConvertOptions = {},
): Promise<string> {
  let inputObj: { path: string } | { arrayBuffer: ArrayBuffer };
  let filePath: string | undefined;

  try {
    if (typeof input === 'string') {
      filePath = input;
      // Validate file extension for file path inputs
      validateFileExtension(input);
      inputObj = { path: input };
    } else {
      inputObj = { arrayBuffer: input };
    }

    const mammothResult = await mammoth.convertToHtml(
      inputObj,
      options.mammoth,
    );
    const processedHtml = processHtml(mammothResult.value);
    const md = htmlToMd(processedHtml, options.turndown);
    const mdWithBullets = convertNumberedListsToBullets(md);
    const normalizedMd = normalizeText(mdWithBullets);
    const cleanedMd = lint(normalizedMd);
    const formattedMd = await prettify(cleanedMd);
    return formattedMd;
  } catch (error) {
    // Re-throw our custom errors as-is
    if (
      error instanceof UnsupportedFileError ||
      error instanceof FileNotFoundError ||
      error instanceof InvalidFileError ||
      error instanceof FilePermissionError ||
      error instanceof ConversionError
    ) {
      throw error;
    }

    // Handle specific error types from underlying libraries
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code: string }).code
        : undefined;

    // File not found errors (only occur with file path inputs)
    if (errorCode === 'ENOENT') {
      throw new FileNotFoundError(filePath);
    }

    // Permission errors (only occur with file path inputs)
    if (errorCode === 'EACCES' || errorCode === 'EPERM') {
      throw new FilePermissionError(filePath);
    }

    // Invalid .docx file errors (from JSZip or mammoth during file parsing)
    if (
      errorMessage.includes('end of central directory') ||
      errorMessage.includes('zip file') ||
      errorMessage.includes('Corrupted zip') ||
      errorMessage.includes('End of data reached') ||
      errorMessage.includes('Could not find file')
    ) {
      throw new InvalidFileError(filePath);
    }

    // Wrap other errors with a general conversion error
    throw new ConversionError(
      'An error occurred while converting the document. Please ensure the file is a valid .docx file and try again.',
      error instanceof Error ? error : undefined,
    );
  }
}
