import { Hono } from 'hono';

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_REDIRECT_URI: string;
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ');

export const oauthRoutes = new Hono<{ Bindings: Env }>();

// Generate OAuth URL for Google Calendar
oauthRoutes.get('/google/start', async (c) => {
  const userId = c.req.query('user_id');
  
  if (!userId) {
    return c.json({ error: 'user_id required' }, 400);
  }
  
  const state = btoa(JSON.stringify({ userId }));
  
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  
  return c.json({ url: authUrl });
});

// Handle OAuth callback
oauthRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  if (error) {
    return c.html(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2>Connection Failed</h2>
          <p>${error}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  }
  
  if (!code || !state) {
    return c.html(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2>Missing Parameters</h2>
          <p>Something went wrong. Please try again.</p>
        </body>
      </html>
    `);
  }
  
  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(atob(state));
    userId = decoded.userId;
  } catch {
    return c.html(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2>Invalid State</h2>
          <p>Something went wrong. Please try again.</p>
        </body>
      </html>
    `);
  }
  
  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: c.env.OAUTH_REDIRECT_URI
      })
    });
    
    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Token exchange failed:', err);
      throw new Error('Token exchange failed');
    }
    
    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };
    
    // Calculate expiry time
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    
    // Store tokens in D1
    await c.env.DB.prepare(`
      INSERT INTO google_tokens (user_id, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = datetime('now')
    `).bind(
      userId,
      tokens.access_token,
      tokens.refresh_token || null,
      expiresAt
    ).run();
    
    return c.html(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center; background: #1a1a2e; color: white;">
          <h2 style="color: #818cf8;">✓ Calendar Connected!</h2>
          <p>BethAiny can now access your Google Calendar.</p>
          <p style="color: #888;">You can close this window and return to the chat.</p>
          <script>
            // Try to close the window after a moment
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
    
  } catch (err: any) {
    console.error('OAuth error:', err);
    return c.html(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2>Connection Failed</h2>
          <p>${err.message}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
});

// Check connection status
oauthRoutes.get('/google/status', async (c) => {
  const userId = c.req.query('user_id');
  
  if (!userId) {
    return c.json({ error: 'user_id required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'SELECT expires_at FROM google_tokens WHERE user_id = ?'
  ).bind(userId).first<{ expires_at: number }>();
  
  if (!result) {
    return c.json({ connected: false });
  }
  
  return c.json({ 
    connected: true,
    expires_at: result.expires_at
  });
});

// Disconnect
oauthRoutes.delete('/google/disconnect', async (c) => {
  const userId = c.req.query('user_id');
  
  if (!userId) {
    return c.json({ error: 'user_id required' }, 400);
  }
  
  await c.env.DB.prepare(
    'DELETE FROM google_tokens WHERE user_id = ?'
  ).bind(userId).run();
  
  return c.json({ disconnected: true });
});
