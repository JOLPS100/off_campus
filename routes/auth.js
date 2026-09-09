const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { load, save } = require('../lib/db');

const router = express.Router();

function minAge(dobString) {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// NOTE: date-of-birth self-entry is NOT real age verification - a
// determined minor can lie about their birth date same as they could on
// a checkbox. Real age assurance (ID document check, third-party age
// verification service) is a separate project and strongly recommended
// before real launch, since this product connects adult strangers for
// in-person meetings.
router.post('/signup', async (req, res) => {
  const { name, dob, gender, phone, password } = req.body;
  if (!name || !dob || !gender || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const age = minAge(dob);
  if (age === null) return res.status(400).json({ error: 'Invalid date of birth' });
  if (age < 18) return res.status(403).json({ error: 'You must be 18 or older to use JolpsCrush' });

  const db = load();
  if (db.users.some((u) => u.phone === phone)) {
    return res.status(409).json({ error: 'An account with this phone number already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name,
    dob,
    age,
    gender,
    phone,
    passwordHash,
    lat: null,
    lng: null,
    prefs: { ageMin: 18, ageMax: 99, distanceKm: 25, intent: 'either' },
    subscriptionExpiresAt: null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  const db = load();
  const user = db.users.find((u) => u.phone === phone);
  if (!user) return res.status(401).json({ error: 'Invalid phone or password' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid phone or password' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

module.exports = router;
