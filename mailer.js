/**
 * mailer.js — Gmail SMTP Transport (TLS)
 *
 * Per RFC 6238 §5.1:
 *   "All the communications SHOULD take place over a secure channel,
 *    e.g., Secure Socket Layer/Transport Layer Security (SSL/TLS)"
 *
 * Nodemailer connects to Gmail SMTP on port 587 using STARTTLS.
 * Here's how that works:
 *
 *   1. Your server opens a plaintext TCP connection to smtp.gmail.com:587
 *   2. The server advertises STARTTLS support
 *   3. Nodemailer sends the STARTTLS command
 *   4. The connection is UPGRADED to TLS (encrypted)
 *   5. Only THEN does authentication happen (your credentials are safe)
 *   6. The email is sent over the encrypted connection
 *
 * This is different from "implicit TLS" on port 465, where the
 * connection starts encrypted from the first byte. Both are secure;
 * port 587 + STARTTLS is the modern standard.
 *
 * You will need:
 *   const nodemailer = require('nodemailer');
 *
 * Nodemailer docs: https://nodemailer.com/smtp/
 */

const nodemailer = require('nodemailer');

/**
 * Creates and returns a configured Nodemailer transporter.
 *
 * This should only be created once (not per email).
 *
 * @returns {object} - A Nodemailer transporter instance
 */
function createTransporter() {
  // ──────────────────────────────────────────────────────
  // Use nodemailer.createTransport() with these settings:
  //
  //   host: 'smtp.gmail.com'
  //   port: 587
  //   secure: false
  //     ^ This looks wrong but is correct!
  //       "secure: false" means "don't start with TLS."
  //       Nodemailer will upgrade via STARTTLS automatically.
  //       "secure: true" would use port 465 (implicit TLS).
  //
  //   auth: {
  //     user: <from GMAIL_USER env var>,
  //     pass: <from GMAIL_APP_PASSWORD env var>
  //   }
  //
  // The credentials are only sent AFTER the TLS upgrade,
  // so they never travel in plaintext.
  //
  // Optional but recommended: set tls.rejectUnauthorized to
  // true (the default) so Nodemailer verifies Gmail's cert.
  // ──────────────────────────────────────────────────────

  // TODO: create and return the transporter

}

/**
 * Sends a TOTP code to the specified email address.
 *
 * @param {string} recipientEmail - Where to send the code
 * @param {string} code - The 6-digit TOTP code
 * @returns {Promise<object>} - Nodemailer send result (has messageId, etc.)
 */
async function sendCode(recipientEmail, code) {
  // ──────────────────────────────────────────────────────
  // 1. Get or create the transporter.
  //    (Consider: create it once at module level, or lazily
  //     on first call? Either approach works.)
  //
  // 2. Define the message:
  //    {
  //      from: process.env.GMAIL_USER,
  //      to: recipientEmail,
  //      subject: something descriptive,
  //      text: the code in plain text,
  //      html: (optional) a nicer HTML version
  //    }
  //
  // 3. Send with: await transporter.sendMail(message)
  //
  // 4. Return the result (or throw on failure).
  //
  // Security note: the email body itself travels through
  // Google's servers. We trust Gmail's infrastructure here,
  // but be aware the code is visible in the recipient's
  // inbox. This is inherent to email-based OTP — the
  // security model assumes the email account is secure.
  // ──────────────────────────────────────────────────────

  // TODO: compose and send the email

}

module.exports = { sendCode };
