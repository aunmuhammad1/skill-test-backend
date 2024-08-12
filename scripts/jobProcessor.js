import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname and __filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up Redis connection
const redisConnection = new IORedis({
  host: 'redis-17085.c12.us-east-1-4.ec2.redns.redis-cloud.com',
  port: 17085,
  password: 'N2ZXXwKCyqAqWPYC3nOyIbWfpnAnQjAX',
  maxRetriesPerRequest: null,
  reconnectOnError: (err) => {
    console.log('Redis connection error:', err.message);
    return true; // Reconnect on error
  }
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

console.log('Connected to Redis');

// Create a queue with the Redis connection
const queue = new Queue('deal-updates', { connection: redisConnection });

console.log('Queue created');

// Set up SQLite3 connection
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Function to check the database and add jobs to the queue
const checkAndAddJobs = async () => {
  try {
    const now = new Date().toISOString();

    // Fetch deals that need to be processed
    db.all(`
      SELECT * FROM DealsProduct
      WHERE status = 'inactive' AND start_time <= ? AND end_time >= ?
    `, [now, now], async (err, rows) => {
      if (err) {
        console.error('Error fetching deals:', err.message);
        return;
      }

      // Add each deal to the queue
      for (const row of rows) {
        try {
          await queue.add('deal-updates', {
            id: row.id,
            deals_id: row.deals_id,
            product_id: row.product_id,
            product_variant_id: row.product_variant_id,
            deal_selling_price: row.deal_selling_price,
            quantity: row.quantity,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status
          });
          console.log(`Added job for deal ${row.id} to the queue`);
        } catch (err) {
          console.error('Error adding job to the queue:', err.message);
        }
      }
    });
  } catch (err) {
    console.error('Error in checkAndAddJobs:', err.message);
  }
};

// Function to update deal statuses
const updateDealStatuses = () => {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const nowISOString = now.toISOString();

    console.log('Current Time:', nowISOString);

    // Use a transaction to ensure atomicity
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const activateQuery = `
        UPDATE DealsProduct
        SET status = 'active'
        WHERE status = 'inactive' AND start_time <= ? AND end_time >= ?
      `;

      const deactivateQuery = `
        UPDATE DealsProduct
        SET status = 'inactive'
        WHERE status = 'active' AND end_time < ?
      `;

      db.run(activateQuery, [nowISOString, nowISOString], function(err) {
        if (err) {
          console.error('Error activating deals:', err.message);
          db.run('ROLLBACK');
          reject(err);
          return;
        }
        console.log(`Activated ${this.changes} deals.`);
      });

      db.run(deactivateQuery, [nowISOString], function(err) {
        if (err) {
          console.error('Error deactivating deals:', err.message);
          db.run('ROLLBACK');
          reject(err);
          return;
        }
        console.log(`Deactivated ${this.changes} deals.`);
        db.run('COMMIT');
        resolve();
      });
    });
  });
};

// Create a worker with rate limiting
const worker = new Worker('deal-updates', async (job) => {
  console.log(`Worker received job ${job.id} with data ${JSON.stringify(job.data)}`);
  try {
    console.log('Updating deal statuses...');
    await updateDealStatuses();
  } catch (err) {
    console.error(`Error in job ${job.id}: ${err.message}`);
  }
}, {
  connection: redisConnection,
  limiter: {
    max: 10,
    duration: 1000
  }
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

worker.on('error', (err) => {
  console.error('Worker encountered an error:', err.message);
});

console.log('Worker created');

// Export the necessary components for use in other files if needed
export { redisConnection, queue, worker };

// Function to check queue status
const checkQueueStatus = async () => {
  try {
    const waitingCount = await queue.getWaitingCount();
    const activeCount = await queue.getActiveCount();
    const completedCount = await queue.getCompletedCount();
    const failedCount = await queue.getFailedCount();
    
    console.log(`Waiting jobs: ${waitingCount}`);
    console.log(`Active jobs: ${activeCount}`);
    console.log(`Completed jobs: ${completedCount}`);
    console.log(`Failed jobs: ${failedCount}`);
    
    const waitingJobs = await queue.getJobs(['waiting'], 0, 10);
    console.log('Waiting jobs:', waitingJobs.map(job => job.id));
    
    const activeJobs = await queue.getJobs(['active'], 0, 10);
    console.log('Active jobs:', activeJobs.map(job => job.id));
    
    const completedJobs = await queue.getJobs(['completed'], 0, 10);
    console.log('Completed jobs:', completedJobs.map(job => job.id));
    
    const failedJobs = await queue.getJobs(['failed'], 0, 10);
    console.log('Failed jobs:', failedJobs.map(job => job.id));
    
  } catch (err) {
    console.error('Error checking queue:', err.message);
  }
};

// Run queue status check every 30 seconds
setInterval(checkQueueStatus, 30000);

// Check and add jobs to the queue every minute
setInterval(checkAndAddJobs, 60000);