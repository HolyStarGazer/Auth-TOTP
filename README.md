# TOTP Verification System — Project Brief

## Objective

Build a local TOTP (Time-Based One-Time Password) server and client following
the security considerations outlined in [RFC 6238 Section 5](https://datatracker.ietf.org/doc/html/rfc6238#section-5).

The server generates a TOTP code, emails it to the user via Gmail SMTP (over TLS),
and exposes an HTTPS endpoint for the client to submit the code for verification.

## Architecture

```
┌───────────┐    HTTPS    ┌───────────┐    TLS/SMTP   ┌────────┐
│  Client   │ ──────────> │  Server   │ ────────────> │ Gmail  │
│ (client/) │ POST /verify│ (server/) │   sends code  │  SMTP  │
└───────────┘             └───────────┘               └────────┘
```

## File Overview

| File                  | Purpose                                                    |
|-----------------------|------------------------------------------------------------|
| `server/totp.js`      | Core TOTP algorithm: HMAC + dynamic truncation             |
| `server/keystore.js`  | Encrypted storage for per-user shared secrets              |
| `server/validator.js` | Code verification with drift, replay protection            |
| `server/mailer.js`    | Gmail SMTP transport over TLS                              |
| `server/server.js`    | Express HTTPS server, ties everything together             |
| `client/client.js`    | CLI tool that POSTs a code to the server for verification  |
| `certs/README.md`     | Instructions for generating self-signed TLS certificates   |
| `.env.example`        | Template for all secrets and config                        |

## Requirements (mapped to RFC 6238)

### R1 — TOTP Algorithm (`totp.js`)
- Implement `TOTP = HOTP(K, T)` where `T = floor((unixTime - T0) / X)`
- T0 = 0 (Unix epoch), X = 30 seconds (RFC 6238 §5.2 RECOMMENDS this)
- Support HMAC-SHA-1 at minimum; HMAC-SHA-256 and HMAC-SHA-512 are optional
- Output a 6-digit code (zero-padded)
- Validate your implementation against Appendix B test vectors:
  - At time=59, SHA-1, 8 digits → 94287082
  - At time=1111111109, SHA-1, 8 digits → 07081804

### R2 — Key Generation & Storage (`keystore.js`)
- Per RFC §5.1: keys SHOULD be random, from a CSPRNG
- Key length SHOULD match HMAC output: 20 bytes for SHA-1
- Per RFC §5.1: keys must be encrypted at rest
  - Encrypt with AES-256-GCM using a server master key
  - Decrypt only at verification time, re-encrypt immediately after
- Each user gets a unique key (RFC §3, R5)

### R3 — Validation (`validator.js`)
- Per RFC §5.2: accept the current time step AND one step back (network delay)
- Per RFC §5.2: a code MUST NOT be accepted twice (replay protection)
  - Track consumed codes per user
- Per RFC §6: track detected clock drift per user for future adjustments

### R4 — Secure Transport
- Server MUST run over HTTPS (self-signed cert is fine for local dev)
  - See `certs/README.md` for generation instructions
- Email sent via Gmail SMTP on port 587 (STARTTLS → TLS upgrade)
  - This satisfies RFC §5.1's "secure channel" requirement for communications

### R5 — Email Delivery (`mailer.js`)
- Use Nodemailer with Gmail SMTP
- Requires a Google App Password (not your regular password)
  - Google Account → Security → 2-Step Verification → App Passwords
- Send the 6-digit code to the user's email address

### R6 — Server Endpoints (`server.js`)
- `POST /request-code` — generates TOTP, emails it, returns success/failure
- `POST /verify` — accepts `{ email, code }`, returns valid/invalid

### R7 — Client (`client.js`)
- Interactive CLI: prompt for email, request a code, then prompt for the code
- POST the code to the server's /verify endpoint over HTTPS

## Setup

```bash
npm install
# Copy .env.example to .env and fill in your values
cp .env.example .env
# Generate self-signed certs (see certs/README.md)
# Start server
node server/server.js
# In another terminal, run the client
node client/client.js
```

## Dependencies You Will Need

- `express` — HTTP server framework
- `nodemailer` — email transport
- `dotenv` — environment variable loading
- `readline` — built-in Node.js module for CLI prompts
- `crypto` — built-in Node.js module (HMAC, AES, randomBytes)
- `https` — built-in Node.js module (TLS server and client)
- `fs` — built-in Node.js module (reading cert files, key storage)

## Stretch Goals (optional)

- [ ] Add HMAC-SHA-256 and HMAC-SHA-512 support
- [ ] Add rate limiting on /verify (lockout after N failed attempts)
- [ ] Persist the keystore to an encrypted file instead of in-memory
- [ ] Add a `/register` endpoint for new users
- [ ] Implement the full resynchronization logic from RFC §6
