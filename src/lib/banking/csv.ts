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
      worker: true,
      transformHeader: (h) => h.trim(),
      beforeFirstChunk: (chunk) => {
        const firstLine = chunk.split(/\r?\n/)[0] || '';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes(';')) delimiter = ';';
        else delimiter = ',';
        return chunk;
      },
      complete: (res) => {
        headers = res.meta.fields || [];
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
      worker: true,
      transformHeader: (h) => h.trim(),
      chunk: (chunk) => {
        const rows = chunk.data as any[];
        for (const row of rows) onRow(row, count++);
      },
      complete: () => resolve({ count }),
      error: (err) => reject(err),
    });
  });
}