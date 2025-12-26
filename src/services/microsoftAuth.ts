// Microsoft Graph API Authentication Service
// Handles OAuth flow for Microsoft/Outlook integration

const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
const MICROSOFT_TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = `${window.location.origin}/auth/callback`;
const SCOPES = ['Mail.Read', 'Mail.ReadWrite', 'User.Read'].join(' ');

// Storage keys
const TOKEN_STORAGE_KEY = 'ms_access_token';
const REFRESH_TOKEN_KEY = 'ms_refresh_token';
const TOKEN_EXPIRY_KEY = 'ms_token_expiry';
const USER_EMAIL_KEY = 'ms_user_email';

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userEmail: string;
}

export interface MicrosoftUser {
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

// Check if Microsoft OAuth is configured
export function isMicrosoftConfigured(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID);
}

// Get the authorization URL for OAuth flow
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_mode: 'query',
    prompt: 'consent',
  });

  return `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const tokenEndpoint = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    scope: SCOPES,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  // Get user info
  const userInfo = await fetchUserInfo(data.access_token);

  const tokens: MicrosoftTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    userEmail: userInfo.mail || userInfo.userPrincipalName,
  };

  // Store tokens
  saveTokens(tokens);

  return tokens;
}

// Refresh the access token
export async function refreshAccessToken(): Promise<MicrosoftTokens | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    return null;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    scope: SCOPES,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      // Token refresh failed, clear stored tokens
      clearTokens();
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;
    const userEmail = localStorage.getItem(USER_EMAIL_KEY) || '';

    const tokens: MicrosoftTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
      userEmail,
    };

    saveTokens(tokens);
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
}

// Get valid access token (refreshes if needed)
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!accessToken || !expiryStr) {
    return null;
  }

  const expiry = parseInt(expiryStr, 10);

  // If token expires in less than 5 minutes, refresh it
  if (Date.now() > expiry - 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken();
    return newTokens?.accessToken || null;
  }

  return accessToken;
}

// Fetch user info from Microsoft Graph
async function fetchUserInfo(accessToken: string): Promise<MicrosoftUser> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

// Save tokens to localStorage
function saveTokens(tokens: MicrosoftTokens): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, tokens.expiresAt.toString());
  localStorage.setItem(USER_EMAIL_KEY, tokens.userEmail);
}

// Clear stored tokens
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
}

// Check if user is connected
export function isConnected(): boolean {
  return Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
}

// Get stored user email
export function getStoredUserEmail(): string | null {
  return localStorage.getItem(USER_EMAIL_KEY);
}

// Get stored tokens info (for display)
export function getStoredTokenInfo(): { email: string; expiresAt: number } | null {
  const email = localStorage.getItem(USER_EMAIL_KEY);
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!email || !expiryStr) {
    return null;
  }

  return {
    email,
    expiresAt: parseInt(expiryStr, 10),
  };
}

// Disconnect (logout)
export function disconnect(): void {
  clearTokens();
}

// Handle OAuth callback
export async function handleOAuthCallback(): Promise<MicrosoftTokens | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    throw new Error(urlParams.get('error_description') || 'OAuth error');
  }

  if (!code) {
    return null;
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname);

  return tokens;
}
