import { kv } from "@vercel/kv";

/**
 * Check if an IP is blacklisted
 */
export async function isBlacklisted(ip: string): Promise<boolean> {
  const result = await kv.get(`blacklist:${ip}`);
  return result === "true";
}

/**
 * Blacklist an IP address for a specific duration
 * @param ip - IP address to blacklist
 * @param durationSec - Duration in seconds (default: 24 hours)
 */
export async function blacklistIP(
  ip: string,
  durationSec: number = 86400,
): Promise<void> {
  await kv.set(`blacklist:${ip}`, "true", { ex: durationSec });
  console.log(`[BLACKLIST] IP ${ip} blacklisted for ${durationSec}s`);
}

/**
 * Remove an IP from the blacklist
 */
export async function removeFromBlacklist(ip: string): Promise<void> {
  await kv.del(`blacklist:${ip}`);
  console.log(`[BLACKLIST] IP ${ip} removed from blacklist`);
}

/**
 * Get all blacklisted IPs
 */
export async function getAllBlacklistedIPs(): Promise<string[]> {
  const keys = await kv.keys("blacklist:*");
  return keys.map((key) => key.replace("blacklist:", ""));
}
