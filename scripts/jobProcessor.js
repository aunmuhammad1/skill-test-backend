import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import moment from 'moment-timezone'; // Import moment-timezone

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

// Create a queue with the Redis connection
const queue = new Queue('deal-updates', { connection: redisConnection });

// Set up SQLite3 connection
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the SQLite database:', err.message);
  }
});


// Function to check the database and add jobs to the queue
const checkAndAddJobs = async () => {
  try {
    const now = new Date();
    const nowISOString = now.toISOString();

    // Fetch deals that need to be activated
    db.all(`
      SELECT * FROM DealsProduct
      WHERE status = 'inactive' AND start_time <= ? AND end_time >= ?
    `, [nowISOString, nowISOString], async (err, rows) => {
      if (err) {
        console.error('Error fetching deals for activation:', err.message);
        return;
      }

      // Add each deal to the queue
      for (const row of rows) {
        try {
          // Convert current time to the user's time zone
          const userTimeZone = row.timezone || 'UTC'; // Default to UTC if no timezone is provided
          const userStartTime = moment.tz(row.start_time, userTimeZone).toDate();
          const userEndTime = moment.tz(row.end_time, userTimeZone).toDate();

          await queue.add('deal-updates', {
            id: row.id,
            deals_id: row.deals_id,
            product_id: row.product_id,
            product_variant_id: row.product_variant_id,
            deal_selling_price: row.deal_selling_price,
            quantity: row.quantity,
            start_time: userStartTime.toISOString(),
            end_time: userEndTime.toISOString(),
            status: row.status,
            timezone: row.timezone,
            action: 'activate' // Add action type for clarity
          });
        } catch (err) {
          console.error('Error adding activation job to the queue:', err.message);
        }
      }
    });

    // Fetch deals that need to be deactivated
    db.all(`
      SELECT * FROM DealsProduct
      WHERE status = 'active' AND end_time < ?
    `, [nowISOString], async (err, rows) => {
      if (err) {
        console.error('Error fetching deals for deactivation:', err.message);
        return;
      }

      // Add each deal to the queue
      for (const row of rows) {
        try {
          // Convert current time to the user's time zone
          const userTimeZone = row.timezone || 'UTC'; // Default to UTC if no timezone is provided
          const userEndTime = moment.tz(row.end_time, userTimeZone).toDate();

          await queue.add('deal-updates', {
            id: row.id,
            deals_id: row.deals_id,
            product_id: row.product_id,
            product_variant_id: row.product_variant_id,
            deal_selling_price: row.deal_selling_price,
            quantity: row.quantity,
            start_time: row.start_time, // Use original times
            end_time: userEndTime.toISOString(),
            status: row.status,
            timezone: row.timezone,
            action: 'deactivate' // Add action type for clarity
          });
        } catch (err) {
          console.error('Error adding deactivation job to the queue:', err.message);
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
      });

      db.run(deactivateQuery, [nowISOString], function(err) {
        if (err) {
          console.error('Error deactivating deals:', err.message);
          db.run('ROLLBACK');
          reject(err);
          return;
        }
        db.run('COMMIT');
        resolve();
      });
    });
  });
};

// Create a worker with rate limiting
const worker = new Worker('deal-updates', async (job) => {
  try {
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

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

worker.on('error', (err) => {
  console.error('Worker encountered an error:', err.message);
});

// Set up a cron job to check and add jobs to the queue every minute
cron.schedule('* * * * *', () => {
  checkAndAddJobs();
});

