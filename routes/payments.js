const express = require('express');
const { load, save } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const paychangu = require('../lib/paychangu');

const router = express.Router();

const PRICES = {
  subscription: Number(process.env.SUBSCRIPTION_PRICE_MWK || 500),
  phone_message: Number(process.env.PHONE_SHARE_PRICE_MWK || 500),
};

router.post('/initiate', requireAuth, async (req, res) => {
  const { type } = req.body; // 'subscription' | 'phone_message'
  if (!PRICES[type]) return res.status(400).json({ error: 'Unknown payment type' });

  const db = load();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const txRef = `jc_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const transaction = {
    txRef,
    userId: user.id,
    type,
    amount: PRICES[type],
    currency: 'MWK',
    status: 'pending',
    consumed: false,
    createdAt: new Date().toISOString(),
  };
  db.transactions.push(transaction);
  save(db);

  try {
    const payment = await paychangu.initiatePayment({
      amount: PRICES[type],
      currency: 'MWK',
      email: `${user.phone}@jolpscrush.local`, // PayChangu requires an email field; users only give phone
      phone: user.phone,
      txRef,
      callbackUrl: process.env.PAYCHANGU_CALLBACK_URL,
      returnUrl: `${process.env.APP_BASE_URL}/payment-complete.html?txRef=${txRef}`,
      meta: { userId: user.id, type },
    });
    res.json({ txRef, checkoutUrl: payment.data?.checkout_url || payment.checkout_url || null, raw: payment });
  } catch (err) {
    res.status(502).json({ error: 'Payment provider error', details: err.message });
  }
});

// PayChangu calls this URL when a payment completes. Configure it in your
// PayChangu dashboard and in .env - it must be a public HTTPS URL in production.
router.post('/webhook', express.json(), async (req, res) => {
  const txRef = req.body.tx_ref || req.body.txRef;
  if (!txRef) return res.status(400).json({ error: 'Missing tx_ref' });

  const db = load();
  const tx = db.transactions.find((t) => t.txRef === txRef);
  if (!tx) return res.status(404).json({ error: 'Unknown transaction' });

  try {
    const verified = await paychangu.verifyPayment(txRef);
    const status = verified.data?.status || verified.status;

    if (status === 'success' || status === 'successful') {
      tx.status = 'completed';
      if (tx.type === 'subscription') {
        const user = db.users.find((u) => u.id === tx.userId);
        if (user) {
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          user.subscriptionExpiresAt = expires.toISOString();
        }
      }
      // 'phone_message' transactions are consumed later, at send-time, in routes/messages.js
    } else {
      tx.status = 'failed';
    }
    save(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Verification failed', details: err.message });
  }
});

// Lets the frontend poll "did my payment go through yet" after redirect back
// from PayChangu's checkout page.
router.get('/status/:txRef', requireAuth, (req, res) => {
  const db = load();
  const tx = db.transactions.find((t) => t.txRef === req.params.txRef && t.userId === req.userId);
  if (!tx) return res.status(404).json({ error: 'Unknown transaction' });
  res.json({ status: tx.status, type: tx.type });
});

module.exports = router;
