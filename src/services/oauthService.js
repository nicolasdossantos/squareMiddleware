/**
 * Square OAuth Service
 * Handles state decoding and token exchange for the Square OAuth callback
 */

const crypto = require('crypto');
const { Client: SquareClient, Environment } = require('square/legacy');
const { logger } = require('../utils/logger');

/**
 * Decode OAuth state parameter supporting plain strings or base64url encoded JSON.
 * @param {string} state - State string received from Square.
 * @returns {{ raw: string|null, data: object|null, isDecoded: boolean }}
 */
function decodeState(state) {
  if (!state || typeof state !== 'string') {
    return {
      raw: null,
      data: null,
      isDecoded: false
    };
  }

  // Preserve original string for debugging
  const trimmed = state.trim();

  // Try base64url decoding first
  try {
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const buffer = Buffer.from(padded, 'base64');
    const json = buffer.toString('utf8');
    const data = JSON.parse(json);

    if (data && typeof data === 'object') {
      return {
        raw: trimmed,
        data,
        isDecoded: true
      };
    }
  } catch (error) {
    logger.debug('OAuth state not base64 encoded', { message: error.message });
  }

  // Attempt to parse raw string as JSON
  try {
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object') {
      return {
        raw: trimmed,
        data,
        isDecoded: true
      };
    }
  } catch (error) {
    logger.debug('OAuth state not JSON encoded', { message: error.message });
  }

  return {
    raw: trimmed,
    data: null,
    isDecoded: false
  };
}

/**
 * Exchange authorization code for Square OAuth tokens.
 * @param {object} params
 * @param {string} params.code - Authorization code from Square.
 * @param {string} params.clientId - Square application ID.
 * @param {string} params.clientSecret - Square application secret.
 * @param {string} params.environment - 'sandbox' or 'production'.
 * @param {string} [params.redirectUri] - Redirect URI that was used in the OAuth flow.
 * @returns {Promise<object>} Square OAuth token response.
 */
async function exchangeCodeForTokens({ code, clientId, clientSecret, environment, redirectUri }) {
  if (!clientId || !clientSecret) {
    const error = new Error('Square OAuth client credentials are not configured');
    error.statusCode = 500;
    throw error;
  }

  if (!code) {
    const error = new Error('Authorization code is required to obtain Square OAuth tokens');
    error.statusCode = 400;
    throw error;
  }

  const squareEnvironment =
    environment === 'production' || environment === 'live' ? Environment.Production : Environment.Sandbox;

  logger.info('Exchanging Square OAuth authorization code', {
    environment: squareEnvironment === Environment.Production ? 'production' : 'sandbox'
  });

  const client = new SquareClient({
    environment: squareEnvironment
  });

  const body = {
    clientId,
    clientSecret,
    code,
    grantType: 'authorization_code'
  };

  if (redirectUri) {
    body.redirectUri = redirectUri;
  }

  try {
    const response = await client.oAuthApi.obtainToken(body);
    const { result } = response || {};

    if (!result) {
      throw new Error('Square OAuth token exchange returned an empty response');
    }

    // Do not log sensitive tokens
    logger.info('Square OAuth token exchange succeeded', {
      merchantId: result.merchantId,
      expiresAt: result.expiresAt,
      tokenType: result.tokenType
    });

    return result;
  } catch (error) {
    logger.error('Failed to exchange Square OAuth authorization code', {
      statusCode: error.statusCode,
      category: error?.errors?.[0]?.category,
      detail: error?.errors?.[0]?.detail
    });

    if (!error.statusCode) {
      error.statusCode = 502;
    }

    throw error;
  }
}

/**
 * Generate a secure nonce for OAuth state payloads.
 * @param {number} size - Buffer size (bytes)
 * @returns {string} Hex encoded nonce
 */
function generateNonce(size = 16) {
  return crypto.randomBytes(size).toString('hex');
}

/**
 * Fetch seller booking profile and location metadata using the new OAuth token.
 * Gracefully handles missing scopes by returning partial data.
 * @param {object} params
 * @param {string} params.accessToken - Seller access token from OAuth exchange.
 * @param {string} params.environment - 'sandbox' or 'production'.
 * @returns {Promise<object>} Seller metadata.
 */
async function fetchSellerMetadata({ accessToken, environment = 'sandbox' }) {
  if (!accessToken) {
    throw new Error('Access token is required to fetch seller metadata');
  }

  const squareEnvironment =
    environment === 'production' || environment === 'live' ? Environment.Production : Environment.Sandbox;

  const client = new SquareClient({
    accessToken,
    environment: squareEnvironment
  });

  let bookingProfile = null;
  let locations = [];
  let merchantId = null;

  try {
    const profileResponse = await client.bookingsApi.retrieveBusinessBookingProfile();
    bookingProfile = profileResponse?.result?.businessBookingProfile || null;
    merchantId = bookingProfile?.merchantId || null;
  } catch (error) {
    logger.warn('Failed to retrieve business booking profile', {
      message: error.message,
      statusCode: error.statusCode
    });
  }

  try {
    const locationsResponse = await client.locationsApi.listLocations();
    locations = locationsResponse?.result?.locations || [];

    if (!merchantId) {
      merchantId = locations[0]?.merchantId || null;
    }
  } catch (error) {
    logger.warn('Failed to list locations for OAuth onboarding', {
      message: error.message,
      statusCode: error.statusCode
    });
  }

  const defaultLocationId =
    bookingProfile?.locationId || bookingProfile?.defaultAppointmentLocationId || locations[0]?.id || null;

  const locationSummaries = locations.map(location => ({
    id: location.id,
    name: location.name,
    status: location.status,
    timezone: location.timezone,
    address: location.address
      ? {
          addressLine1: location.address.addressLine1,
          locality: location.address.locality,
          administrativeDistrictLevel1: location.address.administrativeDistrictLevel1,
          postalCode: location.address.postalCode,
          country: location.address.country
        }
      : null
  }));

  return {
    merchantId,
    bookingProfile,
    locations: locationSummaries,
    defaultLocationId,
    supportsSellerLevelWrites: Boolean(bookingProfile?.supportSellerLevelWrites),
    timezone:
      bookingProfile?.timezone || locations.find(loc => loc.id === defaultLocationId)?.timezone || null,
    displayName:
      bookingProfile?.businessName ||
      bookingProfile?.displayName ||
      locations.find(loc => loc.id === defaultLocationId)?.name ||
      null
  };
}

module.exports = {
  decodeState,
  exchangeCodeForTokens,
  generateNonce,
  fetchSellerMetadata
};
