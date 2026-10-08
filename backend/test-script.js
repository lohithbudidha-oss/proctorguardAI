async function runTests() {
  const baseURL = 'http://localhost:5000/api';

  try {
    console.log('--- TEST REM-08: SESSION REVOCATION ---');
    // 0. Register
    const regName = 'TestAdmin' + Date.now();
    const regEmail = `admin_${Date.now()}@example.com`;
    await fetch(`${baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regName, email: regEmail, password: 'password123' })
    });

    // 1. Login
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail, password: 'password123' })
    });
    const loginData = await loginRes.json();
    
    if (!loginData.success) {
      console.log('Login failed (seed data missing or wrong credentials):', loginData);
      return;
    }

    const token = loginData.token;
    console.log('Login successful. Token acquired.');

    // 2. Use token
    const dashRes = await fetch(`${baseURL}/admin/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    const dashData = await dashRes.json();
    console.log('API call with active token:', dashData.success ? 'PASS' : 'FAIL');

    // 3. Logout
    await fetch(`${baseURL}/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    console.log('Logout successful.');

    // 4. Reuse token
    const failRes = await fetch(`${baseURL}/admin/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (failRes.status === 401) {
      console.log('PASS: Token rejected after logout with 401.');
    } else {
      console.log('FAIL: Token was reused successfully after logout.', failRes.status);
    }
  } catch (err) {
    console.error('Test script error:', err);
  }
}

runTests();
