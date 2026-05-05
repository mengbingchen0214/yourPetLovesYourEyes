const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE = 'https://api.lemonsqueezy.com/v1/licenses';
const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
};

function post(endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');

    const url = new URL(BASE + endpoint);
    const mod = url.protocol === 'https:' ? https : http;

    const req = mod.request(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

function activate(licenseKey, instanceName) {
  if (!licenseKey) return Promise.reject(new Error('License key is required'));
  const name = instanceName || ('EyePet-' + require('os').hostname().slice(0, 12));
  return post('/activate', { license_key: licenseKey.trim(), instance_name: name });
}

function validate(licenseKey, instanceId) {
  if (!licenseKey) return Promise.reject(new Error('License key is required'));
  const params = { license_key: licenseKey.trim() };
  if (instanceId) params.instance_id = instanceId;
  return post('/validate', params);
}

function deactivate(licenseKey, instanceId) {
  if (!licenseKey || !instanceId) {
    return Promise.reject(new Error('License key and instance ID are required'));
  }
  return post('/deactivate', {
    license_key: licenseKey.trim(),
    instance_id: instanceId
  });
}

function formatError(response) {
  if (!response) return 'Network error or no response';
  if (response.error) return response.error;
  return 'Unknown error';
}

module.exports = { activate, validate, deactivate, formatError, BASE };
