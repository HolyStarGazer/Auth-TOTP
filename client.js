/**
 * client.js — CLI Client
 *
 * An interactive command-line tool that:
 *   1. Prompts for the user's email
 *   2. Sends a POST to /request-code to trigger the email
 *   3. Prompts for the code they received
 *   4. Sends a POST to /verify and displays the result
 *
 * Since the server uses a self-signed certificate, you'll need
 * to handle that on the client side. See certs/README.md for
 * the two options (NODE_EXTRA_CA_CERTS vs rejectUnauthorized).
 *
 * You will need:
 *   const https = require('https');
 *   const readline = require('readline');
 *
 * Useful references:
 *   - readline: https://nodejs.org/api/readline.html
 *   - https.request: https://nodejs.org/api/https.html#httpsrequesturl-options-callback
 */

const https = require('https');
const readline = require('readline');
const fs = require('fs');
require('dotenv').config();


// ──────────────────────────────────────────────────────
// CONFIGURATION
//
// The server's base URL. Should match your .env settings.
// ──────────────────────────────────────────────────────
const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;

if (!SERVER_HOST || !SERVER_PORT || !TLS_CERT_PATH) {
  console.error('Error: SERVER_HOST, SERVER_PORT, and TLS_CERT_PATH must be set in .env');
  process.exit(1);
}

// ──────────────────────────────────────────────────────
// TLS HANDLING FOR SELF-SIGNED CERTS
//
// Since the server uses a self-signed cert, the client
// won't trust it by default. You have two options:
//
// Option A (recommended): Create an HTTPS agent that trusts
//   your specific cert:
//
//   const agent = new https.Agent({
//     ca: fs.readFileSync('./certs/server.crt')
//   });
//
//   Then pass { agent } in your request options.
//
// Option B (quick and dirty, dev only):
//   const agent = new https.Agent({ rejectUnauthorized: false });
//
// Pick one and set it up here.
// ──────────────────────────────────────────────────────

// set up the HTTPS agent
const agent = new https.Agent({
  ca: fs.readFileSync(TLS_CERT_PATH)
});


// ──────────────────────────────────────────────────────
// READLINE SETUP
//
// Create a readline interface for prompting the user.
//
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });
//
// Useful pattern for async prompts:
//   function prompt(question) {
//     return new Promise(resolve => rl.question(question, resolve));
//   }
// ──────────────────────────────────────────────────────

// set up readline and the prompt helper
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}


/**
 * Makes an HTTPS POST request to the server.
 *
 * @param {string} path - The endpoint path (e.g., '/request-code')
 * @param {object} body - The JSON body to send
 * @returns {Promise<object>} - Parsed JSON response
 */
function postRequest(path, body) {
  // ──────────────────────────────────────────────────────
  // Use https.request() to make a POST to the server.
  //
  // Options should include:
  //   hostname: SERVER_HOST
  //   port: SERVER_PORT
  //   path: path
  //   method: 'POST'
  //   headers: { 'Content-Type': 'application/json' }
  //   agent: <your HTTPS agent from above>
  //
  // Write the JSON body with req.write(JSON.stringify(body))
  // then req.end().
  //
  // Collect the response data in the 'data' event, parse
  // it as JSON, and resolve the promise.
  //
  // Handle errors (connection refused, etc.) gracefully.
  // ──────────────────────────────────────────────────────

  // implement the HTTPS POST request
  const options = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    agent: agent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk); // response arrives in chunks
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);          // connection refused, TLS fail, etc.
    req.write(JSON.stringify(body));
    req.end();                        // nothing sends until you call end()
  });
}


/**
 * Main flow — the interactive session.
 */
async function main() {
  // ──────────────────────────────────────────────────────
  // 1. Prompt: "Enter your email: "
  //    Store the response.
  //
  // 2. Call postRequest('/request-code', { email })
  //    If successful, tell the user to check their inbox.
  //    If it fails, show the error and exit.
  //
  // 3. Prompt: "Enter the code from your email: "
  //    Store the response.
  //
  // 4. Call postRequest('/verify', { email, code })
  //    Display the result — valid or invalid.
  //
  // 5. Close the readline interface (rl.close()).
  //
  // Wrap the whole thing in try/catch for clean error handling.
  // ──────────────────────────────────────────────────────

  // implement the interactive flow
  try {
    const email = await prompt('Enter your email: ');

    const registerResponse = await postRequest('/register', { email });

    switch (registerResponse.statusCode) {
      case 200:
        console.log('Account created');
        break;
      case 409:
        console.log('Welcome back');
        break;
      default:
        console.error(`Failed to request code: ${registerResponse.body.error}`);
        return;
    }

    const requestResponse = await postRequest('/request-code', { email });

    switch (requestResponse.statusCode) {
      case 200:
        console.log('Code sent successfully. Please check your email.');
        break;
      default:
        console.error(`Failed to request code: ${requestResponse.body.error}`);
        return;
    }

    const code = await prompt('Enter the code from your email: ');
    const verifyResponse = await postRequest('/verify', { email, code });

    switch (verifyResponse.statusCode) {
      case 200:
        console.log('Code is valid! Authentication successful.');
        break;
      case 401:
        console.log('Invalid code. Authentication failed.');
        break;
      default:
        console.error(`Failed to verify code: ${verifyResponse.body.error}`);
    }
  } catch (err) {
    console.error('Error during interaction:', err);
  } finally {
    rl.close();
  }
}

main();
