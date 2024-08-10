// scheduleJob.js
const cron = require('node-cron');
const { queue } = require('./bullmq');

// Schedule the job to run every minute
cron.schedule('* * * * *', async () => {
  await queue.add('update-deals', {});
  console.log('Scheduled job to update deal statuses');
});

console.log('Cron job scheduled to run every minute');
