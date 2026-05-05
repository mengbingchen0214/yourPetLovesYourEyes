const STATE = {
  GREETING: 'greeting',
  SLEEPING: 'sleeping',
  RESTING: 'resting',
  PAUSED: 'paused'
};

const SLEEP_DURATION = 20 * 60 * 1000;
const REST_DURATION = 20 * 1000;

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

module.exports = { STATE, SLEEP_DURATION, REST_DURATION, MIME_TYPES };
