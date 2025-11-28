import axios from 'axios';
import * as readline from 'readline';

const API_URL = process.env.API_URL || 'http://localhost:5002/api/v2';
const INGEST_TOKEN = process.env.INGEST_TOKEN || 'change-me';

interface GenerateOptions {
  count: number;
  bulk: number;
  source: string;
}

async function generateEvents(options: GenerateOptions) {
  const { count, bulk, source } = options;
  const batches = Math.ceil(count / bulk);

  console.log(`Generating ${count} events from source "${source}" in ${batches} batches of ${bulk}`);

  let totalSent = 0;
  let errors = 0;

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(bulk, count - totalSent);
    const items = Array.from({ length: batchSize }, (_, i) => ({
      payload: generatePayload(source, totalSent + i),
      tenantId: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
    }));

    try {
      const response = await axios.post(
        `${API_URL}/events/ingest/bulk`,
        { source, items },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-ingest-token': INGEST_TOKEN,
            'x-tenant-id': '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
          },
        },
      );

      totalSent += batchSize;
      process.stdout.write(`\rBatch ${batch + 1}/${batches}: ${totalSent}/${count} events sent`);
    } catch (error: any) {
      errors++;
      console.error(`\nError in batch ${batch + 1}:`, error.message);
    }
  }

  console.log(`\n\n✅ Total sent: ${totalSent}`);
  console.log(`❌ Errors: ${errors}`);
}

function generatePayload(source: string, index: number): Record<string, any> {
  const base = {
    timestamp: Math.floor(Date.now() / 1000) - index,
  };

  switch (source) {
    case 'prometheus':
      return {
        ...base,
        metric: `cpu_usage_${index % 5}`,
        value: Math.random() * 100,
        instance: `host-${index % 10}`,
        severity: Math.random() > 0.7 ? 'critical' : 'warning',
        category: ['cpu', 'memory', 'disk'][index % 3],
      };

    case 'zabbix':
      return {
        ...base,
        host: `host-${index % 10}`,
        key: `system.cpu.util`,
        value: Math.random() * 100,
        severity: Math.random() > 0.8 ? 'major' : 'minor',
        category: 'cpu',
      };

    default:
      return {
        ...base,
        message: `Test event ${index}`,
        severity: ['info', 'warning', 'minor', 'major', 'critical'][index % 5],
        category: ['system', 'application', 'network'][index % 3],
        resource: `resource-${index % 20}`,
      };
  }
}

// CLI argument parsing
const args = process.argv.slice(2);
const options: GenerateOptions = {
  count: 100000,
  bulk: 1000,
  source: 'custom',
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) {
    options.count = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--bulk' && args[i + 1]) {
    options.bulk = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--source' && args[i + 1]) {
    options.source = args[i + 1];
  }
}

generateEvents(options).catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

