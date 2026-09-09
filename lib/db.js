// Minimal file-based persistence so the app runs with zero external services.
// This is fine for building/testing. Before real launch with paying users,
// replace this with a real database (Postgres is the standard choice) -
// concurrent writes to a JSON file will corrupt data under real traffic.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], transactions: [], conversations: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
