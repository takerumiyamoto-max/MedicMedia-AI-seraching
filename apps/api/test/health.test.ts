import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/env.js';

describe('GET /health', () => {
  it('returns ok: true', async () => {
    const env: Env = {
      PORT: 3001,
      HOST: '0.0.0.0',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent'
    };

    const app = buildApp(env);
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });
});