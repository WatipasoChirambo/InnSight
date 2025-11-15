const express = require('express');
const router = express.Router();
const db = require('../db');
const { redis, cacheMiddleware } = require('../redis');

// Get all bookings (cached)
router.get('/', cacheMiddleware(() => 'all_bookings'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.id, b.guest_id, b.room_id, b.check_in, b.check_out, b.status,
             g.name as guest_name, r.number as room_number
      FROM bookings b
      JOIN guests g ON b.guest_id = g.id
      JOIN rooms r ON b.room_id = r.id
      ORDER BY b.check_in DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by ID (cached)
router.get('/:id', cacheMiddleware((req) => `booking_${req.params.id}`), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM bookings WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create a new booking (invalidate caches)
router.post('/', async (req, res) => {
  try {
    const { guest_id, room_id, check_in, check_out, status } = req.body;
    if (!guest_id || !room_id || !check_in || !check_out) {
      return res.status(400).json({ error: 'guest_id, room_id, check_in, and check_out are required' });
    }

    // Ensure room is available
    const roomStatus = await db.query('SELECT status FROM rooms WHERE id=$1', [room_id]);
    if (!roomStatus.rows[0] || roomStatus.rows[0].status !== 'Available') {
      return res.status(400).json({ error: 'Room is not available' });
    }

    const result = await db.query(
      'INSERT INTO bookings(guest_id, room_id, check_in, check_out, status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [guest_id, room_id, check_in, check_out, status || 'Reserved']
    );

    // Mark room as booked
    await db.query("UPDATE rooms SET status='Booked' WHERE id=$1", [room_id]);

    // Invalidate cache
    await redis.del('all_bookings');
    await redis.del(`booking_${result.rows[0].id}`);
    await redis.del('available_rooms');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update a booking (invalidate caches)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { guest_id, room_id, check_in, check_out, status } = req.body;

    const result = await db.query(
      'UPDATE bookings SET guest_id=$1, room_id=$2, check_in=$3, check_out=$4, status=$5 WHERE id=$6 RETURNING *',
      [guest_id, room_id, check_in, check_out, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update room status if necessary
    if (status === 'Checked-In') {
      await db.query("UPDATE rooms SET status='Occupied' WHERE id=$1", [room_id]);
    } else if (status === 'Checked-Out') {
      await db.query("UPDATE rooms SET status='Cleaning' WHERE id=$1", [room_id]);
    }

    // Invalidate cache
    await redis.del('all_bookings');
    await redis.del(`booking_${id}`);
    await redis.del('available_rooms');

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete a booking (invalidate caches)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await db.query('SELECT room_id FROM bookings WHERE id=$1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query('DELETE FROM bookings WHERE id=$1', [id]);

    // Set room back to Available
    await db.query("UPDATE rooms SET status='Available' WHERE id=$1", [booking.rows[0].room_id]);

    // Invalidate cache
    await redis.del('all_bookings');
    await redis.del(`booking_${id}`);
    await redis.del('available_rooms');

    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;
