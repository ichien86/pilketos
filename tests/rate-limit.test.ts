import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  isRateLimited,
  recordHit,
  clearRateLimit,
} from "@/lib/rate-limit";

describe("Rate Limiter Utility", () => {
  const TEST_KEY = "test:user:123";

  beforeEach(() => {
    clearRateLimit(TEST_KEY);
  });

  it("isRateLimited tidak menambah hit dan mengembalikan sisa percobaan", () => {
    const res1 = isRateLimited(TEST_KEY, 3, 60);
    expect(res1.limited).toBe(false);
    if (!res1.limited) {
      expect(res1.remaining).toBe(3);
    }

    // Panggil beberapa kali, tetap tidak menambah hit
    const res2 = isRateLimited(TEST_KEY, 3, 60);
    expect(res2.limited).toBe(false);
    if (!res2.limited) {
      expect(res2.remaining).toBe(3);
    }
  });

  it("recordHit mencatat kegagalan sampai limit tercapai", () => {
    recordHit(TEST_KEY);
    const check1 = isRateLimited(TEST_KEY, 2, 60);
    expect(check1.limited).toBe(false);
    if (!check1.limited) {
      expect(check1.remaining).toBe(1);
    }

    recordHit(TEST_KEY);
    const check2 = isRateLimited(TEST_KEY, 2, 60);
    expect(check2.limited).toBe(true);
    if (check2.limited) {
      expect(check2.retryAfter).toBeGreaterThan(0);
    }
  });

  it("clearRateLimit mereset riwayat kegagalan", () => {
    recordHit(TEST_KEY);
    recordHit(TEST_KEY);
    expect(isRateLimited(TEST_KEY, 2, 60).limited).toBe(true);

    clearRateLimit(TEST_KEY);
    const check = isRateLimited(TEST_KEY, 2, 60);
    expect(check.limited).toBe(false);
    if (!check.limited) {
      expect(check.remaining).toBe(2);
    }
  });

  it("checkRateLimit tetap menambah hit pada setiap panggilan (kompatibilitas mundur)", () => {
    const key = "test:check:456";
    clearRateLimit(key);

    const hit1 = checkRateLimit(key, 2, 60);
    expect(hit1.limited).toBe(false);
    if (!hit1.limited) {
      expect(hit1.remaining).toBe(1);
    }

    const hit2 = checkRateLimit(key, 2, 60);
    expect(hit2.limited).toBe(false);
    if (!hit2.limited) {
      expect(hit2.remaining).toBe(0);
    }

    const hit3 = checkRateLimit(key, 2, 60);
    expect(hit3.limited).toBe(true);
  });
});
