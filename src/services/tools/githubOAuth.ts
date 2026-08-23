import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../utils/logger';

const GITHUB_CLIENT_ID = 'Ov23liA5R4zXtXXXXXXX'; // TODO: Set via env or config
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const TOKEN_STORAGE_KEY = 'github_oauth_token';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Step 1: Request device code from GitHub OAuth device flow
 */
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&scope=repo`,
  });

  if (!response.ok) {
    throw new Error(`Failed to request device code: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data as DeviceCodeResponse;
}

/**
 * Step 2: Poll GitHub for access token
 * Polls every `interval` seconds for up to `expires_in` seconds
 */
async function pollForAccessToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<AccessTokenResponse> {
  const startTime = Date.now();
  const expiryTime = startTime + expiresIn * 1000;

  while (Date.now() < expiryTime) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    try {
      const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&device_code=${encodeURIComponent(
          deviceCode,
        )}&grant_type=urn:ietf:params:oauth:grant-type:device_flow`,
      });

      if (!response.ok) {
        if (response.status === 400) {
          // Authorization pending, continue polling
          continue;
        }
        throw new Error(`Failed to poll token: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data as AccessTokenResponse;
    } catch (error) {
      logger.error('[GitHub OAuth] Polling error:', error);
      // Continue polling on network errors
    }
  }

  throw new Error('Device code expired before user authorization');
}

/**
 * Step 3: Save token to secure storage
 */
async function saveToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (error) {
    logger.error('[GitHub OAuth] Failed to save token:', error);
    throw error;
  }
}

/**
 * Retrieve stored GitHub OAuth token
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.error('[GitHub OAuth] Failed to retrieve token:', error);
    return null;
  }
}

/**
 * Clear stored GitHub OAuth token
 */
export async function clearStoredToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.error('[GitHub OAuth] Failed to clear token:', error);
  }
}

/**
 * Step 4: Use token to push file to GitHub repository
 * PUT /repos/{owner}/{repo}/contents/{path}
 */
export async function pushFileToGitHub(
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  message: string,
  branch: string = 'main',
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const token = await getStoredToken();
    if (!token) {
      return { success: false, error: 'No GitHub token available. Please authenticate first.' };
    }

    // Get the current file (if it exists) to get its SHA
    let currentFileSha: string | undefined;
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        },
      );

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        currentFileSha = fileData.sha;
      }
    } catch (error) {
      // File may not exist yet, that's ok
      logger.warn('[GitHub OAuth] Could not fetch current file:', error);
    }

    // Encode content as base64
    const encodedContent = Buffer.from(content).toString('base64');

    const putBody = {
      message,
      content: encodedContent,
      branch,
      ...(currentFileSha ? { sha: currentFileSha } : {}),
    };

    const putResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putBody),
      },
    );

    if (!putResponse.ok) {
      const errorData = await putResponse.text();
      return {
        success: false,
        error: `GitHub API error: ${putResponse.status} - ${errorData}`,
      };
    }

    const result = await putResponse.json();
    return {
      success: true,
      url: result.content?.html_url,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Main handler: Initialize GitHub OAuth device flow
 * Shows user code to enter at github.com/login/device
 * Polls for token and saves it to AsyncStorage
 */
export async function handleGitHubOAuth(): Promise<string> {
  try {
    logger.info('[GitHub OAuth] Initiating device flow...');

    // Step 1: Request device code
    const deviceCodeData = await requestDeviceCode();

    const userCode = deviceCodeData.user_code;
    const deviceCode = deviceCodeData.device_code;
    const interval = deviceCodeData.interval || 5;
    const expiresIn = deviceCodeData.expires_in || 900;

    const statusMsg = `🔐 GitHub OAuth - Device Flow

1️⃣  Visit: ${deviceCodeData.verification_uri}
2️⃣  Enter code: ${userCode}
3️⃣  Waiting for authorization... (expires in ${expiresIn}s)`;

    logger.info('[GitHub OAuth]', statusMsg);

    // Step 2: Poll for access token
    logger.info('[GitHub OAuth] Polling for token...');
    const tokenResponse = await pollForAccessToken(deviceCode, interval, expiresIn);

    if (tokenResponse.error) {
      throw new Error(
        `OAuth error: ${tokenResponse.error} - ${tokenResponse.error_description || 'Unknown'}`,
      );
    }

    if (!tokenResponse.access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Step 3: Save token
    await saveToken(tokenResponse.access_token);

    const successMsg = `✅ GitHub OAuth Complete
Token saved securely to AsyncStorage
Scope: ${tokenResponse.scope || 'repo'}`;

    logger.info('[GitHub OAuth]', successMsg);
    return successMsg;
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown GitHub OAuth error';
    logger.error('[GitHub OAuth] Error:', errorMsg);
    throw error;
  }
}
