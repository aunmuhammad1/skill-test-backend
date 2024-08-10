// jobProcessor.js
const { Worker } = require('bullmq');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { queue } = require('./bullmq');

// Set up SQLite3 connection
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Function to update deal statuses
const updateDealStatuses = () => {
  const now = new Date();
  const nowISOString = now.toISOString();

  console.log('Current Time:', nowISOString);

  const activateQuery = `
    UPDATE DealProducts
    SET status = 'active'
    WHERE status = 'inactive' AND start_time <= ? AND end_time >= ?
  `;

  const deactivateQuery = `
    UPDATE DealProducts
    SET status = 'inactive'
    WHERE status = 'active' AND end_time < ?
  `;

  db.run(activateQuery, [nowISOString, nowISOString], function(err) {
    if (err) {
      console.error('Error activating deals:', err.message);
    } else {
      console.log(`Activated ${this.changes} deals.`);
    }
  });

  db.run(deactivateQuery, [nowISOString], function(err) {
    if (err) {
      console.error('Error deactivating deals:', err.message);
    } else {
      console.log(`Deactivated ${this.changes} deals.`);
    }
  });
};

// Set up BullMQ worker to process jobs
const worker = new Worker('deal-updates', async job => {
  await updateDealStatuses();
}, {
  redis: { host: 'localhost', port: 6379 }
});

worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

console.log('Job processor started');
