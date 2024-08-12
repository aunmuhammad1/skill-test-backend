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

// POST route to handle deal submissions
router.post('/', async (req, res) => {
  const dealData = req.body;

  const insertDeals = (deal) => {
    return new Promise((resolve, reject) => {
      const { title, productId, product_variantId, sellingPrice, quantity, timeRange, timezone } = deal;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION'); // Start transaction

        // Insert into Deals Table
        const dealQuery = 'INSERT INTO Deals (title, status) VALUES (?, ?)';
        db.run(dealQuery, [title, 'active'], function(err) {
          if (err) {
            console.error('Error inserting deal:', err.message);
            return db.run('ROLLBACK', () => reject(err));
          }
          const dealId = this.lastID;

          // Insert into DealsProduct Table
          const dealProductQuery = 'INSERT INTO DealsProduct (deals_id, product_id, product_variant_id, deal_selling_price, quantity, start_time, end_time, status, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
          db.run(dealProductQuery, [dealId, productId, product_variantId, sellingPrice, quantity, timeRange[0], timeRange[1], 'inactive', timezone], function(err) {
            if (err) {
              console.error('Error inserting deal product:', err.message);
              return db.run('ROLLBACK', () => reject(err));
            }
            db.run('COMMIT', () => resolve());
          });
        });
      });
    });
  };

  try {
    // Process each deal item
    for (const deal of dealData) {
      await insertDeals(deal);
    }
    res.status(200).json({ message: 'Deals submitted successfully' });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET route to fetch deals with product and variant details
router.get('/', (req, res) => {
  const query = `
    SELECT 
      d.id AS deal_id,
      d.title AS deal_title,
      dp.product_id,
      dp.product_variant_id,
      dp.deal_selling_price,
      dp.quantity,
      dp.start_time,
      dp.end_time,
      pd.title AS product_title,
      pv.selling_price AS variant_selling_price,
      pv.msin AS variant_msin,
      pv.sku AS variant_sku
    FROM Deals d
    JOIN DealsProduct dp ON d.id = dp.deals_id
    JOIN Product p ON dp.product_id = p.id
    JOIN ProductDetails pd ON p.id = pd.product_id
    JOIN ProductVariant pv ON dp.product_variant_id = pv.id
    WHERE d.status = 'active' AND dp.status = 'active'
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

export default router;
