const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

async function doFetch(url, options) {
  if (typeof fetch === 'function') {
    return fetch(url, options);
  }
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url, options);
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/sdk', express.static(path.join(__dirname, 'node_modules', 'retell-client-js-sdk', 'dist')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));

app.post('/api/retell/start', async (req, res) => {
  try {
    // eslint-disable-next-line no-console
    console.log('POST /api/retell/start invoked');
    const { userId } = req.body || {};

    const useMock = String(process.env.USE_MOCK_TOKEN).toLowerCase() === 'true';
    if (useMock) {
      // Return a shape that the frontend understands and a mock flag
      return res.json({ mock: true, access_token: 'mock-access-token', call_id: 'mock-call-id' });
    }

    const apiKey = process.env.RETELL_API_KEY || process.env.RETELL_API_TOKEN || process.env.RETELL_KEY;
    const agentId = process.env.RETELL_AGENT_ID || process.env.AGENT_ID || process.env.RETELL_AGENT;
    if (!apiKey || !agentId) {
      // eslint-disable-next-line no-console
      console.error('Missing envs: apiKey?', !!apiKey, 'agentId?', !!agentId, 'available keys:', Object.keys(process.env).filter(k => /RETELL|AGENT/i.test(k)));
      return res.status(500).json({ error: 'RETELL_API_KEY or RETELL_AGENT_ID missing' });
    }

    const baseUrl = process.env.RETELL_API_BASE || 'https://api.retellai.com';
    const v2Url = baseUrl.replace(/\/$/, '') + '/v2/create-web-call';
    const payload = { agent_id: agentId, agentId: agentId, metadata: { userId: userId || 'anonymous' } };
    let resp = await doFetch(v2Url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const text = await resp.text();
      // try v1 fallback if 404/400
      const v1Url = baseUrl.replace(/\/$/, '') + '/v1/create-web-call';
      // eslint-disable-next-line no-console
      console.warn('v2 create-web-call failed, trying v1...', resp.status);
      resp = await doFetch(v1Url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const text2 = await resp.text();
        // eslint-disable-next-line no-console
        console.error('Retell create-web-call failed:', resp.status, text, '| v1:', text2);
        return res.status(500).json({ error: 'Retell create-web-call failed', status: resp.status, detail: text2 || text });
      }
    }
    const data = await resp.json();
    // Expect data to include access_token and call_id
    return res.json({ access_token: data.access_token, call_id: data.call_id });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Server error /api/retell/start:', error);
    return res.status(500).json({ error: 'Failed to start Retell session', detail: String(error && error.message || error) });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});


