import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  storeId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

export function generateRefreshToken(payload: Pick<TokenPayload, 'userId' | 'storeId'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): Pick<TokenPayload, 'userId' | 'storeId'> {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as Pick<TokenPayload, 'userId' | 'storeId'>;
}
