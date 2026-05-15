import Redis from "ioredis";

let client: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    client.on("error", () => {
      // Redis unavailable — fall through to live API calls
      client = null;
    });
  }

  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // silently fail — cache is best-effort
  }
}

// Permanent storage (no TTL) — used for manual admin overrides
export async function cacheSetPermanent(key: string, value: unknown): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    await redis.set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch {
    // silent
  }
}
