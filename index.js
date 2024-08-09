const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();


// Connect to the SQLite database
const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'), sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});


// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'hello world' });
});


// Start the server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
