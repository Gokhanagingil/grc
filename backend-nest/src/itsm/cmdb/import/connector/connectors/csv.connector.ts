import {
  Connector,
  ConnectorType,
  ConnectorConfig,
  ConnectorResult,
} from '../connector.types';

export class CsvConnector implements Connector {
  type = ConnectorType.CSV;

  fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const raw = (config.body as string) || '';
    const delimiter = config.csvDelimiter || ',';
    const hasHeader = config.csvHasHeader !== false;

    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return Promise.resolve({
        rows: [],
        metadata: {
          totalFetched: 0,
          fetchedAt: new Date().toISOString(),
          source: 'csv',
        },
      });
    }

    let headers: string[];
    let dataStart: number;

    if (hasHeader) {
      headers = this.parseLine(lines[0], delimiter);
      dataStart = 1;
    } else {
      const colCount = this.parseLine(lines[0], delimiter).length;
      headers = Array.from({ length: colCount }, (_, i) => `col_${i}`);
      dataStart = 0;
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = dataStart; i < lines.length; i++) {
      const values = this.parseLine(lines[i], delimiter);
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? null;
      }
      rows.push(row);
    }

    return Promise.resolve({
      rows,
      metadata: {
        totalFetched: rows.length,
        fetchedAt: new Date().toISOString(),
        source: 'csv',
      },
    });
  }

  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }
}
