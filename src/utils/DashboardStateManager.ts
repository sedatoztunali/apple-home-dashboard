/**
 * DashboardStateManager - Manages dashboard enter/leave state for other managers
 */
export class DashboardStateManager {
  private static instance: DashboardStateManager | null = null;
  private isActive = false;
  private dashboardUrl: string | null = null;
  private listeners: Set<(isActive: boolean) => void> = new Set();

  private constructor() {
    // Check initial state
    const currentPath = window.location.pathname;
    if (this.isCurrentlyInDashboard()) {
      this.setDashboardActive(currentPath);
    }
    
    this.setupNavigationListeners();
  }

  static getInstance(): DashboardStateManager {
    if (!DashboardStateManager.instance) {
      DashboardStateManager.instance = new DashboardStateManager();
    }
    return DashboardStateManager.instance;
  }

  /**
   * Register a listener for dashboard state changes
   */
  addListener(callback: (isActive: boolean) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove a listener
   */
  removeListener(callback: (isActive: boolean) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Get current dashboard state
   */
  isDashboardActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current dashboard URL
   */
  getDashboardUrl(): string | null {
    return this.dashboardUrl;
  }

  /**
   * Check if current URL is a dashboard URL
   */
  private isCurrentlyInDashboard(): boolean {
    const currentPath = window.location.pathname;
    
    // If we have a stored dashboard URL, check if we're still on it
    if (this.dashboardUrl) {
      const dashboardBase = this.dashboardUrl.split('/').slice(0, 2).join('/');
      const inDashboard = currentPath.startsWith(dashboardBase);
      return inDashboard;
    }
    
    // Check for dashboard patterns (like /apple-home, etc)
    const dashboardMatch = currentPath.match(/\/([^\/]+)/);
    const isNotLovelace = !!(dashboardMatch && dashboardMatch[1] !== 'lovelace');
    return isNotLovelace;
  }

  /**
   * Set dashboard as active and store URL
   */
  setDashboardActive(url?: string): void {
    const wasActive = this.isActive;
    this.isActive = true;
    
    if (url || !this.dashboardUrl) {
      this.dashboardUrl = url || window.location.pathname;
    }
    
    if (!wasActive) {
      this.notifyListeners(true);
    }
  }

  /**
   * Set dashboard as inactive
   */
  setDashboardInactive(): void {
    const wasActive = this.isActive;
    this.isActive = false;
    
    if (wasActive) {
      this.notifyListeners(false);
    }
  }

  /**
   * Setup real-time navigation event listeners for immediate detection
   */
  private setupNavigationListeners(): void {
    // Listen for popstate events (back/forward buttons)
    window.addEventListener('popstate', () => {
      this.handleNavigationChange('popstate');
    });

    // Listen for hashchange events
    window.addEventListener('hashchange', () => {
      this.handleNavigationChange('hashchange');
    });

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      // Use setTimeout to ensure URL has changed
      setTimeout(() => {
        DashboardStateManager.getInstance().handleNavigationChange('pushstate');
      }, 0);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => {
        DashboardStateManager.getInstance().handleNavigationChange('replacestate');
      }, 0);
    };

    // Listen for focus events (in case user navigated via address bar)
    window.addEventListener('focus', () => {
      // Small delay to ensure any URL changes have settled
      setTimeout(() => {
        this.handleNavigationChange('focus');
      }, 100);
    });
  }

  /**
   * Handle immediate navigation changes
   */
  private handleNavigationChange(source: string): void {
    const currentPath = window.location.pathname;
    const isInDashboard = this.isCurrentlyInDashboard();
    const wasActive = this.isActive;

    if (wasActive && !isInDashboard) {
      this.setDashboardInactive();
    } else if (!wasActive && isInDashboard) {
      this.setDashboardActive(currentPath);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(isActive: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(isActive);
      } catch (error) {
        console.error('Error in dashboard state listener:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear();
    DashboardStateManager.instance = null;
  }
}
