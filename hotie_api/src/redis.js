const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
});

// Cache middleware
const cacheMiddleware = (keyGenerator, expireSeconds = 300) => async (req, res, next) => {
  try {
    const key = keyGenerator(req);
    const cached = await redis.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redis.set(key, JSON.stringify(body), 'EX', expireSeconds);
      res.sendResponse(body);
    };
    next();
  } catch (err) {
    next();
  }
};

module.exports = { redis, cacheMiddleware };
