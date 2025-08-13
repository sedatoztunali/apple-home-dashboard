import { CustomizationManager } from './CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { DashboardStateManager } from './DashboardStateManager';

export interface BackgroundConfig {
  type: 'preset' | 'custom';
  backgroundImage?: string; // data URL (e.g., "url(data:image/jpeg;base64,...)") or preset gradient name
}

export class BackgroundManager {
  private customizationManager: CustomizationManager;
  private currentBackground: BackgroundConfig;
  private static activeInstances = new Set<BackgroundManager>();

  // Predefined gradient backgrounds
  static readonly PRESET_BACKGROUNDS = {
    'default': DashboardConfig.getDefaultBackground(),
    'sunset': `linear-gradient(135deg, 
      rgba(255, 149, 113, 0.8) 0%, 
      rgba(255, 112, 166, 0.8) 20%, 
      rgba(255, 95, 192, 0.8) 40%, 
      rgba(198, 113, 255, 0.8) 60%, 
      rgba(142, 140, 255, 0.8) 80%, 
      rgba(115, 152, 255, 0.8) 100%
    )`,
    'ocean': `linear-gradient(135deg,
      rgba(29, 151, 255, 0.8) 0%,
      rgba(0, 199, 255, 0.8) 25%,
      rgba(0, 229, 195, 0.8) 50%,
      rgba(73, 255, 144, 0.8) 75%,
      rgba(146, 254, 157, 0.8) 100%
    )`,
    'forest': `linear-gradient(135deg,
      rgba(46, 160, 67, 0.8) 0%,
      rgba(81, 198, 103, 0.8) 25%,
      rgba(116, 235, 139, 0.8) 50%,
      rgba(151, 255, 175, 0.8) 75%,
      rgba(186, 255, 201, 0.8) 100%
    )`,
    'purple': `linear-gradient(135deg,
      rgba(88, 86, 214, 0.8) 0%,
      rgba(139, 69, 255, 0.8) 25%,
      rgba(185, 103, 255, 0.8) 50%,
      rgba(231, 137, 255, 0.8) 75%,
      rgba(255, 171, 255, 0.8) 100%
    )`,
    'fire': `linear-gradient(135deg,
      rgba(255, 94, 77, 0.8) 0%,
      rgba(255, 154, 0, 0.8) 25%,
      rgba(255, 206, 84, 0.8) 50%,
      rgba(255, 238, 173, 0.8) 75%,
      rgba(255, 255, 255, 0.8) 100%
    )`
  };

  // Default background is the first preset
  static readonly DEFAULT_BACKGROUND = 'default';

  constructor(customizationManager: CustomizationManager) {
    this.customizationManager = customizationManager;
    this.currentBackground = this.getBackgroundConfig();
    
    // Only start monitoring if this is the first instance
    if (BackgroundManager.activeInstances.size === 0) {
      DashboardStateManager.getInstance().addListener((isInDashboard: boolean) => {
        this.handleDashboardStateChange(isInDashboard);
      });
    }
    
    BackgroundManager.activeInstances.add(this);
  }

  /**
   * Handle dashboard state changes
   */
  private handleDashboardStateChange(isInDashboard: boolean): void {
    const wasActive = this.customizationManager.isDashboardCurrentlyActive();
    
    if (wasActive && !isInDashboard) {
      // User navigated away from dashboard - remove background
      this.removeBackground();
      this.customizationManager.setDashboardActive(false);
    } else if (!wasActive && isInDashboard) {
      // User navigated back to dashboard - reapply background
      this.applyBackgroundToBody(this.currentBackground);
      this.customizationManager.setDashboardActive(true);
    }
  }

  /**
   * Get current background configuration from storage
   */
  private getBackgroundConfig(): BackgroundConfig {
    const customizations = this.customizationManager.getCustomizations();
    const backgroundData = customizations.background;
    
    if (backgroundData) {
      return {
        type: backgroundData.type || 'preset',
        backgroundImage: backgroundData.value || backgroundData.backgroundImage || BackgroundManager.DEFAULT_BACKGROUND
      };
    }
    
    return { type: 'preset', backgroundImage: BackgroundManager.DEFAULT_BACKGROUND };
  }

