const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// 1. Resolve configuration (check .env.local, fallback to defaults)
let smtpApiUrl = process.argv[2] || '';
let apiKey = 'smtp_key_843bc38f9bbcdb3f79b8ac63ea2568ee54f0ac577a9235e03ccabb40f5300eeb';

const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const urlMatch = envContent.match(/SMTP_API_URL\s*=\s*["']?([^"'\r\n]+)/);
  const keyMatch = envContent.match(/SMTP_API_KEY\s*=\s*["']?([^"'\r\n]+)/);
  const profileIdMatch = envContent.match(/SMTP_PROFILE_ID\s*=\s*["']?([^"'\r\n]+)/);
  if (urlMatch && !smtpApiUrl) {
    smtpApiUrl = urlMatch[1];
  }
  if (keyMatch) {
    apiKey = keyMatch[1];
  }
  if (profileIdMatch) {
    global.profileId = parseInt(profileIdMatch[1], 10);
  }
}

// Fallback to default local address if still unresolved
if (!smtpApiUrl) {
  smtpApiUrl = 'http://localhost:5000/api/send';
}

console.log('--- Email Test configuration ---');
console.log(`SMTP API URL: ${smtpApiUrl}`);
console.log(`SMTP API KEY: ${apiKey.substring(0, 15)}...`);
console.log('--------------------------------\n');

// 2. Prepare mock payload for tasks template (pymanage-tasks)
const testPayload = {
  to: 'kavinraj.m@prasklatechnology.com',
  slug: 'pymanage-tasks',
  details: {
    fullName: 'Kavinraj M',
    taskTitle: 'Integrate SMTP API Notification',
    taskDescription: 'Configure and test the serverless API routes with the mail server templates.',
    projectName: 'PY Manage Integration Project',
    createdDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    deadline: '2026-09-15',
    createdBy: 'Antigravity Coding Assistant'
  }
};

const reqData = JSON.stringify({
  apiKey: apiKey,
  api_key: apiKey,
  key: apiKey,
  slug: testPayload.slug,
  template: testPayload.slug,
  to: testPayload.to,
  details: testPayload.details,
  variables: testPayload.details,
  ...testPayload.details
});

// 3. Make HTTP/HTTPS request
const isHttps = smtpApiUrl.startsWith('https');
const client = isHttps ? https : http;

const urlObj = new URL(smtpApiUrl);
const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || (isHttps ? 443 : 80),
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    'Origin': 'http://localhost:3000',
    'Content-Length': Buffer.byteLength(reqData)
  }
};

console.log(`Sending HTTP POST request to: ${smtpApiUrl}`);
const req = client.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Response Status Code: ${res.statusCode}`);
    console.log(`Response Headers:`, res.headers);
    console.log(`Response Body: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Request failed: ${e.message}`);
  console.log('\nTroubleshooting tips:');
  console.log('1. Make sure your local email/SMTP server is actually running.');
  console.log('2. Verify the URL port is correct (e.g. check if it is port 5000, 3001, etc.).');
  console.log('3. If the server is on a different URL, pass it as a command line parameter:');
  console.log('   node test-send-sample.js <actual_api_url>');
});

req.write(reqData);
req.end();
