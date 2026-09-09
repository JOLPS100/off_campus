const express = require('express');
const { load, save } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PHONE_RE = /(\+?\d[\d\s\-]{7,}\d)/;

function conversationKey(a, b) {
  return [a, b].sort().join('__');
}

router.get('/:otherUserId', requireAuth, (req, res) => {
  const db = load();
  const key = conversationKey(req.userId, req.params.otherUserId);
  const convo = db.conversations[key] || { messages: [] };
  res.json({ messages: convo.messages });
});

router.post('/:otherUserId', requireAuth, (req, res) => {
  const { text, txRef } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

  const db = load();
  const me = db.users.find((u) => u.id === req.userId);
  if (!me) return res.status(404).json({ error: 'User not found' });

  // Gate 1: must have an active 24h subscription to send anything.
  const subActive = me.subscriptionExpiresAt && new Date(me.subscriptionExpiresAt) > new Date();
  if (!subActive) {
    return res.status(402).json({ error: 'subscription_required', message: 'Pay today\'s pass to start texting' });
  }

  // Gate 2: sharing a phone number costs an additional confirmed payment.
  // Re-checked server-side - never trust a client-side-only check for a paid gate.
  if (PHONE_RE.test(text)) {
    const tx = db.transactions.find(
      (t) => t.txRef === txRef && t.userId === me.id && t.type === 'phone_message' && t.status === 'completed' && !t.consumed
    );
    if (!tx) {
      return res.status(402).json({ error: 'phone_share_payment_required', message: 'Pay to send a message containing a phone number' });
    }
    tx.consumed = true;
  }

  const key = conversationKey(req.userId, req.params.otherUserId);
  if (!db.conversations[key]) db.conversations[key] = { messages: [] };
  db.conversations[key].messages.push({
    from: req.userId,
    text,
    at: new Date().toISOString(),
  });
  save(db);
  res.json({ ok: true });
});

module.exports = router;
