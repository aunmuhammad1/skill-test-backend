const express = require('express');

const app = express();


// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'This is CORS-enabled for specific domains.' });
});


// Start the server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
