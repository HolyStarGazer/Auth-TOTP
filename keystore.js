/**
 * keystore.js — Encrypted Key Storage
 *
 * Per RFC 6238 §5.1:
 *   "We also RECOMMEND storing the keys securely in the validation system,
 *    and, more specifically, encrypting them using tamper-resistant hardware
 *    encryption and exposing them only when required: for example, the key
 *    is decrypted when needed to verify an OTP value, and re-encrypted
 *    immediately to limit exposure in the RAM to a short period of time."
 *
 * Since we don't have a hardware security module (HSM) locally, we'll
 * encrypt secrets with AES-256-GCM using a master key from the environment.
 *
 * AES-256-GCM provides both confidentiality AND integrity (the "auth tag"),
 * so if anyone tampers with the ciphertext, decryption will fail.
 *
 * Node.js built-ins you will need:
 *   const crypto = require('crypto');
 *
 * Useful crypto methods:
 *   - crypto.createCipheriv(algorithm, key, iv, options)
 *   - crypto.createDecipheriv(algorithm, key, iv, options)
 *   - cipher.update(data) / cipher.final()
 *   - cipher.getAuthTag() / decipher.setAuthTag(tag)
 *
 * AES-256-GCM specifics:
 *   - Algorithm string: 'aes-256-gcm'
 *   - Key: 32 bytes (your MASTER_ENCRYPTION_KEY from .env, hex-decoded)
 *   - IV (initialization vector): 12 bytes, random, unique per encryption
 *   - Auth tag: 16 bytes, produced by cipher.getAuthTag() after final()
 *   - You must store the IV and auth tag alongside the ciphertext
 *     (they are not secret, but are required for decryption)
 */

require('dotenv').config();
const crypto = require('crypto');

// In-memory store. Maps email → { ciphertext, iv, authTag }
// A stretch goal is persisting this to an encrypted file.
const store = new Map();

/**
 * Encrypts a Buffer using AES-256-GCM.
 *
 * @param {Buffer} plaintext - The raw secret key to encrypt
 * @param {Buffer} masterKey - The 32-byte master encryption key
 * @returns {object} - { ciphertext: Buffer, iv: Buffer, authTag: Buffer }
 */
function encrypt(plaintext, masterKey) {
  // ──────────────────────────────────────────────────────
  // 1. Generate a random 12-byte IV with crypto.randomBytes(12)
  //    (GCM recommends 12 bytes; NIST SP 800-38D)
  //
  // 2. Create a cipher with crypto.createCipheriv('aes-256-gcm', masterKey, iv)
  //
  // 3. Encrypt: cipher.update(plaintext) then cipher.final()
  //    Concatenate both results into one Buffer.
  //
  // 4. Get the auth tag: cipher.getAuthTag()
  //
  // 5. Return { ciphertext, iv, authTag }
  // ──────────────────────────────────────────────────────

  // implement AES-256-GCM encryption
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const part1 = cipher.update(plaintext); // returns encoded buffer
  const part2 = cipher.final();           // GCM has no padding; finalizes GHASH so getAuthTag() works
  const ciphertext = Buffer.concat([part1, part2]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

/**
 * Decrypts a previously encrypted Buffer.
 *
 * @param {Buffer} ciphertext - The encrypted data
 * @param {Buffer} iv - The IV used during encryption
 * @param {Buffer} authTag - The authentication tag from encryption
 * @param {Buffer} masterKey - The 32-byte master encryption key
 * @returns {Buffer} - The decrypted plaintext (the original secret key)
 * @throws {Error} - If the auth tag verification fails (data was tampered)
 */
function decrypt(ciphertext, iv, authTag, masterKey) {
  // ──────────────────────────────────────────────────────
  // 1. Create a decipher with crypto.createDecipheriv('aes-256-gcm', masterKey, iv)
  //
  // 2. Set the auth tag: decipher.setAuthTag(authTag)
  //    This MUST happen before any update/final calls.
  //
  // 3. Decrypt: decipher.update(ciphertext) then decipher.final()
  //    If the auth tag doesn't match, final() throws an error —
  //    this means the ciphertext was tampered with.
  //
  // 4. Return the concatenated plaintext Buffer.
  // ──────────────────────────────────────────────────────

  // implement AES-256-GCM decryption
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  const part1 = decipher.update(ciphertext);
  const part2 = decipher.final();

  return Buffer.concat([part1, part2]);
}

/**
 * Stores an encrypted secret for a user.
 *
 * @param {string} email - The user's email (used as the key)
 * @param {Buffer} secret - The raw TOTP shared secret
 */
function storeSecret(email, secret) {
  // ──────────────────────────────────────────────────────
  // 1. Load the master key from process.env.MASTER_ENCRYPTION_KEY
  //    It's stored as hex in .env — decode it to a Buffer.
  //
  // 2. Call encrypt() with the secret and master key.
  //
  // 3. Store the result in the `store` Map, keyed by email.
  //
  // Consider: what should happen if the email already exists?
  //           Overwrite? Reject? Up to you.
  // ──────────────────────────────────────────────────────

  // implement AES-256-GCM encryption and storage
  const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex');
  const { ciphertext, iv, authTag } = encrypt(secret, masterKey);
  
  if (hasUser(email)) {
    // For simplicity, we'll allow overwriting existing secrets.
    console.warn(`Warning: overwriting existing secret for ${email}`);
  }
  
  store.set(email, { ciphertext, iv, authTag });
}

/**
 * Retrieves and decrypts a user's secret.
 *
 * Per RFC §5.1: the key should be "decrypted when needed to verify
 * an OTP value, and re-encrypted immediately to limit exposure."
 *
 * In practice for this project, "limit exposure" means: retrieve
 * the decrypted Buffer, use it for HMAC computation in the
 * validator, and do NOT hold a reference to it beyond that scope.
 *
 * @param {string} email - The user's email
 * @returns {Buffer|null} - The decrypted secret, or null if not found
 */
function retrieveSecret(email) {
  // ──────────────────────────────────────────────────────
  // 1. Look up the email in the store Map.
  //    Return null if not found.
  //
  // 2. Load the master key from the environment (same as storeSecret).
  //
  // 3. Call decrypt() with the stored ciphertext, iv, and authTag.
  //
  // 4. Return the decrypted Buffer.
  //
  // Note: in a real system you'd want to zero out the Buffer
  //       after use (buf.fill(0)) to minimize exposure in RAM.
  //       That's a stretch goal here.
  // ──────────────────────────────────────────────────────

  // implement retrieval and decryption of the secret
  if (!hasUser(email)) {
    return null;
  }

  const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex');
  const { ciphertext, iv, authTag } = store.get(email);

  return decrypt(ciphertext, iv, authTag, masterKey);
}

/**
 * Checks if a user exists in the keystore.
 *
 * @param {string} email
 * @returns {boolean}
 */
function hasUser(email) {
  // implement user existence check
  return store.has(email);
}

module.exports = { storeSecret, retrieveSecret, hasUser };
