const http = require('http');
const https = require('https');

const apiKey = 'smtp_key_a2b5e7e4d388827c0ec5a078d34a061372c1f2310cd74e19d2238940dab0c63b';
const smtpApiUrl = 'https://mail.prasklatechnology.com/api.php';

async function testProfileId(profileId) {
  return new Promise((resolve) => {
    const testPayload = {
      api_key: apiKey,
      profile_id: profileId,
      to: 'kavinraj.m@prasklatechnology.com',
      slug: 'pymanage-tasks',
      details: {
        fullName: 'Kavinraj M',
        taskTitle: 'Integrate SMTP API Notification',
        taskDescription: 'Test',
        projectName: 'PY Manage',
        createdDate: 'August 22, 2026',
        deadline: '2026-09-15',
        createdBy: 'Assistant'
      }
    };

    const reqData = JSON.stringify({
      ...testPayload,
      variables: testPayload.details,
      ...testPayload.details
    });

    const urlObj = new URL(smtpApiUrl);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
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

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ profileId, statusCode: res.statusCode, body });
      });
    });

    req.on('error', (e) => {
      resolve({ profileId, error: e.message });
    });

    req.write(reqData);
    req.end();
  });
}

async function run() {
  console.log('Probing profile IDs from 1 to 20...');
  for (let id = 1; id <= 20; id++) {
    const result = await testProfileId(id);
    console.log(`Profile ID: ${id} -> Status: ${result.statusCode}, Response: ${result.body || result.error}`);
  }
}

run();
