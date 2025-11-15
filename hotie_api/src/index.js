const express = require('express');
const cors = require('cors');

const roomsRoutes = require('./routes/rooms');
const bookingsRoutes = require('./routes/bookings');
const guestsRoutes = require('./routes/guests');
const paymentsRoutes = require('./routes/payments');
const housekeepingRoutes = require('./routes/housekeeping');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/rooms', roomsRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/guests', guestsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/housekeeping', housekeepingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
