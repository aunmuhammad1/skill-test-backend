import express from 'express';
const app = express();
import cors from 'cors';
import productsRoutes from './routes/products.js';
import dealsRoutes from './routes/deals.js'; // Use default import

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
