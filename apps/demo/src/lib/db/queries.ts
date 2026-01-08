// Database Query Functions for Clara Voice Agent

import { prisma } from "./prisma";

// ============================================
// SESSION TRACKING
// ============================================

/**
 * Create a new session when user starts conversation
 */
export async function createSession(data: {
  sessionToken: string;
  deviceType: "desktop" | "mobile";
  userId?: string;
  shopifyEmail?: string;
}) {
  return await prisma.session.create({
    data: {
      ...data,
      status: "active",
    },
  });
}

/**
 * Update session status and end time
 */
export async function endSession(
  sessionToken: string,
  status: "completed" | "error" | "timeout",
) {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { conversations: true },
  });

  if (!session) return null;

  // Calculate duration
  const durationSeconds = Math.floor(
    (new Date().getTime() - session.createdAt.getTime()) / 1000,
  );

  return await prisma.session.update({
    where: { sessionToken },
    data: {
      status,
      endedAt: new Date(),
      durationSeconds,
    },
  });
}

/**
 * Get session by token
 */
export async function getSession(sessionToken: string) {
  return await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      conversations: true,
      analytics: true,
    },
  });
}

// ============================================
// CONVERSATION TRACKING
// ============================================

/**
 * Save conversation exchange
 */
export async function saveConversation(data: {
  sessionId: string;
  userMessage?: string;
  agentResponse?: string;
  productsReferred?: string[];
}) {
  return await prisma.conversation.create({
    data,
  });
}

/**
 * Get all conversations for a session
 */
export async function getSessionConversations(sessionId: string) {
  return await prisma.conversation.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });
}

// ============================================
// SESSION ANALYTICS
// ============================================

/**
 * Create or update session analytics
 */
export async function upsertSessionAnalytics(
  sessionId: string,
  data: {
    messagesExchanged?: number;
    averageResponseTime?: number;
    productsRecommended?: string[];
    skinConcernsAddress?: string[];
    leadQuality?: "high" | "medium" | "low";
    conversionIntent?: "high" | "medium" | "low" | "none";
  },
) {
  return await prisma.sessionAnalytics.upsert({
    where: { sessionId },
    update: data,
    create: {
      sessionId,
      ...data,
    },
  });
}

/**
 * Increment message count for session analytics
 */
export async function incrementMessageCount(sessionId: string) {
  const existing = await prisma.sessionAnalytics.findUnique({
    where: { sessionId },
  });

  if (existing) {
    return await prisma.sessionAnalytics.update({
      where: { sessionId },
      data: {
        messagesExchanged: existing.messagesExchanged + 1,
      },
    });
  }

  return await prisma.sessionAnalytics.create({
    data: {
      sessionId,
      messagesExchanged: 1,
    },
  });
}

// ============================================
// SHOPIFY CUSTOMER CACHE
// ============================================

/**
 * Get cached Shopify customer data
 */
export async function getCachedCustomer(shopifyEmail: string) {
  const cached = await prisma.shopifyCustomerCache.findUnique({
    where: { shopifyEmail },
  });

  // Check if cache is expired
  if (cached && cached.expiresAt > new Date()) {
    return cached;
  }

  // Expired or not found
  return null;
}

/**
 * Cache Shopify customer data (TTL: 24 hours)
 */
export async function cacheCustomer(data: {
  shopifyEmail: string;
  shopifyId?: string;
  firstName?: string;
  lastName?: string;
  skinType?: string;
  skinConcerns?: string[];
  ordersCount?: number;
}) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour TTL

  return await prisma.shopifyCustomerCache.upsert({
    where: { shopifyEmail: data.shopifyEmail },
    update: {
      ...data,
      cachedAt: new Date(),
      expiresAt,
    },
    create: {
      ...data,
      expiresAt,
    },
  });
}

/**
 * Invalidate customer cache (force refresh)
 */
export async function invalidateCustomerCache(shopifyEmail: string) {
  return await prisma.shopifyCustomerCache.delete({
    where: { shopifyEmail },
  });
}

// ============================================
// PRODUCT ANALYTICS
// ============================================

/**
 * Track product mention
 */
export async function trackProductMention(data: {
  productId: string;
  productName?: string;
  sessionId?: string;
  context?: "recommendation" | "inquiry" | "purchase_intent";
}) {
  return await prisma.productMention.create({
    data,
  });
}

/**
 * Get top mentioned products (last 30 days)
 */
export async function getTopProducts(limit: number = 10) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await prisma.productMention.groupBy({
    by: ["productId", "productName"],
    where: {
      mentioned: {
        gte: thirtyDaysAgo,
      },
    },
    _count: {
      productId: true,
    },
    orderBy: {
      _count: {
        productId: "desc",
      },
    },
    take: limit,
  });
}

// ============================================
// DAILY METRICS
// ============================================

/**
 * Update daily metrics
 */
export async function updateDailyMetrics(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Count sessions for the day
  const sessions = await prisma.session.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const completedSessions = sessions.filter(
    (s: any) => s.status === "completed",
  );

  const totalDuration = completedSessions.reduce(
    (sum: number, s: any) => sum + (s.durationSeconds || 0),
    0,
  );
  const averageDuration =
    completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

  const uniqueUsers = new Set(
    sessions.filter((s: any) => s.shopifyEmail).map((s: any) => s.shopifyEmail),
  ).size;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const conversations = await prisma.conversation.count({
    where: {
      timestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const productMentions = await prisma.productMention.count({
    where: {
      mentioned: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return await prisma.dailyMetrics.upsert({
    where: { date: startOfDay },
    update: {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageDuration,
      uniqueUsers,
      totalConversations: conversations,
      totalProductMentions: productMentions,
    },
    create: {
      date: startOfDay,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageDuration,
      uniqueUsers,
      totalConversations: conversations,
      totalProductMentions: productMentions,
    },
  });
}

/**
 * Get metrics for date range
 */
export async function getMetricsForRange(startDate: Date, endDate: Date) {
  return await prisma.dailyMetrics.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: "asc",
    },
  });
}

// ============================================
// ANALYTICS QUERIES
// ============================================

/**
 * Get recent sessions with analytics
 */
export async function getRecentSessions(limit: number = 20) {
  return await prisma.session.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      analytics: true,
      conversations: {
        take: 5,
        orderBy: { timestamp: "desc" },
      },
    },
  });
}

/**
 * Get session stats summary
 */
export async function getSessionStats() {
  const total = await prisma.session.count();
  const completed = await prisma.session.count({
    where: { status: "completed" },
  });
  const active = await prisma.session.count({
    where: { status: "active" },
  });

  const avgDuration = await prisma.session.aggregate({
    _avg: {
      durationSeconds: true,
    },
    where: {
      status: "completed",
    },
  });

  return {
    total,
    completed,
    active,
    averageDurationSeconds: avgDuration._avg.durationSeconds || 0,
  };
}
