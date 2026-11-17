import dotenv from 'dotenv';

// Ensure environment variables are loaded if not already present
if (!process.env.JWT_SECRET) {
  dotenv.config();
}

/**
 * Returns the unified JWT secret from environment variables.
 * Fails safely with a clear configuration error if JWT_SECRET is missing.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    dotenv.config();
    const reloaded = process.env.JWT_SECRET;
    if (!reloaded) {
      throw new Error(
        '[JWT Configuration Error] JWT_SECRET is not set in environment variables. ' +
        'Please define JWT_SECRET in your .env file or deployment platform configuration.'
      );
    }
    return reloaded;
  }
  return secret;
};



