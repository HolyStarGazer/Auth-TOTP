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
const { storeSecret, hasUser } = require('./keystore');
const { verifyCode, pruneExpiredCodes } = require('./validator');
const { sendCode } = require('./mailer');

const app = express();

// ──────────────────────────────────────────────────────
// MIDDLEWARE
//
// You need Express to parse JSON request bodies.
// Hint: app.use(express.json())
// ──────────────────────────────────────────────────────

// TODO: add JSON body parsing middleware


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


// ──────────────────────────────────────────────────────
// PERIODIC CLEANUP
//
// Start a setInterval to call pruneExpiredCodes() from
// the validator. Every 60 seconds is reasonable.
//
// This prevents the used-codes map from growing forever.
// ──────────────────────────────────────────────────────

// TODO: set up the periodic cleanup interval
