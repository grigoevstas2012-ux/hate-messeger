// Firebase Cloud Function: anonMessage
// Deploy with Firebase CLI (`firebase deploy --only functions`) after installing firebase-admin
// This function accepts POST JSON { text, meta } and stores an anonymized message in Firestore.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.anonMessage = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const data = req.body || {};
  const text = (data.text || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Empty message' });

  try {
    const anonId = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const doc = {
      from: anonId,
      text: text,
      meta: data.meta || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      anonym: true
    };

    await db.collection('messages').add(doc);
    return res.json({ ok: true, id: anonId });
  } catch (e) {
    console.error('anonMessage error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});