const express = require('express');
const router = express.Router();
const db = require('../db');
const { redis, cacheMiddleware } = require('../redis');

// Get all payments (cached)
router.get('/', cacheMiddleware(() => 'all_payments'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.booking_id, p.amount, p.method, p.paid_at,
             g.name as guest_name, r.number as room_number
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN guests g ON b.guest_id = g.id
      JOIN rooms r ON b.room_id = r.id
      ORDER BY p.paid_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment by ID (cached)
router.get('/:id', cacheMiddleware((req) => `payment_${req.params.id}`), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Create a new payment (invalidate caches)
router.post('/', async (req, res) => {
  try {
    const { booking_id, amount, method } = req.body;
    if (!booking_id || !amount || !method) {
      return res.status(400).json({ error: 'booking_id, amount, and method are required' });
    }

    const result = await db.query(
      'INSERT INTO payments(booking_id, amount, method) VALUES($1,$2,$3) RETURNING *',
      [booking_id, amount, method]
    );

    // Invalidate cache
    await redis.del('all_payments');
    await redis.del(`payment_${result.rows[0].id}`);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Update a payment (invalidate caches)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method } = req.body;

    const result = await db.query(
      'UPDATE payments SET amount=$1, method=$2 WHERE id=$3 RETURNING *',
      [amount, method, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Invalidate cache
    await redis.del('all_payments');
    await redis.del(`payment_${id}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Delete a payment (invalidate caches)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM payments WHERE id=$1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Invalidate cache
    await redis.del('all_payments');
    await redis.del(`payment_${id}`);

    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

module.exports = router;
