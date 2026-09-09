const express = require('express');
const { load, save } = require('../lib/db');
const { distanceKm } = require('../lib/distance');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.put('/me/location', requireAuth, (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }
  const db = load();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.lat = lat;
  user.lng = lng;
  save(db);
  res.json({ ok: true });
});

router.put('/me/preferences', requireAuth, (req, res) => {
  const { ageMin, ageMax, distanceKm: distPref, intent } = req.body;
  const db = load();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.prefs = {
    ageMin: Math.max(18, ageMin ?? user.prefs.ageMin),
    ageMax: Math.max(18, ageMax ?? user.prefs.ageMax),
    distanceKm: distPref ?? user.prefs.distanceKm,
    intent: intent ?? user.prefs.intent,
  };
  save(db);
  res.json({ ok: true, prefs: user.prefs });
});

router.get('/nearby', requireAuth, (req, res) => {
  const db = load();
  const me = db.users.find((u) => u.id === req.userId);
  if (!me) return res.status(404).json({ error: 'User not found' });
  if (me.lat === null || me.lng === null) {
    return res.status(400).json({ error: 'Set your location first (PUT /api/users/me/location)' });
  }

  const results = db.users
    .filter((u) => u.id !== me.id)
    .filter((u) => u.lat !== null && u.lng !== null)
    .filter((u) => u.age >= me.prefs.ageMin && u.age <= me.prefs.ageMax)
    .map((u) => ({
      id: u.id,
      name: u.name,
      age: u.age,
      gender: u.gender,
      distanceKm: distanceKm(me.lat, me.lng, u.lat, u.lng),
    }))
    .filter((u) => u.distanceKm <= me.prefs.distanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ results });
});

module.exports = router;
