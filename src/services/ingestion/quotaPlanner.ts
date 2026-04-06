import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import {
  INGESTION_PROVIDER_BUDGETS,
  INGESTION_RETRY_BASE_DELAY_MS,
  INGESTION_RETRY_MAX_ATTEMPTS,
  type ProviderName,
} from "../../config/ingestion";
import { sleep } from "../../lib/sleep";

const log = logger.child({ module: "quotaPlanner" });

type MemoryWindowCounter = {
  minuteStart: number;
  minuteCount: number;
  dayStart: number;
  dayCount: number;
};

type ProviderRuntimeState = {
  cooldownUntil: number;
  breakerUntil: number;
  consecutiveFailures: number;
  counters: MemoryWindowCounter;
};

const states = new Map<ProviderName, ProviderRuntimeState>();

function utcMinuteStart(ts = Date.now()): number {
  return Math.floor(ts / 60_000) * 60_000;
}

function utcDayStart(ts = Date.now()): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getState(provider: ProviderName): ProviderRuntimeState {
  const existing = states.get(provider);
  if (existing) return existing;
  const now = Date.now();
  const created: ProviderRuntimeState = {
    cooldownUntil: 0,
    breakerUntil: 0,
    consecutiveFailures: 0,
    counters: {
      minuteStart: utcMinuteStart(now),
      minuteCount: 0,
      dayStart: utcDayStart(now),
      dayCount: 0,
    },
  };
  states.set(provider, created);
  return created;
}

function rolloverCounters(s: ProviderRuntimeState, now: number): void {
  const minuteStart = utcMinuteStart(now);
  const dayStart = utcDayStart(now);
  if (s.counters.minuteStart !== minuteStart) {
    s.counters.minuteStart = minuteStart;
    s.counters.minuteCount = 0;
  }
  if (s.counters.dayStart !== dayStart) {
    s.counters.dayStart = dayStart;
    s.counters.dayCount = 0;
  }
}

export function canUseProvider(provider: ProviderName): { ok: boolean; reason?: string } {
  const cfg = INGESTION_PROVIDER_BUDGETS[provider];
  const s = getState(provider);
  const now = Date.now();
  rolloverCounters(s, now);

  if (s.breakerUntil > now) {
    return { ok: false, reason: "circuit_breaker_open" };
  }
  if (s.cooldownUntil > now) {
    return { ok: false, reason: "cooldown_active" };
  }
  if (s.counters.minuteCount >= cfg.requestsPerMinute) {
    return { ok: false, reason: "minute_budget_exceeded" };
  }
  if (s.counters.dayCount >= cfg.requestsPerDay) {
    return { ok: false, reason: "day_budget_exceeded" };
  }
  return { ok: true };
}

export async function consumeProviderBudget(provider: ProviderName): Promise<boolean> {
  const check = canUseProvider(provider);
  if (!check.ok) return false;
  const s = getState(provider);
  s.counters.minuteCount += 1;
  s.counters.dayCount += 1;

  try {
    const now = new Date();
    const minuteStart = new Date(s.counters.minuteStart);
    const dayStart = new Date(s.counters.dayStart);
    await prisma.$executeRaw`
      INSERT INTO "api_quota_counters" ("id", "provider", "window", "windowStart", "requests", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, ${provider}, 'minute', ${minuteStart}, 1, NOW(), NOW())
      ON CONFLICT ("provider", "window", "windowStart")
      DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
    `;
    await prisma.$executeRaw`
      INSERT INTO "api_quota_counters" ("id", "provider", "window", "windowStart", "requests", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, ${provider}, 'day', ${dayStart}, 1, NOW(), NOW())
      ON CONFLICT ("provider", "window", "windowStart")
      DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
    `;
    await prisma.$executeRaw`
      INSERT INTO "ingestion_item_status" (
        "id","runId","jobName","provider","itemType","itemKey","status","reason","httpStatus","rowsUpserted","createdAt"
      ) VALUES (
        gen_random_uuid()::text, NULL, 'quotaPlanner', ${provider}, 'quota', ${provider}, 'consumed', NULL, NULL, 0, NOW()
      )
    `;
    if (now.getUTCMinutes() % 15 === 0) {
      log.debug({ provider, minuteCount: s.counters.minuteCount, dayCount: s.counters.dayCount }, "Quota consumed");
    }
  } catch (err) {
    log.warn({ err, provider }, "Falha ao persistir contador de quota");
  }
  return true;
}

export function markProvider429(provider: ProviderName): void {
  const cfg = INGESTION_PROVIDER_BUDGETS[provider];
  const s = getState(provider);
  s.cooldownUntil = Date.now() + cfg.cooldownOn429Ms;
}

export function markProviderFailure(provider: ProviderName): void {
  const cfg = INGESTION_PROVIDER_BUDGETS[provider];
  const s = getState(provider);
  s.consecutiveFailures += 1;
  if (s.consecutiveFailures >= cfg.circuitBreakerFailures) {
    s.breakerUntil = Date.now() + cfg.circuitBreakerMs;
    s.consecutiveFailures = 0;
  }
}

export function markProviderSuccess(provider: ProviderName): void {
  const s = getState(provider);
  s.consecutiveFailures = 0;
}

export async function recordFallbackEvent(args: {
  pipeline: string;
  fromProvider: ProviderName;
  toProvider: ProviderName;
  reason: string;
  context?: string;
  sourceStatusCode?: number;
}): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "provider_fallback_events" (
        "id","pipeline","fromProvider","toProvider","reason","context","sourceStatusCode","createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${args.pipeline},
        ${args.fromProvider},
        ${args.toProvider},
        ${args.reason},
        ${args.context ?? null},
        ${args.sourceStatusCode ?? null},
        NOW()
      )
    `;
  } catch (err) {
    log.warn({ err, args }, "Falha ao gravar evento de fallback");
  }
}

export async function recordIngestionItemStatus(args: {
  runId?: string | null;
  jobName: string;
  provider: string;
  itemType: string;
  itemKey: string;
  status: string;
  reason?: string;
  httpStatus?: number;
  rowsUpserted?: number;
}): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "ingestion_item_status" (
        "id","runId","jobName","provider","itemType","itemKey","status","reason","httpStatus","rowsUpserted","createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${args.runId ?? null},
        ${args.jobName},
        ${args.provider},
        ${args.itemType},
        ${args.itemKey},
        ${args.status},
        ${args.reason ?? null},
        ${args.httpStatus ?? null},
        ${args.rowsUpserted ?? 0},
        NOW()
      )
    `;
  } catch (err) {
    log.warn({ err, args }, "Falha ao gravar ingestion_item_status");
  }
}

function isTransientStatus(status?: number): boolean {
  if (!status) return false;
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export async function withRetry<T>(
  provider: ProviderName,
  fn: (attempt: number) => Promise<T>,
): Promise<T | null> {
  for (let attempt = 1; attempt <= INGESTION_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const ok = await consumeProviderBudget(provider);
      if (!ok) return null;
      const result = await fn(attempt);
      markProviderSuccess(provider);
      return result;
    } catch (err) {
      const status =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { status?: number } }).response?.status ?? undefined)
          : undefined;
      if (status === 429) markProvider429(provider);
      markProviderFailure(provider);
      if (attempt >= INGESTION_RETRY_MAX_ATTEMPTS || !isTransientStatus(status)) {
        return null;
      }
      const jitter = Math.floor(Math.random() * 250);
      await sleep(INGESTION_RETRY_BASE_DELAY_MS * attempt + jitter);
    }
  }
  return null;
}
