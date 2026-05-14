import JSZip from 'jszip';
import fs from 'fs/promises';
import { DocumentProperties } from './types.js';
import { validateFilePath } from './validators.js';

// Extract document properties from a .docx file
export async function extractDocumentProperties(
  input: string | ArrayBuffer,
): Promise<DocumentProperties> {
  const properties: DocumentProperties = {};

  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof input === 'string') {
      // Validate the file path to prevent path traversal attacks
      validateFilePath(input);

      // Read file from path and convert to ArrayBuffer
      const fileBuffer = await fs.readFile(input);
      const slicedBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );
      // Ensure we have an ArrayBuffer (not SharedArrayBuffer)
      // In practice, Node.js Buffer.buffer returns an ArrayBuffer, but TypeScript
      // can't guarantee this, so we handle both cases
      if (slicedBuffer instanceof ArrayBuffer) {
        arrayBuffer = slicedBuffer;
      } else {
        // Convert SharedArrayBuffer to ArrayBuffer by copying the data
        const uint8Array = new Uint8Array(slicedBuffer);
        const newArrayBuffer = new ArrayBuffer(uint8Array.byteLength);
        new Uint8Array(newArrayBuffer).set(uint8Array);
        arrayBuffer = newArrayBuffer;
      }
    } else {
      arrayBuffer = input;
    }

    const zip = await JSZip.loadAsync(arrayBuffer);

    // Check for encryption - encrypted files have EncryptionInfo and EncryptedPackage
    const encryptionInfo = zip.file('EncryptionInfo');
    if (encryptionInfo) {
      properties.encryption = true;
    }

    // Try to read core properties
    const corePropsFile = zip.file('docProps/core.xml');
    if (corePropsFile) {
      const coreXml = await corePropsFile.async('string');
      // Look for keywords that might indicate sensitivity/confidentiality
      if (
        coreXml.toLowerCase().includes('confidential') ||
        coreXml.toLowerCase().includes('sensitive')
      ) {
        properties.confidentiality = 'detected in core properties';
      }
    }

    // Try to read custom properties
    const customPropsFile = zip.file('docProps/custom.xml');
    if (customPropsFile) {
      const customXml = await customPropsFile.async('string');
      const customXmlLower = customXml.toLowerCase();

      // Use regex patterns to detect sensitivity/confidentiality properties
      // We use regex instead of full XML parsing for performance and simplicity,
      // as we only need to detect the presence of specific property names, not extract values

      // Pattern matches common sensitivity/confidentiality property names:
      // - "Sensitivity" (standard Office property)
      // - "MSIP_Label_*" (Microsoft Information Protection labels)
      // - Any property with "confidential" or "sensitive" in the name
      // We only check for the property name attribute existence, not the full element content,
      // to avoid potential catastrophic backtracking on large/malformed XML
      const sensitivityPattern =
        /<property[^>]*\bname="(?:Sensitivity|MSIP_Label_[^"]*|[^"]*(?:confidential|sensitive)[^"]*)"[^>]*>/gi;

      const hasSensitivityProperty = sensitivityPattern.test(customXml);
      const hasConfidentialText = customXmlLower.includes('confidential');
      const hasMSIPLabel = customXmlLower.includes('msip_label');

      if (hasSensitivityProperty || hasMSIPLabel) {
        properties.sensitivity = 'detected in custom properties';
      }

      if (hasConfidentialText) {
        properties.confidentiality = 'detected in custom properties';
      }
    }

    // Check for document protection
    const settingsFile = zip.file('word/settings.xml');
    if (settingsFile) {
      const settingsXml = await settingsFile.async('string');
      if (
        settingsXml.includes('<w:documentProtection') ||
        settingsXml.includes('<w:writeProtection')
      ) {
        properties.protection = true;
      }
    }
  } catch (error) {
    // If we can't extract properties, just continue without them
    // This might happen with encrypted, corrupted, or non-standard .docx files
    // We log the error in development mode but don't fail the conversion
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to extract document properties:', error);
    }
  }

  return properties;
}

// Generate warnings based on document properties
export function generateWarnings(properties: DocumentProperties): string[] {
  const warnings: string[] = [];

  if (properties.encryption) {
    warnings.push(
      'Warning: This document appears to be encrypted. Conversion may not include all content or may fail entirely.',
    );
  }

  if (properties.sensitivity) {
    warnings.push(
      `Warning: This document has sensitivity labels (${properties.sensitivity}). Please ensure you have permission to convert and share this content.`,
    );
  }

  if (properties.confidentiality) {
    warnings.push(
      `Warning: This document contains confidentiality markers (${properties.confidentiality}). Please verify that conversion is authorized.`,
    );
  }

  if (properties.protection) {
    warnings.push(
      'Warning: This document has editing restrictions enabled. Some content may not convert properly.',
    );
  }

  return warnings;
}
