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

/**
 * Verifies a TOTP code submitted by a user.
 *
 * @param {string} email - The user's email
 * @param {string} submittedCode - The 6-digit code the user entered
 * @returns {object} - { valid: boolean, message: string }
 */
function verifyCode(email, submittedCode) {
  // ──────────────────────────────────────────────────────
  // STEP 1: Retrieve the user's decrypted secret
  //
  // Use keystore.retrieveSecret(email).
  // If null, the user doesn't exist — return invalid.
  // ──────────────────────────────────────────────────────

  // TODO: get the secret


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

}

module.exports = { verifyCode, pruneExpiredCodes };
