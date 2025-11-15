const express = require('express');
const router = express.Router();
const db = require('../db');
const { cacheMiddleware, redis } = require('../redis');

// Get all rooms (cached)
router.get('/', cacheMiddleware(() => 'all_rooms'), async (req, res) => {
  const rooms = await db.query('SELECT * FROM rooms');
  res.json(rooms.rows);
});

// Get available rooms (cached)
router.get('/available', cacheMiddleware(() => 'available_rooms'), async (req, res) => {
  const rooms = await db.query("SELECT * FROM rooms WHERE status='Available'");
  res.json(rooms.rows);
});

// Create room (invalidate cache)
router.post('/', async (req, res) => {
  const { number, type_id, status, price } = req.body;
  const result = await db.query(
    'INSERT INTO rooms(number, type_id, status, price) VALUES($1,$2,$3,$4) RETURNING *',
    [number, type_id, status || 'Available', price]
  );
  await redis.del('all_rooms');
  await redis.del('available_rooms');
  res.json(result.rows[0]);
});

module.exports = router;
