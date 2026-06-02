/**
 * validator.js — TOTP Verification with Drift & Replay Protection
 *
 * This module handles the security-critical verification logic from
 * RFC 6238 §5.2 and §6.
 *
 * Two key requirements to implement:
 *
 * 1. TIME WINDOW TOLERANCE (§5.2):
 *    "A validation system SHOULD typically set a policy for an acceptable
 *     OTP transmission delay window for validation."
 *    "We RECOMMEND that at most one time step is allowed as the network delay."
 *
 *    This means: when a code arrives, you check it against the CURRENT
 *    time step AND one step in the past. The user might have generated
 *    the code at second 29 of a window, and it arrives at second 1 of
 *    the next window — that's still valid.
 *
 * 2. REPLAY PROTECTION (§5.2):
 *    "The verifier MUST NOT accept the second attempt of the OTP after
 *     the successful validation has been issued for the first OTP,
 *     which ensures one-time only use of an OTP."
 *
 *    This means: once a code is successfully verified, store it so it
 *    can't be used again. You need some kind of "used codes" tracker.
 *
 * 3. CLOCK DRIFT TRACKING (§6) — Stretch goal:
 *    If the code matches a PAST time step (not the current one), record
 *    that drift offset for the user. On future verifications, adjust
 *    the time step by that offset before checking.
 */

const { generateTOTP } = require('./totp');
const { retrieveSecret } = require('./keystore');

// Track used codes to prevent replay attacks.
// Consider: what data structure works here? You need to check
// "has this exact code been used by this user recently?"
//
// A Map of email → Set of used codes is one approach.
// But you also need to clean up old entries — codes from 5 minutes
// ago don't need to be tracked anymore.
//
// Hint: store { code, timestamp } pairs and periodically prune.
const usedCodes = new Map();

// Track per-user clock drift (§6).
// Maps email → number of time steps of detected drift.
const clockDrift = new Map();
const MAX_DRIFT = 1;            // maximum drift to track in either direction (e.g., +-1 time step = +-30 seconds). 
                                // RFC 4226 §7.4 recommends s=1 but a maximum s=50
                                // I'm allowing +- 1 step so the window is effectively 3 steps (total 90 seconds)
                                // This can be improved to compare only 2 steps by leaning into the drift tracking more aggressively, 
                                // but this is a reasonable starting point.
const pendingDrift = new Map(); // email → { offset, count } to track observed drift before confirming it
const DRIFT_CONFIRM = 3;        // require 3 consecutive matches before committing

/**
 * Verifies a TOTP code submitted by a user.
 *
 * @param {string} email - The user's email
 * @param {string} submittedCode - The 6-digit code the user entered
 * @returns {object} - { valid: boolean, message: string }
 */
