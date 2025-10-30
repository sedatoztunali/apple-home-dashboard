import { CustomizationManager } from './CustomizationManager';

interface UsageData {
  [entityId: string]: number[]; // Array of timestamps
}

export type InteractionType = 'tap' | 'toggle' | 'more-info';

/**
 * Tracks entity usage/interactions and provides commonly used entities
 */
export class UsageTracker {
  private customizationManager: CustomizationManager;
  private static instance: UsageTracker | null = null;
  private static readonly STORAGE_KEY = 'usage_tracking';
  private static readonly DEFAULT_THRESHOLD = 2; // Minimum interactions to show in commonly used
  private static readonly DEFAULT_HOURS = 24; // Time window for tracking
  private static readonly CLEANUP_INTERVAL_MS = 3600000; // Clean up old data every hour (1 hour)
  private cleanupTimer?: number;

  constructor(customizationManager: CustomizationManager) {
    this.customizationManager = customizationManager;
    this.startCleanupTimer();
  }

  /**
   * Get singleton instance
   */
  static getInstance(customizationManager?: CustomizationManager): UsageTracker {
    if (!UsageTracker.instance) {
      if (!customizationManager) {
        customizationManager = CustomizationManager.getInstance();
      }
      UsageTracker.instance = new UsageTracker(customizationManager);
    }
    return UsageTracker.instance;
  }

  /**
   * Track an interaction with an entity
   */
  async trackInteraction(entityId: string, actionType: InteractionType = 'tap'): Promise<void> {
    if (!entityId) return;

    try {
      await this.customizationManager.ensureCustomizationsLoaded();
      const homeData = this.customizationManager.getCustomization('home');
      
      if (!homeData[UsageTracker.STORAGE_KEY]) {
        homeData[UsageTracker.STORAGE_KEY] = {};
      }

      const usageData: UsageData = homeData[UsageTracker.STORAGE_KEY];
      const now = Date.now();

      // Initialize array if needed
      if (!usageData[entityId]) {
        usageData[entityId] = [];
      }

      // Add current timestamp
      usageData[entityId].push(now);

      // Save back to storage
      await this.customizationManager.setCustomization('home', homeData);
    } catch (error) {
      console.warn('Failed to track entity interaction:', error);
    }
  }

  /**
   * Check if there are any commonly used entities (faster than getCommonlyUsed)
   */
  async hasCommonlyUsed(
    minThreshold: number = UsageTracker.DEFAULT_THRESHOLD,
    hours: number = UsageTracker.DEFAULT_HOURS
  ): Promise<boolean> {
    const commonlyUsed = await this.getCommonlyUsed(minThreshold, hours);
    return commonlyUsed.length > 0;
  }

  /**
   * Get commonly used entities from the last N hours
   * Returns entities sorted by usage frequency (most used first)
   */
  async getCommonlyUsed(
    minThreshold: number = UsageTracker.DEFAULT_THRESHOLD,
    hours: number = UsageTracker.DEFAULT_HOURS
  ): Promise<string[]> {
    try {
      await this.customizationManager.ensureCustomizationsLoaded();
      const homeData = this.customizationManager.getCustomization('home');
      const usageData: UsageData = homeData[UsageTracker.STORAGE_KEY] || {};

      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const entityScores: Array<{ entityId: string; score: number; lastUsed: number }> = [];

      // Process each entity's usage data
      for (const [entityId, timestamps] of Object.entries(usageData)) {
        // Filter timestamps within the time window
        const recentTimestamps = timestamps.filter(ts => ts >= cutoffTime);
        
        if (recentTimestamps.length >= minThreshold) {
          const score = recentTimestamps.length; // Usage count
          const lastUsed = Math.max(...recentTimestamps); // Most recent interaction
          
          entityScores.push({
            entityId,
            score,
            lastUsed
          });
        }
      }

      // Sort by score (frequency) first, then by lastUsed (recency) as tiebreaker
      entityScores.sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score; // Higher score first
        }
        return b.lastUsed - a.lastUsed; // More recent first
      });

      return entityScores.map(item => item.entityId);
    } catch (error) {
      console.warn('Failed to get commonly used entities:', error);
      return [];
    }
  }

  /**
   * Clean up old interaction data (older than 24 hours + 1 day buffer)
   * This prevents storage from growing indefinitely
   */
  private async cleanupOldInteractions(): Promise<void> {
    try {
      await this.customizationManager.ensureCustomizationsLoaded();
      const homeData = this.customizationManager.getCustomization('home');
      const usageData: UsageData = homeData[UsageTracker.STORAGE_KEY] || {};

      // Keep data from the last 48 hours (24h window + 24h buffer)
      const cutoffTime = Date.now() - (48 * 60 * 60 * 1000);
      let hasChanges = false;

      for (const [entityId, timestamps] of Object.entries(usageData)) {
        const filtered = timestamps.filter(ts => ts >= cutoffTime);
        if (filtered.length !== timestamps.length) {
          if (filtered.length === 0) {
            delete usageData[entityId];
          } else {
            usageData[entityId] = filtered;
          }
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.customizationManager.setCustomization('home', homeData);
      }
    } catch (error) {
      console.warn('Failed to cleanup old interactions:', error);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup on initialization
    this.cleanupOldInteractions();
    
    // Set up periodic cleanup
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupOldInteractions();
    }, UsageTracker.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup timer (useful for testing or cleanup)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
