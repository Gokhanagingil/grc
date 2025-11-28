import autocannon from 'autocannon';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:5002';
// Use /ping endpoint instead of /health for rate limiting test
const ENDPOINT = process.env.ENDPOINT || '/api/v2/ping';
const DURATION = parseInt(process.env.DURATION || '2', 10); // seconds
const RPS = parseInt(process.env.RPS || '50', 10);

async function runRateTest() {
  console.log(`Testing rate limiting on ${API_URL}${ENDPOINT}`);
  console.log(`Duration: ${DURATION}s, Target RPS: ${RPS}`);

  const instance = autocannon({
    url: `${API_URL}${ENDPOINT}`,
    connections: 10,
    duration: DURATION,
    pipelining: 1,
    requests: [
      {
        method: 'GET',
        path: ENDPOINT,
      },
    ],
  });

  const results = await instance;
  
  // Extract status code counts
  const statusCounts: Record<string, number> = {};
  if (results.statusCodeStats) {
    Object.keys(results.statusCodeStats).forEach((code) => {
      statusCounts[code] = (results.statusCodeStats as any)[code] || 0;
    });
  }
  
  const rateLimitCount = statusCounts['429'] || 0;
  const status2xx = (statusCounts['200'] || 0) + (statusCounts['201'] || 0) + (statusCounts['202'] || 0);
  const totalRequests = results.requests.total || 0;
  const rateLimitPercentage = totalRequests > 0 ? (rateLimitCount / totalRequests) * 100 : 0;

  console.log('\n=== Rate Limit Test Results ===');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful (2xx): ${status2xx}`);
  console.log(`Rate Limited (429): ${rateLimitCount}`);
  console.log(`Rate Limit %: ${rateLimitPercentage.toFixed(2)}%`);
  console.log(`Average Latency: ${results.latency.average}ms`);
  console.log(`P95 Latency: ${results.latency.p95}ms`);
  console.log(`P99 Latency: ${results.latency.p99}ms`);

  const report = {
    endpoint: `${API_URL}${ENDPOINT}`,
    duration: DURATION,
    targetRPS: RPS,
    totalRequests,
    rateLimitCount,
    rateLimitPercentage: parseFloat(rateLimitPercentage.toFixed(2)),
    status2xx,
    status429: rateLimitCount,
    latency: {
      average: results.latency.average,
      p95: results.latency.p95,
      p99: results.latency.p99,
    },
    requests: {
      total: results.requests.total,
      average: results.requests.average,
    },
    timestamp: new Date().toISOString(),
  };

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'rate-limit.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to ${reportPath}`);

  if (rateLimitCount > 0 || rateLimitPercentage >= 10) {
    console.log('✅ Rate limiting is working');
  } else {
    console.log('⚠️  No rate limiting detected (may need adjustment)');
  }
}

runRateTest().catch((err) => {
  console.error('Rate test failed:', err);
  process.exit(1);
});
