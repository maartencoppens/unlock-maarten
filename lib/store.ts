import { Redis } from "@upstash/redis";

// Tellers voor de rate limits. Upstash Redis als die werkt, anders in het geheugen.
// Faalt Redis (bv. database weg of offline), dan schakelen we meteen over en proberen
// we pas na een minuut opnieuw: zo wacht niemand seconden op een time-out.

// De Vercel-integratie maakt variabelen met een prefix aan (…_KV_REST_API_URL/TOKEN).
// Die gaan voor, zodat een oude UPSTASH_REDIS_REST_URL nooit naar een verdwenen database wijst.
const url =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
  process.env.KV_REST_API_URL ??
  process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token, retry: false }) : null;

const REDIS_TIMEOUT_MS = 1500;
const RETRY_AFTER_MS = 60_000;
let redisDownUntil = 0;

type Entry = { count: number; expires: number };
const globalForMemory = globalThis as unknown as { __umCounters?: Map<string, Entry> };
const memory = (globalForMemory.__umCounters ??= new Map<string, Entry>());

function memoryIncrement(key: string, ttlSeconds: number) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.expires < now) {
    memory.set(key, { count: 1, expires: now + ttlSeconds * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function redisIncrement(key: string, ttlSeconds: number) {
  if (!redis) throw new Error("no redis");
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("redis timeout")), REDIS_TIMEOUT_MS),
  );
  const work = (async () => {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  })();
  return Promise.race([work, timeout]);
}

/** Teller die na `ttlSeconds` vervalt. Geeft de nieuwe waarde terug. */
export async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  const fullKey = `um:count:${key}`;
  if (redis && Date.now() > redisDownUntil) {
    try {
      return await redisIncrement(fullKey, ttlSeconds);
    } catch (error) {
      redisDownUntil = Date.now() + RETRY_AFTER_MS;
      console.warn("Upstash onbereikbaar, tijdelijk tellers in het geheugen:", (error as Error).message);
    }
  }
  return memoryIncrement(fullKey, ttlSeconds);
}