  /**
   * Set background configuration and apply to body
   */
  async setBackground(config: BackgroundConfig): Promise<void> {
    this.currentBackground = config;
    // Convert internal backgroundImage property to storage value property
    const storageConfig = {
      type: config.type,
      value: config.backgroundImage
    };
    await this.customizationManager.setCustomization('background', storageConfig);
    this.applyBackgroundToBody(config);
  }

  /**
   * Apply background to document body using CSS style element
   */
  private applyBackgroundToBody(config: BackgroundConfig): void {
    // Only apply background if we're currently in the dashboard
    if (!this.customizationManager.isCurrentlyInDashboard()) {
      return;
    }
    
    let backgroundStyle = '';
    
    if (config.type === 'custom' && config.backgroundImage) {
      backgroundStyle = config.backgroundImage;
    } else if (config.type === 'preset' && config.backgroundImage) {
      backgroundStyle = BackgroundManager.getPresetBackground(config.backgroundImage);
    } else {
      backgroundStyle = BackgroundManager.getDefaultBackground();
    }
    
    // Remove any existing background style first
    const existingStyle = document.querySelector('#apple-home-body-background');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Create new style element for body background
    const styleElement = document.createElement('style');
    styleElement.id = 'apple-home-body-background';
    
    styleElement.textContent = `
      body {
        background-image: ${backgroundStyle} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-attachment: fixed !important;
        height: unset !important;
      }
    `;
    
    document.head.appendChild(styleElement);
  }

  /**
   * Initialize background on app start
   */
  initializeBackground(): void {
    // Set dashboard as active and apply background
    this.customizationManager.setDashboardActive(true);
    
    const config = this.getCurrentBackground();
    this.applyBackgroundToBody(config);
  }


  /**
   * Set custom background from base64 image (formatted as data URL)
   */
  async setCustomBackground(dataUrl: string): Promise<void> {
    const config: BackgroundConfig = {
      type: 'custom',
      backgroundImage: dataUrl
    };
    await this.setBackground(config);
  }

  /**
   * Set preset background
   */
  async setPresetBackground(presetName: string): Promise<void> {
    const config: BackgroundConfig = {
      type: 'preset',
      backgroundImage: presetName
    };
    await this.setBackground(config);
  }

  /**
   * Reset to default background
   */
  async resetToDefault(): Promise<void> {
    const config: BackgroundConfig = {
      type: 'preset',
      backgroundImage: BackgroundManager.DEFAULT_BACKGROUND
    };
    await this.setBackground(config);
  }

  /**
   * Get current background config
   */
  getCurrentBackground(): BackgroundConfig {
    return { ...this.currentBackground };
  }


  /**
   * Check if using custom background
   */
  isUsingCustomBackground(): boolean {
    return this.currentBackground.type === 'custom' && !!this.currentBackground.backgroundImage;
  }

  /**
   * Get the default background for preview
   */
  static getDefaultBackground(): string {
    return BackgroundManager.PRESET_BACKGROUNDS[BackgroundManager.DEFAULT_BACKGROUND];
  }

  /**
   * Get a preset background by name
   */
  static getPresetBackground(name: string): string {
    return BackgroundManager.PRESET_BACKGROUNDS[name as keyof typeof BackgroundManager.PRESET_BACKGROUNDS] || BackgroundManager.getDefaultBackground();
  }

  /**
   * Get all available preset background names
   */
  static getPresetNames(): string[] {
    return Object.keys(BackgroundManager.PRESET_BACKGROUNDS);
  }

  /**
   * Convert image file to data URL
   */
  static async imageToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(`url(${result})`);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Remove background from document body
   */
  private removeBackground(): void {
    const existingStyle = document.querySelector('#apple-home-body-background');
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  /**
   * Cleanup method - call when dashboard is destroyed
   */
  cleanup(): void {
    BackgroundManager.activeInstances.delete(this);
    
    // Only remove background if this was the last instance
    if (BackgroundManager.activeInstances.size === 0) {
      this.removeBackground();
      this.customizationManager.setDashboardActive(false);
    }
  }

}
