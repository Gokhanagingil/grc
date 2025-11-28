import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JOB_ID = process.argv[2];

async function replayDLQ() {
  if (!JOB_ID) {
    console.error('Usage: ts-node queue-dlq-replay.ts <job-id>');
    process.exit(1);
  }

  const redis = new Redis(REDIS_URL);
  const dlq = new Queue('events.dlq', { connection: redis });
  const rawQueue = new Queue('events.raw', { connection: redis });

  try {
    const job = await dlq.getJob(JOB_ID);
    
    if (!job) {
      console.error(`Job ${JOB_ID} not found in DLQ`);
      process.exit(1);
    }

    console.log(`Replaying job ${JOB_ID} to events.raw queue...`);

    // Move job back to raw queue
    await rawQueue.add('process-raw', job.data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
    });

    // Remove from DLQ
    await job.remove();

    console.log('✅ Job replayed successfully');

    await dlq.close();
    await rawQueue.close();
    await redis.quit();
  } catch (error) {
    console.error('Failed to replay DLQ job:', error);
    process.exit(1);
  }
}

replayDLQ();

