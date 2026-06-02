/**
 * totp.js — Core TOTP Algorithm
 *
 * Reference: RFC 6238 (https://datatracker.ietf.org/doc/html/rfc6238)
 * Also see: RFC 4226 for the underlying HOTP algorithm
 *
 * The TOTP algorithm is: TOTP = HOTP(K, T)
 *   where T = floor((currentUnixTime - T0) / X)
 *
 * HOTP is defined as: HOTP(K, C) = Truncate(HMAC-SHA-1(K, C))
 *
 * You will implement this in three stages:
 *   1. Compute HMAC-SHA-1 of the key and time counter
 *   2. Apply dynamic truncation to extract a 4-byte value
 *   3. Reduce to the desired number of digits
 *
 * Node.js built-in you will need:
 *   const crypto = require('crypto');
 *
 * Useful crypto methods:
 *   - crypto.createHmac(algorithm, key) → returns an Hmac object
 *   - hmac.update(data) → feeds data into the HMAC
 *   - hmac.digest() → returns the result as a Buffer
 */

const crypto = require('crypto');

/**
 * Generates a TOTP code for the given parameters.
 *
 * @param {Buffer} key - The shared secret as a Buffer (raw bytes, not hex)
 * @param {number} timeStep - Time step in seconds (default: 30, per RFC §5.2)
 * @param {number} t0 - Unix time to start counting from (default: 0)
 * @param {number} digits - Number of digits in the output code (default: 6)
 * @param {string} algorithm - HMAC algorithm: 'sha1', 'sha256', or 'sha512'
 * @returns {string} - The TOTP code, zero-padded to `digits` length
 */
function generateTOTP(key, timeStep = 30, t0 = 0, digits = 6, algorithm = 'sha1', currentTime = Math.floor(Date.now() / 1000)) {
  // ──────────────────────────────────────────────────────
  // STEP 1: Calculate the time counter T
  //
  // T = floor((currentUnixTime - T0) / X)
  //
  // Hint: Date.now() gives milliseconds — you need seconds.
  // Hint: Math.floor() for the floor function.
  // ──────────────────────────────────────────────────────

  // TODO: calculate T
  const T = Math.floor((currentTime - t0) / timeStep);

  // ──────────────────────────────────────────────────────
  // STEP 2: Convert T to an 8-byte big-endian Buffer
  //
  // RFC 4226 requires the counter as an 8-byte value.
  // JavaScript's Number is safe up to 2^53, which covers
  // well beyond the year 2038 concern in RFC 6238 §4.2.
  //
  // Hint: Buffer.alloc(8) creates an 8-byte zero buffer.
  // Hint: Look at Buffer's writeUInt32BE method. You'll
  //       need to split T into high and low 32-bit halves
  //       since JS doesn't have a writeUInt64BE.
  //
  //       Alternative: use BigInt and a loop to fill bytes.
  // ──────────────────────────────────────────────────────

  // TODO: convert T to an 8-byte Buffer
  const buf = Buffer.alloc(8);
  const high = Math.floor(T / 2**32);
  const low = T % 2**32;

  buf.writeUInt32BE(high, 0); // top 4 bytes
  buf.writeUInt32BE(low, 4);  // bottom 4 bytes

  // ──────────────────────────────────────────────────────
  // STEP 3: Compute HMAC
  //
  // HMAC-SHA-1(key, timeBuffer) using Node's crypto module.
  // The result is a 20-byte Buffer (for SHA-1).
  // ──────────────────────────────────────────────────────

  // TODO: compute the HMAC digest as a Buffer
  const hmac = crypto.createHmac(algorithm, key); // init with algo + key
  hmac.update(buf);                               // feed in the message (8-byte counter)
  const digest = hmac.digest();                   // get the HMAC result as a Buffer

  // ──────────────────────────────────────────────────────
  // STEP 4: Dynamic Truncation (RFC 4226 §5.3)
  //
  // This is the clever part. From the 20-byte HMAC result:
  //
  //   1. Take the LAST byte of the hash.
  //   2. Use the low 4 bits of that byte as an offset (0–15).
  //   3. Starting at that offset, read 4 bytes from the hash.
  //   4. Mask the top bit of the first byte (& 0x7f) to avoid
  //      sign issues — this gives you a 31-bit unsigned int.
  //
  // The result is a number between 0 and 2^31 - 1.
  //
  // Hint: Buffer has readUInt32BE(offset) but you'll need
  //       to handle the 0x7f mask on the first byte manually,
  //       OR use bitwise operations:
  //       ((hash[offset] & 0x7f) << 24) |
  //       ((hash[offset+1] & 0xff) << 16) |
  //       ((hash[offset+2] & 0xff) << 8)  |
  //        (hash[offset+3] & 0xff)
  // ──────────────────────────────────────────────────────

  // TODO: apply dynamic truncation to get a 31-bit integer
  const offset = digest[digest.length - 1] & 0x0f; // mask to get low 4 bits
  const truncated = ((digest[offset] & 0x7f) << 24) |
                    ((digest[offset + 1] & 0xff) << 16) |
                    ((digest[offset + 2] & 0xff) << 8) |
                    (digest[offset + 3] & 0xff);
  // const truncated = digest.readUInt32BE(offset) & 0x7fffffff; // alternative using readUInt32BE

  // ──────────────────────────────────────────────────────
  // STEP 5: Reduce to the desired number of digits
  //
  // Take the truncated value modulo 10^digits.
  // Zero-pad the result to `digits` characters.
  //
  // Example: if digits=6 and the value is 42 → "000042"
  //
  // Hint: String.prototype.padStart(digits, '0')
  // ──────────────────────────────────────────────────────

  // TODO: reduce and zero-pad, then return the code string
  const code = truncated % (10 ** digits);
  return code.toString().padStart(digits, '0');

}

/**
 * Generates a cryptographically random shared secret.
 *
 * Per RFC 6238 §5.1:
 *   - Keys SHOULD be randomly generated (CSPRNG)
 *   - Key length SHOULD match HMAC output length:
 *       SHA-1   → 20 bytes
 *       SHA-256 → 32 bytes
 *       SHA-512 → 64 bytes
 *
 * @param {string} algorithm - 'sha1', 'sha256', or 'sha512'
 * @returns {Buffer} - The random key as a Buffer
 */
function generateSecret(algorithm = 'sha1') {
  // ──────────────────────────────────────────────────────
  // Determine the correct key length for the algorithm,
  // then use crypto.randomBytes() to generate it.
  //
  // Hint: a simple object mapping algorithm names to byte
  //       lengths will keep this clean.
  // ──────────────────────────────────────────────────────

  // TODO: generate and return a random key of the correct length

}

module.exports = { generateTOTP, generateSecret };
