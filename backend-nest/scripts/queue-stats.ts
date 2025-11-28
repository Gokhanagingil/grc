import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function getQueueStats() {
  const redis = new Redis(REDIS_URL);

  const queues = ['events.raw', 'events.normalize', 'events.incident', 'events.dlq'];
  const stats: Record<string, any> = {};

  for (const queueName of queues) {
    const queue = new Queue(queueName, { connection: redis });
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    stats[queueName] = {
      waiting,
      active,
      completed,
      failed,
      delayed,
      lag: waiting + active + delayed,
    };

    await queue.close();
  }

  await redis.quit();

  console.log('\n=== Queue Statistics ===\n');
  for (const [name, stat] of Object.entries(stats)) {
    console.log(`${name}:`);
    console.log(`  Waiting: ${stat.waiting}`);
    console.log(`  Active: ${stat.active}`);
    console.log(`  Completed: ${stat.completed}`);
    console.log(`  Failed: ${stat.failed}`);
    console.log(`  Delayed: ${stat.delayed}`);
    console.log(`  Total Lag: ${stat.lag}`);
    console.log('');
  }

  // Save to reports
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'queue-stats.json');
  const report = {
    timestamp: new Date().toISOString(),
    queues: stats,
  };

  fs.appendFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`✅ Stats appended to ${reportPath}`);
}

getQueueStats().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

