import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up SQLite3 connection
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the SQLite database:', err.message);
  }
});

// GET route to fetch active products with details and variants
router.get('/', (req, res) => {
  const query = `
    SELECT 
      p.id AS product_id,
      p.seller_id,
      p.brand_id,
      p.category_id,
      p.status AS product_status,
      pd.title,
      pd.description,
      pv.id AS product_variant_id,
      pv.selling_price,
      pv.msin,
      pv.sku,
      pv.status AS variant_status
    FROM Product p
    JOIN ProductDetails pd ON p.id = pd.product_id
    JOIN ProductVariant pv ON p.id = pv.product_id
    WHERE p.status = 'active'
      AND pv.status = 'active'
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching products', error: err.message });
    }
    res.json(rows);
  });
});

export default router;