function verifyCode(email, submittedCode, currentTime = Math.floor(Date.now() / 1000)) {
  // ──────────────────────────────────────────────────────
  // STEP 1: Retrieve the user's decrypted secret
  //
  // Use keystore.retrieveSecret(email).
  // If null, the user doesn't exist — return invalid.
  // ──────────────────────────────────────────────────────

  // TODO: get the secret
  const secret = retrieveSecret(email);
  if (!secret) {
    return { valid: false, message: 'User not found' };
  }

  // ──────────────────────────────────────────────────────
  // STEP 2: Check for replay
  //
  // Has this exact code already been successfully used by
  // this user? If so, reject it immediately.
  //
  // Per RFC §5.2: "The verifier MUST NOT accept the second
  // attempt of the OTP after the successful validation."
  // ──────────────────────────────────────────────────────

  // TODO: check the usedCodes map
  // usedCodes map format: {email -> {code, timestamp}}
  if (usedCodes.has(email) && usedCodes.get(email).some(entry => entry.code === submittedCode)) {
    return { valid: false, message: 'Code has already been used' };
  }


  // ──────────────────────────────────────────────────────
  // STEP 3: Generate codes for the allowed time window
  //
  // You need to check:
  //   - The code for the CURRENT time step
  //   - The code for ONE step in the past (§5.2 recommendation)
  //
  // If you implemented clock drift tracking (§6), also
  // adjust the time steps by the user's known drift offset.
  //
  // For each time step, call generateTOTP() and compare
  // the result to submittedCode.
  //
  // Hint: you can't just pass "current time" to generateTOTP
  //       as-is if you want to check past windows. You have
  //       two design options:
  //       (a) Modify generateTOTP to accept an explicit time, OR
  //       (b) Compute T here and pass it in.
  //
  //       Think about which approach keeps totp.js cleaner.
  //       Looking at the function signature in totp.js might
  //       suggest you need a small refactor — that's expected.
  // ──────────────────────────────────────────────────────

  // TODO: check the submitted code against allowed windows
  // Get the user's current drift offset (default to 0 if not set)
  const drift = clockDrift.get(email) || 0;

  // ──────────────────────────────────────────────────────
  // STEP 4: On success
  //
  // If a match is found:
  //   1. Record the code as used (replay protection)
  //   2. If the match was on a past step, record the drift (§6)
  //   3. Return { valid: true, message: '...' }
  //
  // If no match:
  //   Return { valid: false, message: '...' }
  // ──────────────────────────────────────────────────────

  // TODO: handle match/no-match
  for (const delta of [0, -1, +1]) {
    const code = generateTOTP(secret, 30, 0, 6, 'sha1', currentTime + (drift + delta) * 30);
    if (submittedCode === code) {
      if (delta === 0) {
        // current step match, no drift adjustment needed
        pendingDrift.delete(email); // clear any pending drift if the current code matches
        
        markCodeUsed(email, submittedCode);
        return { valid: true, message: 'Code is valid (current step)' };
      } else { // delta !== 0, past or future step match
        // Record the new drift offset if this code matches a past or future step
        const observed = drift + delta; // the offset this match implies

        if (Math.abs(observed) <= MAX_DRIFT) { // Only consider it if it's within the maximum drift limit
          const pending = pendingDrift.get(email);

          if (pending && pending.offset === observed) {
            pending.count++;

            if (pending.count >= DRIFT_CONFIRM) { // seen this drift enough times, trust it
              clockDrift.set(email, observed);
              pendingDrift.delete(email);
            }
          } else {
            pendingDrift.set(email, { offset: observed, count: 1 }); // start counting
          }
        }

        markCodeUsed(email, submittedCode);
        return { valid: true, message: `Code is valid (time step ${delta === -1 ? 'past' : 'future'}, drift adjusted)` };
      }
    }
  }

  return { valid: false, message: 'Invalid code' };
}

/**
 * Marks a code as used for replay protection.
 *
 * Consider: how long do you need to keep a code in the used set?
 * A code is only valid for at most 2 time steps (current + 1 back),
 * so codes older than 2*timeStep seconds can be safely pruned.
 *
 * @param {string} email - The user's email
 * @param {string} code - The code that was just verified
 */
function markCodeUsed(email, code) {
  // TODO: store the code with a timestamp for later cleanup
  const timestamp = Date.now() / 1000; // store in seconds for easier comparison
  
  if (!usedCodes.has(email)) {
    usedCodes.set(email, []);
  }

  usedCodes.get(email).push({ code, timestamp });
}

/**
 * Cleans up expired entries from the usedCodes map.
 *
 * Call this periodically (e.g., every minute via setInterval).
 * Remove any entries older than 2 * timeStep seconds.
 *
 * This prevents the usedCodes map from growing unbounded.
 */
function pruneExpiredCodes() {
  // TODO: iterate and remove old entries
  const now = Date.now() / 1000;

  for (const [email, entries] of usedCodes.entries()) {
    const validEntries = entries.filter(entry => now - entry.timestamp < 60); // keep entries from the last 60 seconds

    if (validEntries.length > 0) {
      usedCodes.set(email, validEntries);
    } else {
      usedCodes.delete(email); // no valid entries left, remove the email key
    }
  }
}

module.exports = { verifyCode, pruneExpiredCodes };
