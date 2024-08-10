const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

  // Update status to 'active' for deals starting now or before
  const activateQuery = `
    UPDATE DealsProduct
    SET status = 'active'
    WHERE status = 'inactive' AND start_time <= ? AND end_time >= ?
  `;

  // Update status to 'inactive' for deals ending before now
  const deactivateQuery = `
    UPDATE DealsProduct
    SET status = 'inactive'
    WHERE status = 'active' AND end_time < ?
  `;

  // Run activation query
  db.run(activateQuery, [nowISOString, nowISOString], function(err) {
    if (err) {
      console.error('Error activating deals:', err.message);
    } else {
      console.log(`Activated ${this.changes} deals.`);
    }
  });

  // Run deactivation query
  db.run(deactivateQuery, [nowISOString], function(err) {
    if (err) {
      console.error('Error deactivating deals:', err.message);
    } else {
      console.log(`Deactivated ${this.changes} deals.`);
    }
  });
};

// Schedule the cron job to run every minute
cron.schedule('* * * * *', updateDealStatuses);

console.log('Cron job scheduled to run every minute');
