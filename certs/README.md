# Generating Self-Signed TLS Certificates

RFC 6238 §5.1 requires all communications over a secure channel (SSL/TLS).
For local development, a self-signed certificate satisfies this.

## Generate with OpenSSL

Run this from the `certs/` directory (single line - works in PowerShell, cmd, and bash):

```bash
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/CN=localhost"
```

This creates:
- `server.key` — your private key (keep this secret)
- `server.crt` — your self-signed certificate

## What this does

- `-x509` creates a self-signed cert (not a signing request)
- `-newkey rsa:2048` generates a new 2048-bit RSA key
- `-nodes` means no passphrase on the key (fine for local dev)
- `-subj "/CN=localhost"` sets the common name to localhost

## Client-side note

Because this cert is self-signed, your client will need to either:
1. Set `rejectUnauthorized: false` in the HTTPS agent (development only!), or
2. Point `NODE_EXTRA_CA_CERTS` env var at `server.crt`

Option 2 is the more correct approach. Option 1 is quicker but would
never be acceptable outside local development.

## Files in this directory

After generation:
- `server.crt` — ✅ safe to share / commit (it's public)
- `server.key` — ❌ NEVER commit this to version control
