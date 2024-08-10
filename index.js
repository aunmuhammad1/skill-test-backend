const express = require('express');
const app = express();
const cors = require('cors');
const productsRoutes = require('./routes/products');
const dealsRoutes = require('./routes/deals');

app.use(cors()); // Add this line to enable CORS


// Middleware to parse JSON bodies
app.use(express.json());

app.use('/api/deals', dealsRoutes);


app.use('/api/products', productsRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'hello world' });
});


// Start the server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
