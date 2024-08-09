const express = require('express');
const cors = require('cors');

const app = express();


// Define allowed domains for CORS
const allowedDomains = ['https://127.0.0.1:3000', 'https://skills-test-frontend.vercel.app/'];

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedDomains.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'This is CORS-enabled for specific domains.' });
});


// Start the server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
