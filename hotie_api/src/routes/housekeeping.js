const express = require('express');
const router = express.Router();
const db = require('../db');
const { redis, cacheMiddleware } = require('../redis');

// Get all housekeeping records (cached)
router.get('/', cacheMiddleware(() => 'all_housekeeping'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT h.id, h.room_id, h.staff_id, h.status, h.date,
             r.number as room_number, u.name as staff_name
      FROM housekeeping h
      JOIN rooms r ON h.room_id = r.id
      JOIN users u ON h.staff_id = u.id
      ORDER BY h.date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch housekeeping records' });
  }
});

// Get housekeeping record by ID (cached)
router.get('/:id', cacheMiddleware((req) => `housekeeping_${req.params.id}`), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM housekeeping WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Housekeeping record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch housekeeping record' });
  }
});

// Create a new housekeeping record (invalidate caches)
router.post('/', async (req, res) => {
  try {
    const { room_id, staff_id, status } = req.body;
    if (!room_id || !staff_id || !status) {
      return res.status(400).json({ error: 'room_id, staff_id, and status are required' });
    }

    const result = await db.query(
      'INSERT INTO housekeeping(room_id, staff_id, status) VALUES($1,$2,$3) RETURNING *',
      [room_id, staff_id, status]
    );

    // Invalidate cache
    await redis.del('all_housekeeping');
    await redis.del(`housekeeping_${result.rows[0].id}`);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create housekeeping record' });
  }
});

// Update a housekeeping record (invalidate caches)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await db.query(
      'UPDATE housekeeping SET status=$1, date=NOW() WHERE id=$2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Housekeeping record not found' });
    }

    // Invalidate cache
    await redis.del('all_housekeeping');
    await redis.del(`housekeeping_${id}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update housekeeping record' });
  }
});

// Delete a housekeeping record (invalidate caches)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM housekeeping WHERE id=$1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Housekeeping record not found' });
    }

    // Invalidate cache
    await redis.del('all_housekeeping');
    await redis.del(`housekeeping_${id}`);

    res.json({ message: 'Housekeeping record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete housekeeping record' });
  }
});

module.exports = router;
