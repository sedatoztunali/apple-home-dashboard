import { CustomizationManager } from './CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { DashboardStateManager } from './DashboardStateManager';

export interface BackgroundConfig {
  type: 'preset' | 'custom' | 'theme';
  backgroundImage?: string; // data URL (e.g., "url(data:image/jpeg;base64,...)") or preset gradient name or theme background URL
}

export class BackgroundManager {
  private customizationManager: CustomizationManager;
  private currentBackground: BackgroundConfig;
  private dashboardRefreshHandler?: (event: Event) => void;
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

  // Theme default background URL (Star Wars Light theme)
  static readonly THEME_BACKGROUND_URL = 'https://raw.githubusercontent.com/Stormrage-DJ/ha_theme_star_wars_light/main/assets/star_wars_light_bg.png';

  // Theme background CSS (matches theme card-mod-view)
  static readonly THEME_BACKGROUND_CSS = `top center / auto no-repeat url('${BackgroundManager.THEME_BACKGROUND_URL}') fixed`;

  constructor(customizationManager: CustomizationManager) {
    this.customizationManager = customizationManager;
    this.currentBackground = this.getBackgroundConfig();

    // Only start monitoring if this is the first instance
    if (BackgroundManager.activeInstances.size === 0) {
      DashboardStateManager.getInstance().addListener((isInDashboard: boolean) => {
        this.handleDashboardStateChange(isInDashboard);
      });
    }

    // Listen for dashboard refresh events to update background configuration
    this.setupDashboardRefreshListener();

    BackgroundManager.activeInstances.add(this);
  }

  /**
   * Setup listener for dashboard refresh events to update background configuration
   */
  private setupDashboardRefreshListener(): void {
    this.dashboardRefreshHandler = (event: Event) => {
      const customEvent = event as CustomEvent;

      // Refresh background configuration from updated customizations
      const newBackgroundConfig = this.getBackgroundConfig();

      // Only update and reapply if the background configuration actually changed
      if (JSON.stringify(newBackgroundConfig) !== JSON.stringify(this.currentBackground)) {
        this.currentBackground = newBackgroundConfig;

        // Reapply background if dashboard is currently active
        if (DashboardStateManager.getInstance().isDashboardActive()) {
          this.applyBackgroundToBody(this.currentBackground);
        }
      }
    };

    document.addEventListener('apple-home-dashboard-refresh', this.dashboardRefreshHandler);
  }

  /**
   * Handle dashboard state changes
   */
  private handleDashboardStateChange(isActive: boolean): void {
    if (isActive) {
      // Dashboard activated: apply custom background
      this.applyBackgroundToBody(this.currentBackground);
    } else {
      // Dashboard deactivated: remove any custom background
      this.removeBackground();
    }
  }

  /**
   * Clear any custom background styles from the document
   */
  static clearBackgrounds(): void {
    const styleEl = document.querySelector('#apple-home-body-background');
    if (styleEl) {
      styleEl.remove();
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
    // Only apply background if Dashboard is active per DashboardStateManager
    if (!DashboardStateManager.getInstance().isDashboardActive()) {
      return;
    }

    let backgroundStyle = '';
    let backgroundSize = 'cover';
    let backgroundPosition = 'center';
    let backgroundRepeat = 'no-repeat';
    let backgroundAttachment = 'fixed';

    if (config.type === 'theme') {
      // Theme background uses specific CSS from theme file
      backgroundStyle = `url('${BackgroundManager.THEME_BACKGROUND_URL}')`;
      backgroundSize = 'auto';
      backgroundPosition = 'top center';
      backgroundRepeat = 'no-repeat';
      backgroundAttachment = 'fixed';
    } else if (config.type === 'custom' && config.backgroundImage) {
      backgroundStyle = config.backgroundImage;
      backgroundSize = 'cover';
      backgroundPosition = 'center';
      backgroundRepeat = 'no-repeat';
      backgroundAttachment = 'fixed';
    } else if (config.type === 'preset' && config.backgroundImage) {
      backgroundStyle = BackgroundManager.getPresetBackground(config.backgroundImage);
      backgroundSize = 'cover';
      backgroundPosition = 'center';
      backgroundRepeat = 'no-repeat';
      backgroundAttachment = 'fixed';
    } else {
      backgroundStyle = BackgroundManager.getDefaultBackground();
      backgroundSize = 'cover';
      backgroundPosition = 'center';
      backgroundRepeat = 'no-repeat';
      backgroundAttachment = 'fixed';
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
        background-size: ${backgroundSize} !important;
        background-position: ${backgroundPosition} !important;
        background-repeat: ${backgroundRepeat} !important;
        background-attachment: ${backgroundAttachment} !important;
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
   * Remove custom wallpaper and apply theme default background
   */
  async removeWallpaper(): Promise<void> {
    const config: BackgroundConfig = {
      type: 'theme',
      backgroundImage: BackgroundManager.THEME_BACKGROUND_URL
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
   * Check if using theme background
   */
  isUsingThemeBackground(): boolean {
    return this.currentBackground.type === 'theme';
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
    // Remove dashboard refresh event listener
    if (this.dashboardRefreshHandler) {
      document.removeEventListener('apple-home-dashboard-refresh', this.dashboardRefreshHandler);
      this.dashboardRefreshHandler = undefined;
    }

    BackgroundManager.activeInstances.delete(this);

    // Only remove background if this was the last instance
    if (BackgroundManager.activeInstances.size === 0) {
      this.removeBackground();
      this.customizationManager.setDashboardActive(false);
    }
  }

}
