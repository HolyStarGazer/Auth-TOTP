/**
 * server.js — HTTPS Server
 *
 * This is the entry point. It ties together all the modules:
 *   - totp.js for code generation
 *   - keystore.js for encrypted secret storage
 *   - validator.js for code verification
 *   - mailer.js for sending codes via email
 *
 * The server runs over HTTPS using self-signed certs (see certs/README.md).
 *
 * Two endpoints:
 *   POST /request-code  — generates a TOTP, stores the secret, emails the code
 *   POST /verify         — checks a submitted code
 *
 * You will need:
 *   const https = require('https');
 *   const fs = require('fs');
 *   const express = require('express');
 *   require('dotenv').config();
 */

const https = require('https');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const { generateTOTP, generateSecret } = require('./totp');
const { storeSecret, retrieveSecret, hasUser } = require('./keystore');
const { verifyCode, pruneExpiredCodes } = require('./validator');
const { sendCode, verifyTransport } = require('./mailer');

/** HTML status codes
 * 200 OK
 * - email exists, code sent
 * - email doesn't exist, but we return the same response to avoid leaking info
 * 201 Created
 * - account created
 * 409 Conflict
 * - account already exists when trying to create a new one
 * 400 Bad Request
 * - missing email or code in request body
 * - code is not the right format (not digits or wrong length)
 * 401 Unauthorized
 * - code is incorrect or expired
 */

const app = express();

// ──────────────────────────────────────────────────────
// MIDDLEWARE
//
// You need Express to parse JSON request bodies.
// Hint: app.use(express.json())
// ──────────────────────────────────────────────────────

// TODO: add JSON body parsing middleware
app.use(express.json());

// ──────────────────────────────────────────────────────
// ENDPOINT: POST /register
//
// Request body: { "email": "user@example.com" }
//
// Enrolls a NEW user by minting and storing an encrypted TOTP
// secret. This is the ONLY place a secret is ever created.
//
// What this should do:
//   1. Extract email from the body. If missing → 400.
//   2. If the user already exists (keystore.hasUser) → 409 Conflict.
//      Do NOT overwrite — overwriting would let anyone hijack an
//      existing account just by re-registering its email.
//   3. Otherwise: generateSecret() → storeSecret(email, secret).
//   4. Respond 201 Created.
//
// Note: registration does NOT generate or email a code. That's
//       /request-code's job. This endpoint only enrolls the secret.
// ──────────────────────────────────────────────────────

app.post('/register', (req, res) => {
  // TODO: implement registration
  //   - validate email           → 400 if missing
  //   - conflict check (hasUser)  → 409 if already registered
  //   - generateSecret + storeSecret, then → 201
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (hasUser(email)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const secret = generateSecret();
  storeSecret(email, secret);

  res.status(201).json({ message: 'User registered successfully' });
});

// ──────────────────────────────────────────────────────
// ENDPOINT: POST /request-code
//
// Request body: { "email": "user@example.com" }
//
// What this should do:
//   1. Extract email from request body. Validate it exists.
//   2. Generate a new shared secret (totp.generateSecret).
//   3. Store it encrypted (keystore.storeSecret).
//   4. Generate the current TOTP code (totp.generateTOTP).
//   5. Email the code to the user (mailer.sendCode).
//   6. Respond with success (but do NOT include the code
//      in the response — that would defeat the purpose).
//
// Error handling: if the email send fails, respond with 500.
//
// Design decision: should requesting a new code invalidate
// any previous secret for that user? Probably yes — think
// about why.
// ──────────────────────────────────────────────────────

app.post('/request-code', async (req, res) => {
  // TODO: implement the code request flow
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if email doesn't exist
  if (!hasUser(email)) {
    console.warn(`Warning: requesting code for non-existent user ${email}`);
    // For security reasons, we return success even if the user doesn't exist
    // to avoid leaking information about which emails are registered.
    return res.status(200).json({ message: 'Code sent successfully' });
  }

  try {
    const secret = retrieveSecret(email);
    if (!secret) {
      console.error(`Failed to retrieve secret for ${email}`);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const code = generateTOTP(secret);
    await sendCode(email, code);

    res.status(200).json({ message: 'Code sent successfully' });
  } catch (err) {
    console.error('Error during /request-code:', err);
    res.status(500).json({ error: 'Failed to send code' });
  }
});


// ──────────────────────────────────────────────────────
// ENDPOINT: POST /verify
//
// Request body: { "email": "user@example.com", "code": "123456" }
//
// What this should do:
//   1. Extract email and code from request body.
//   2. Validate both fields exist and code is the right format
//      (string of digits, correct length).
//   3. Call validator.verifyCode(email, code).
//   4. Respond with the result.
//
// Think about HTTP status codes:
//   - 200 for a valid code
//   - 401 for an invalid code (unauthorized)
//   - 400 for malformed requests
// ──────────────────────────────────────────────────────

app.post('/verify', (req, res) => {
  // TODO: implement the verification flow
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be a 6-digit string' });
  }

  const result = verifyCode(email, code);
  if (result.valid) {
    res.status(200).json({ message: 'Code is valid' });
  } else {
    res.status(401).json({ error: 'Invalid code' });
  }
});


// ──────────────────────────────────────────────────────
// HTTPS SERVER SETUP
//
// Load the TLS certificate and private key from the paths
// specified in .env (TLS_CERT_PATH and TLS_KEY_PATH).
//
// Create an HTTPS server:
//   https.createServer({ key, cert }, app)
//
// Listen on the port from SERVER_PORT in .env.
//
// Hint: fs.readFileSync() for loading the cert files.
// ──────────────────────────────────────────────────────

// TODO: load certs and start HTTPS server
const key = fs.readFileSync(process.env.TLS_KEY_PATH);
const cert = fs.readFileSync(process.env.TLS_CERT_PATH);

if (!key || !cert) {
  console.error('Failed to load TLS key or certificate. Check the paths in .env.');
  process.exit(1);
}

https.createServer({ key, cert }, app).listen(process.env.SERVER_PORT, () => {
  console.log(`Server is running on https://localhost:${process.env.SERVER_PORT}`);
  verifyTransport().then()
    .then(() => console.log('SMTP ready'))
    .catch(err => console.error('SMTP verify FAILED:', err));
});

// ──────────────────────────────────────────────────────
// PERIODIC CLEANUP
//
// Start a setInterval to call pruneExpiredCodes() from
// the validator. Every 60 seconds is reasonable.
//
// This prevents the used-codes map from growing forever.
// ──────────────────────────────────────────────────────

// TODO: set up the periodic cleanup interval
setInterval(pruneExpiredCodes, 60 * 1000); // every 60 seconds