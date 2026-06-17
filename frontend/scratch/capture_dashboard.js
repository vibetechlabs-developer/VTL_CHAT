import http from 'http';
import fs from 'fs';

const BACKEND_URL = 'http://127.0.0.1:8000/api';
const testUser = {
  username: `saas_dev_${Date.now().toString().slice(-4)}`,
  email: `saas_dev_${Date.now()}@example.com`,
  password: 'testpassword123'
};

const getTokensAndCapture = async () => {
  console.log('1. Registering test user on backend...');
  const signupRes = await fetch(`${BACKEND_URL}/users/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  if (signupRes.status !== 201) throw new Error('Signup failed');
  
  console.log('2. Logging in on backend...');
  const loginRes = await fetch(`${BACKEND_URL}/users/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password })
  });
  if (loginRes.status !== 200) throw new Error('Login failed');
  const loginData = await loginRes.json();
  const { access, refresh } = loginData;

  console.log('3. Fetching target browser connection...');
  http.get('http://localhost:9222/json', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', async () => {
      try {
        const targets = JSON.parse(data);
        const target = targets.find(t => t.url.includes('localhost:5173'));
        if (!target) {
          console.error('No localhost:5173 target tab found!');
          return;
        }
        
        const wsUrl = target.webSocketDebuggerUrl;
        const ws = new globalThis.WebSocket(wsUrl);
        
        let msgId = 1;
        const sendCommand = (method, params = {}) => {
          return new Promise((resolve) => {
            const id = msgId++;
            const handler = (event) => {
              const reply = JSON.parse(event.data);
              if (reply.id === id) {
                ws.removeEventListener('message', handler);
                resolve(reply.result);
              }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
          });
        };

        ws.onopen = async () => {
          // Set viewport size
          await sendCommand('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          console.log('4. Navigating to root URL to set localStorage...');
          await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
          await new Promise(r => setTimeout(r, 2000));
          
          console.log('5. Injecting access and refresh tokens...');
          await sendCommand('Runtime.evaluate', {
            expression: `
              localStorage.setItem('access', '${access}');
              localStorage.setItem('refresh', '${refresh}');
            `
          });

          console.log('6. Navigating to Dashboard...');
          await sendCommand('Page.navigate', { url: 'http://localhost:5173/dashboard' });
          
          console.log('7. Waiting for Dashboard to load and render profile...');
          await new Promise(r => setTimeout(r, 4000));
          
          console.log('8. Capturing Screenshot...');
          const result = await sendCommand('Page.captureScreenshot', { format: 'png' });
          
          const buffer = Buffer.from(result.data, 'base64');
          fs.writeFileSync('scratch/dashboard_verification.png', buffer);
          console.log('9. Dashboard screenshot saved to scratch/dashboard_verification.png');
          
          ws.close();
        };
      } catch (e) {
        console.error('Error in Chrome navigation:', e);
      }
    });
  }).on('error', (err) => {
    console.error('HTTP error connecting to Chrome debugging:', err);
  });
};

getTokensAndCapture().catch(console.error);
