// bullmq.js
const { Queue, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');

// Set up Redis connection
const redis = new Redis({
  host: 'localhost', // Your Redis server host
  port: 6379         // Your Redis server port
});

// Set up BullMQ queue and scheduler
const queue = new Queue('deal-updates', { redis });
const scheduler = new QueueScheduler('deal-updates', { redis });

module.exports = { queue, scheduler };
