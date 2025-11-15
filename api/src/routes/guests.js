const express = require('express');
const router = express.Router();
const db = require('../db');
const { redis, cacheMiddleware } = require('../redis');

// Get all guests (cached)
router.get('/', cacheMiddleware(() => 'all_guests'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM guests ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// Get guest by ID (cached)
router.get('/:id', cacheMiddleware((req) => `guest_${req.params.id}`), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM guests WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch guest' });
  }
});

// Create a new guest (invalidate caches)
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, id_number } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    const result = await db.query(
      'INSERT INTO guests(name, phone, email, id_number) VALUES($1,$2,$3,$4) RETURNING *',
      [name, phone || null, email || null, id_number || null]
    );

    // Invalidate cache
    await redis.del('all_guests');
    await redis.del(`guest_${result.rows[0].id}`);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create guest' });
  }
});

// Update guest (invalidate caches)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, id_number } = req.body;

    const result = await db.query(
      'UPDATE guests SET name=$1, phone=$2, email=$3, id_number=$4 WHERE id=$5 RETURNING *',
      [name, phone, email, id_number, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Invalidate cache
    await redis.del('all_guests');
    await redis.del(`guest_${id}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

// Delete guest (invalidate caches)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM guests WHERE id=$1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Invalidate cache
    await redis.del('all_guests');
    await redis.del(`guest_${id}`);

    res.json({ message: 'Guest deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

module.exports = router;
