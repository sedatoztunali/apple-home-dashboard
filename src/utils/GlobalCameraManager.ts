import { CustomizationManager } from './CustomizationManager';

interface CameraManagerInterface {
  onSnapshotReceived: (base64Data: string) => void;
  onSnapshotFailed: () => void;
}

interface CameraInfo {
  entityId: string;
  lastFetchTime: number;
  isActive: boolean;
  managers: Set<CameraManagerInterface>;
}

/**
 * GlobalCameraManager - Singleton that coordinates camera snapshot fetching
 * Ensures no duplicate fetches and stops when not on dashboard
 */
export class GlobalCameraManager {
  private static instance: GlobalCameraManager | null = null;
  private cameras: Map<string, CameraInfo> = new Map();
  private fetchInterval: number = 10000; // 10 seconds
  private globalTimer?: number;
  private customizationManager?: CustomizationManager;
  private hass?: any;

  private constructor() {
    this.startGlobalTimer();
    this.setupVisibilityListener();
  }

  static getInstance(): GlobalCameraManager {
    if (!GlobalCameraManager.instance) {
      GlobalCameraManager.instance = new GlobalCameraManager();
    }
    return GlobalCameraManager.instance;
  }

  public setHass(hass: any): void {
    this.hass = hass;
  }

  public setCustomizationManager(customizationManager: CustomizationManager): void {
    this.customizationManager = customizationManager;
  }

  /**
   * Register a camera entity with a manager
   */
  public registerCamera(entityId: string, manager: CameraManagerInterface): void {
    if (!this.cameras.has(entityId)) {
      this.cameras.set(entityId, {
        entityId,
        lastFetchTime: 0,
        isActive: true,
        managers: new Set()
      });
    }

    const cameraInfo = this.cameras.get(entityId)!;
    const wasEmpty = cameraInfo.managers.size === 0;
    cameraInfo.managers.add(manager);
    cameraInfo.isActive = true;

    // If this is the first manager for this camera, or we haven't fetched recently, trigger an immediate fetch
    const now = Date.now();
    if (wasEmpty || now - cameraInfo.lastFetchTime > this.fetchInterval) {
      this.fetchCameraSnapshot(entityId);
    }
  }

  /**
   * Unregister a camera manager
   */
  public unregisterCamera(entityId: string, manager: CameraManagerInterface): void {
    const cameraInfo = this.cameras.get(entityId);
    if (cameraInfo) {
      cameraInfo.managers.delete(manager);
      
      // If no managers left, mark as inactive
      if (cameraInfo.managers.size === 0) {
        cameraInfo.isActive = false;
      }
    }
  }

  /**
   * Pause all camera fetching (called when leaving dashboard)
   */
  public pauseAll(): void {
    this.cameras.forEach(cameraInfo => {
      cameraInfo.isActive = false;
    });
  }

  /**
   * Resume camera fetching (called when returning to dashboard)
   */
  public resumeAll(): void {
    this.cameras.forEach(cameraInfo => {
      if (cameraInfo.managers.size > 0) {
        cameraInfo.isActive = true;
        // Reset last fetch time to ensure immediate fetch
        cameraInfo.lastFetchTime = 0;
      }
    });
    
    // Immediately trigger a fetch for all active cameras
    this.fetchActiveCameras();
  }

  /**
   * Clean up inactive cameras
   */
  public cleanup(): void {
    const toDelete: string[] = [];
    this.cameras.forEach((cameraInfo, entityId) => {
      if (cameraInfo.managers.size === 0) {
        toDelete.push(entityId);
      }
    });
    
    toDelete.forEach(entityId => {
      this.cameras.delete(entityId);
    });
  }

  private startGlobalTimer(): void {
    if (this.globalTimer) {
      clearInterval(this.globalTimer);
    }

    this.globalTimer = window.setInterval(() => {
      this.fetchActiveCameras();
    }, this.fetchInterval);
  }

  private fetchActiveCameras(): void {
    // Don't fetch if not on dashboard
    if (!this.isDashboardActive()) {
      return;
    }

    const now = Date.now();
    
    this.cameras.forEach((cameraInfo, entityId) => {
      if (cameraInfo.isActive && 
          cameraInfo.managers.size > 0 && 
          (now - cameraInfo.lastFetchTime >= this.fetchInterval)) {
        this.fetchCameraSnapshot(entityId);
      }
    });

    // Clean up inactive cameras periodically
    this.cleanup();
  }

