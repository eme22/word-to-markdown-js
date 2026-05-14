import './worker-polyfills';
import { convertWithWarnings } from './main.js';

import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';

self.onmessage = async (e: MessageEvent) => {
  const { input, options } = e.data;
  console.log('Worker received input, starting conversion...');
  
  try {
    const result = await convertWithWarnings(input, options);
    console.log('Conversion successful, rendering HTML...');

    const html = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(result.markdown);

    self.postMessage({ 
      type: 'success', 
      result, 
      html: String(html) 
    });
    console.log('Worker finished successfully.');
  } catch (error) {
    console.error('Worker error during conversion:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error && typeof error === 'object' && 'name' in error ? (error as { name: string }).name : 'Error';
    
    self.postMessage({ 
      type: 'error', 
      error: errorMessage,
      errorType: errorType
    });
  }
};
