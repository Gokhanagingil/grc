import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function peekDLQ() {
  const redis = new Redis(REDIS_URL);
  const dlq = new Queue('events.dlq', { connection: redis });

  try {
    const waiting = await dlq.getWaiting();
    const failed = await dlq.getFailed();

    console.log('\n=== DLQ Peek ===\n');
    console.log(`Waiting: ${waiting.length}`);
    console.log(`Failed: ${failed.length}`);

    if (waiting.length > 0) {
      console.log('\nWaiting Jobs (first 5):');
      waiting.slice(0, 5).forEach((job, idx) => {
        console.log(`  ${idx + 1}. Job ${job.id}`);
        console.log(`     Data: ${JSON.stringify(job.data).substring(0, 100)}...`);
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed Jobs (first 5):');
      failed.slice(0, 5).forEach((job, idx) => {
        console.log(`  ${idx + 1}. Job ${job.id}`);
        console.log(`     Error: ${job.failedReason?.substring(0, 100)}...`);
        console.log(`     Data: ${JSON.stringify(job.data).substring(0, 100)}...`);
      });
    }

    await dlq.close();
    await redis.quit();
  } catch (error) {
    console.error('Failed to peek DLQ:', error);
    process.exit(1);
  }
}

peekDLQ();

