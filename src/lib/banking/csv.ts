import Papa from 'papaparse';

export interface AnalyzeResult {
  delimiter: string;
  headers: string[];
  sampleRows: any[];
}

export async function analyzeCsv(file: File, sampleSize = 25): Promise<AnalyzeResult> {
  return new Promise((resolve, reject) => {
    const sample: any[] = [];
    let headers: string[] = [];
    let delimiter = ',';
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      preview: sampleSize,
      worker: false, // Disabled to avoid function serialization issues
      beforeFirstChunk: (chunk) => {
        const firstLine = chunk.split(/\r?\n/)[0] || '';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes(';')) delimiter = ';';
        else delimiter = ',';
        return chunk;
      },
      complete: (res) => {
        // Manually trim headers since transformHeader cannot be used with workers
        headers = (res.meta.fields || []).map(h => h.trim());
        for (const row of res.data as any[]) sample.push(row);
        resolve({ delimiter, headers, sampleRows: sample });
      },
      error: (err) => reject(err),
    });
  });
}

export type RowCallback = (row: Record<string, any>, index: number) => void;

export async function streamRows(file: File, onRow: RowCallback): Promise<{ count: number }> {
  return new Promise((resolve, reject) => {
    let count = 0;
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      worker: false, // Disabled to avoid function serialization issues
      chunk: (chunk) => {
        const rows = chunk.data as any[];
        for (const row of rows) onRow(row, count++);
      },
      complete: () => resolve({ count }),
      error: (err) => reject(err),
    });
  });
}

/**
 * Parse all rows from CSV file for backend analysis
 * Returns complete dataset for totals computation
 */
export async function parseAllRows(file: File): Promise<{ headers: string[]; rows: any[] }> {
  return new Promise((resolve, reject) => {
    let headers: string[] = [];
    const allRows: any[] = [];

    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      worker: false, // Disabled to avoid function serialization issues
      complete: (res) => {
        // Manually trim headers since transformHeader cannot be used with workers
        headers = (res.meta.fields || []).map(h => h.trim());
        allRows.push(...(res.data as any[]));
        resolve({ headers, rows: allRows });
      },
      error: (err) => reject(err),
    });
  });
}