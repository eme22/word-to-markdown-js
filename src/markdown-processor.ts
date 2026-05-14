import TurndownService from '@joplin/turndown';
import * as turndownPluginGfm from '@joplin/turndown-plugin-gfm';
import * as markdownlint from 'markdownlint/sync';
import { applyFixes } from 'markdownlint';
import * as prettier from 'prettier';
import * as prettierMarkdown from 'prettier/plugins/markdown';
import { decodeHtmlEntities } from './html-processor.js';

interface turndownOptions {
  headingStyle?: 'setext' | 'atx';
  codeBlockStyle?: 'indented' | 'fenced';
  bulletListMarker?: '*' | '-' | '+';
}

const defaultTurndownOptions: turndownOptions = {
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
};

// Reusable TurndownService instance to avoid recreating it for each conversion
let turndownServiceInstance: TurndownService | null = null;

export function getTurndownService(options: object = {}): TurndownService {
  // Create a new instance if options are provided, otherwise reuse the singleton
  if (Object.keys(options).length > 0) {
    const service = new TurndownService({
      ...options,
      ...defaultTurndownOptions,
    });
    service.use(turndownPluginGfm.gfm);
    return service;
  }

  if (!turndownServiceInstance) {
    turndownServiceInstance = new TurndownService(defaultTurndownOptions);
    turndownServiceInstance.use(turndownPluginGfm.gfm);
  }
  return turndownServiceInstance;
}

// Convert HTML to GitHub-flavored Markdown
export function htmlToMd(html: string, options: object = {}): string {
  // Decode HTML entities before conversion
  const decodedHtml = decodeHtmlEntities(html);

  const turndownService = getTurndownService(options);
  return turndownService.turndown(decodedHtml).trim();
}

// Pre-compiled regex patterns for better performance
const numberedListRegex = /^(\s*)(\d+)\.\s/gm;
const nonBreakingSpacesRegex = /[\u00A0\u2007\u202F\u2060\uFEFF]/g;
const smartQuotesRegex = /[\u201C\u201D\u2018\u2019\u2013\u2014]/g;

// Map for non-breaking space replacements
const nonBreakingSpaceMap: { [key: string]: string } = {
  '\u00A0': ' ', // Non-breaking space
  '\u2007': ' ', // Figure space
  '\u202F': ' ', // Narrow no-break space
  '\u2060': '', // Word joiner (zero-width non-breaking space)
  '\uFEFF': '', // Zero-width no-break space (BOM)
};

// Map for smart quote replacements
const smartQuoteMap: { [key: string]: string } = {
  '\u201C': '"', // Left double quotation mark
  '\u201D': '"', // Right double quotation mark
  '\u2018': "'", // Left single quotation mark
  '\u2019': "'", // Right single quotation mark
  '\u2013': '-', // En dash
  '\u2014': '-', // Em dash
};

// Convert numbered lists to bullet lists
export function convertNumberedListsToBullets(md: string): string {
  // Replace numbered list items with bullet list items
  // This regex matches lines that start with optional whitespace, a number, a dot, and a space
  return md.replace(numberedListRegex, '$1- ');
}

// Remove unicode non-breaking spaces and convert smart quotes to ASCII in a single pass
export function normalizeText(md: string): string {
  return md
    .replace(nonBreakingSpacesRegex, (char) => nonBreakingSpaceMap[char])
    .replace(smartQuotesRegex, (char) => smartQuoteMap[char]);
}

// Lint the Markdown and correct any issues
export function lint(md: string): string {
  const lintResult = markdownlint.lint({ strings: { md } });
  return applyFixes(md, lintResult['md']).trim();
}

// Format the Markdown with Prettier
export async function prettify(md: string): Promise<string> {
  const formatted = await prettier.format(md, {
    parser: 'markdown',
    plugins: [prettierMarkdown],
  });
  return formatted.trim();
}
