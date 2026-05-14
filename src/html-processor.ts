// Map of common HTML entities to decode
const decodeMap: { [key: string]: string } = {
  '&amp;': '&',
  // Don't decode &lt; and &gt; in our custom decoder
  // Let Turndown handle them appropriately based on context
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
};

// Maximum iterations for decoding nested HTML entities to prevent infinite loops
const MAX_DECODE_ITERATIONS = 10;

// Decode HTML entities in text content
export function decodeHtmlEntities(html: string): string {
  function decodeOnce(text: string): string {
    // Use a more specific regex pattern to avoid catastrophic backtracking
    // Match: & followed by either:
    //   - a-zA-Z letters (for named entities like &amp;, &nbsp;, etc.)
    //   - # followed by digits (for numeric entities like &#169;)
    //   - #[xX] followed by hex digits (for hex entities like &#x27; or &#X27;)
    // All terminated with a semicolon
    return text.replace(/&(?:[a-zA-Z]+|#\d+|#[xX][0-9a-fA-F]+);/g, (entity) => {
      // Handle named entities
      if (decodeMap[entity]) {
        return decodeMap[entity];
      }

      // Handle numeric entities &#123;
      const numericMatch = entity.match(/^&#(\d+);$/);
      if (numericMatch) {
        return String.fromCharCode(parseInt(numericMatch[1], 10));
      }

      // Handle hex entities &#x1A;
      const hexMatch = entity.match(/^&#x([0-9a-fA-F]+);$/i);
      if (hexMatch) {
        return String.fromCharCode(parseInt(hexMatch[1], 16));
      }

      // Return original if not recognized
      return entity;
    });
  }

  // Keep decoding until no more entities are found (handles double/triple encoding)
  let decoded = html;
  let prevDecoded;
  let iterations = 0;
  do {
    prevDecoded = decoded;
    decoded = decodeOnce(decoded);
    iterations++;
  } while (
    decoded !== prevDecoded &&
    decoded.includes('&') &&
    iterations < MAX_DECODE_ITERATIONS
  );

  return decoded;
}

export function processHtml(html: string): string {
  // Use regex for processing to avoid building a full DOM tree,
  // which can cause stack overflow in Web Workers with large/complex documents.

  // 1. Process lists - remove unicode bullets from unnumbered list items
  // Pre-compile bullet regex for performance
  const bullets = ['•', '◦', '▪', '▫', '‣', '⁃', '∙', '·'];
  const bulletPattern = `[${bullets.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}]`;
  const listBulletRegex = new RegExp(`(<li>)\\s*${bulletPattern}\\s*`, 'g');

  let processedHtml = html.replace(listBulletRegex, '$1');

  // 2. Process tables - convert first row TD elements to TH
  // This regex finds the first <tr> in each <table> and captures its contents
  // We use a non-greedy match to find the first <tr>...</tr> block
  processedHtml = processedHtml.replace(
    /(<table[^>]*>\s*)(<tr>)([\s\S]*?)(<\/tr>)/gi,
    (match, tableOpen, trOpen, trContent, trClose) => {
      // If the first row already has <th>, skip it
      if (trContent.toLowerCase().includes('<th')) {
        return match;
      }

      // Check if the first row is effectively empty (only whitespace/empty tags)
      const isContentEmpty = !trContent.replace(/<[^>]+>/g, '').trim();

      if (isContentEmpty) {
        // Remove the empty first row by returning just the table opening
        // The next <tr> will be handled by the next match or left as is
        return tableOpen;
      }

      // Convert all <td> in this first row to <th>
      const convertedContent = trContent.replace(
        /<td([^>]*)>([\s\S]*?)<\/td>/gi,
        '<th$1>$2</th>',
      );
      return tableOpen + trOpen + convertedContent + trClose;
    },
  );

  return processedHtml;
}
