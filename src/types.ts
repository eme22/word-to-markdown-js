export interface ConvertOptions {
  mammoth?: object;
  turndown?: object;
}

export interface ConvertResult {
  markdown: string;
  warnings: string[];
}

export interface DocumentProperties {
  sensitivity?: string;
  confidentiality?: string;
  encryption?: boolean;
  protection?: boolean;
}