  private async fetchCameraSnapshot(entityId: string): Promise<void> {
    const cameraInfo = this.cameras.get(entityId);
    if (!cameraInfo || !cameraInfo.isActive || !this.hass) {
      return;
    }

    try {
      const state = this.hass.states[entityId];
      if (!state || state.state === 'unavailable') {
        this.notifyManagers(entityId, null, true);
        return;
      }

      const base64Data = await this.getCameraSnapshotBase64(entityId);
      cameraInfo.lastFetchTime = Date.now();
      
      if (base64Data) {
        this.notifyManagers(entityId, base64Data, false);
      } else {
        this.notifyManagers(entityId, null, true);
      }
    } catch (error) {
      console.error(`Error fetching camera snapshot for ${entityId}:`, error);
      this.notifyManagers(entityId, null, true);
    }
  }

  private notifyManagers(entityId: string, base64Data: string | null, isFailed: boolean): void {
    const cameraInfo = this.cameras.get(entityId);
    if (!cameraInfo) return;

    cameraInfo.managers.forEach(manager => {
      if (base64Data && !isFailed) {
        manager.onSnapshotReceived(base64Data);
      } else {
        manager.onSnapshotFailed();
      }
    });
  }

  private async getCameraSnapshotBase64(entityId: string): Promise<string | null> {
    if (!this.hass) return null;

    try {
      const state = this.hass.states[entityId];
      if (!state || state.state === 'unavailable') {
        return null;
      }

      let imageUrl = '';
      
      if (state.attributes.entity_picture) {
        imageUrl = state.attributes.entity_picture;
      } else if (state.attributes.snapshot_url) {
        const timestamp = new Date().getTime();
        const separator = state.attributes.snapshot_url.includes('?') ? '&' : '?';
        imageUrl = `${state.attributes.snapshot_url}${separator}t=${timestamp}`;
      } else if (state.attributes.still_image_url) {
        const timestamp = new Date().getTime();
        const separator = state.attributes.still_image_url.includes('?') ? '&' : '?';
        imageUrl = `${state.attributes.still_image_url}${separator}t=${timestamp}`;
      } else {
        // Last fallback to proxy endpoint
        const timestamp = new Date().getTime();
        imageUrl = `/api/camera_proxy/${entityId}?t=${timestamp}`;
      }
      
      if (imageUrl) {
        return await this.urlToBase64(imageUrl);
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting camera snapshot for ${entityId}:`, error);
      return null;
    }
  }

  private async urlToBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return null;
    }
  }

  private isDashboardActive(): boolean {
    // Check if we're currently on the dashboard
    if (this.customizationManager) {
      return this.customizationManager.isCurrentlyInDashboard();
    }
    
    // Fallback check - any URL that's not clearly another HA section
    const currentPath = window.location.pathname;
    return !currentPath.includes('/config') && 
           !currentPath.includes('/developer-tools') && 
           !currentPath.includes('/history') && 
           !currentPath.includes('/logbook') &&
           !currentPath.includes('/energy') &&
           !currentPath.includes('/media-browser');
  }

  private setupVisibilityListener(): void {
    // Listen for page visibility changes only (not URL changes)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAll();
      } else if (this.isDashboardActive()) {
        this.resumeAll();
      }
    });
    
    // NOTE: URL change monitoring is now handled by BackgroundManager
    // to avoid conflicts and duplicate pause/resume calls
  }

  /**
   * Get the last fetch time for a camera (for timestamp display)
   */
  public getLastFetchTime(entityId: string): number {
    const cameraInfo = this.cameras.get(entityId);
    return cameraInfo ? cameraInfo.lastFetchTime : 0;
  }

  /**
   * Force refresh a specific camera
   */
  public forceRefresh(entityId: string): void {
    const cameraInfo = this.cameras.get(entityId);
    if (cameraInfo && cameraInfo.isActive) {
      this.fetchCameraSnapshot(entityId);
    }
  }

  /**
   * Destroy the singleton (for cleanup)
   */
  public static destroy(): void {
    if (GlobalCameraManager.instance) {
      if (GlobalCameraManager.instance.globalTimer) {
        clearInterval(GlobalCameraManager.instance.globalTimer);
      }
      GlobalCameraManager.instance.cameras.clear();
      GlobalCameraManager.instance = null;
    }
  }
}
