// Wrapper around PayChangu's API (https://paychangu.com), a Malawian payment
// gateway supporting Airtel Money, TNM Mpamba, and cards.
//
// IMPORTANT: verify the request/response shape against PayChangu's current
// official docs (https://developer.paychangu.com) before going live - this
// is built from their publicly documented endpoint pattern, but payment
// APIs change and you are handling real money.

const fetch = require('node-fetch');

const BASE_URL = 'https://api.paychangu.com';

async function initiatePayment({ amount, currency = 'MWK', email, phone, txRef, callbackUrl, returnUrl, meta }) {
  const secretKey = process.env.PAYCHANGU_SECRET_KEY;
  if (!secretKey || secretKey.startsWith('your_')) {
    throw new Error('PAYCHANGU_SECRET_KEY is not configured - add a real key from your PayChangu merchant dashboard to .env');
  }

  const res = await fetch(`${BASE_URL}/payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      email,
      phone,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      meta,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayChangu initiate failed: ${JSON.stringify(data)}`);
  }
  return data; // expect a checkout URL the client redirects to
}

async function verifyPayment(txRef) {
  const secretKey = process.env.PAYCHANGU_SECRET_KEY;
  const res = await fetch(`${BASE_URL}/verify-payment/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayChangu verify failed: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { initiatePayment, verifyPayment };
