/**
 * Apple Home Dashboard Strategy - Stateless Implementation
 * Apple Home-like automatic dashboard for Home Assistant
 * 
 * Version: 2.1.0 - Stateless Architecture
 * Author: Apple Home Dashboard Team
 * 
 * This follows the proven mushroom-strategy pattern of stateless configuration generation.
 * No component instances, no singletons, no shared state - just pure configuration.
 */

import { DashboardConfig, DeviceGroup } from './config/DashboardConfig';
import { AppleHomeCard } from './components/AppleHomeCard';
import { AppleHomeView } from './components/AppleHomeView';
import { CustomizationManager } from './utils/CustomizationManager';
import { setupLocalize, localize } from './utils/LocalizationService';
import { BackgroundManager } from './utils/BackgroundManager';
import { HomeAssistantUIManager } from './utils/HomeAssistantUIManager';
import { SnapshotManager } from './utils/SnapshotManager';
import { RTLHelper } from './utils/RTLHelper';

// Extend window interface for TypeScript
declare global {
  interface Window {
    customCards?: any[];
    customStrategies?: { [key: string]: any };
    appleHomeCleanupRegistered?: boolean;
  }
}

/**
 * Automatically install Star Wars Light theme if not already installed
 * Note: Theme file must be manually placed in /config/themes/ directory
 * This function attempts to register it via Home Assistant's theme registry
 */
async function installThemeAutomatically(hass: any): Promise<void> {
  if (!hass) return;
  
  try {
    // Check if theme is already registered
    const themes = await hass.callWS({ type: 'frontend/get_themes' });
    const themeName = 'Star Wars Light';
    
    const themeExists = themes?.themes?.some((theme: any) => theme.name === themeName);
    
    if (themeExists) {
      // Theme already exists, nothing to do
      return;
    }
    
    // Note: Home Assistant doesn't allow registering themes programmatically via WebSocket
    // Themes must be either:
    // 1. Placed in /config/themes/ directory (HA auto-discovers them)
    // 2. Installed via HACS
    // 3. Defined in configuration.yaml
    
    // For now, we'll just log a helpful message
    console.info('💡 Smart Home Dashboard: Star Wars Light theme recommended but not found.');
    console.info('   To install: Place theme/star_wars_light.yaml in /config/themes/ directory');
    console.info('   Or install via HACS: https://github.com/Stormrage-DJ/ha_theme_star_wars_light');
    
  } catch (error) {
    // Non-critical, theme installation is optional
    console.warn('Could not check theme registry:', error);
  }
}

/**
 * Main strategy function - generates dashboard configuration
 * This is called by Home Assistant's strategy system
 */
async function generateLovelaceDashboard(
  info: { hass: any; narrow?: boolean },
  options?: { title?: string }
) {
  const { hass } = info;
  
  // Initialize localization FIRST before any localize() calls
  setupLocalize(hass);
  
  // Initialize RTL support
  RTLHelper.initialize(hass);
  
  const views = [];

  // Load user customizations using CustomizationManager singleton
  const customizationManager = CustomizationManager.getInstance(hass);
  const customizations = await customizationManager.loadCustomizations();
  
  // Set the loaded customizations in the manager
  await customizationManager.setCustomizations(customizations);

  // Initialize snapshot manager
  const snapshotManager = SnapshotManager.getInstance();
  snapshotManager.setHass(hass);

  // Initialize background manager with loaded customizations
  const backgroundManager = new BackgroundManager(customizationManager);
  
  // Initialize background for dashboard (this will also set dashboard as active)
  backgroundManager.initializeBackground();

  // Initialize UI manager with customizations for header/sidebar control
  const uiManager = HomeAssistantUIManager.initializeWithCustomizations(customizationManager);
  
  // Apply UI settings once with a small delay to ensure DOM is ready
  setTimeout(() => {
    uiManager.reapplyDashboardSettings();
  }, 100);

  // Automatically install theme if not already installed
  try {
    await installThemeAutomatically(hass);
  } catch (error) {
    console.warn('Failed to install theme automatically:', error);
    // Non-critical, continue without theme
  }

  // Home view configuration - always first
  const homeTitle = options?.title || hass?.config?.location_name || localize('pages.my_home');
  views.push({
    title: homeTitle,
    path: 'home',
    icon: 'mdi:home',
    panel: true,
    cards: [{
      type: 'custom:smart-home-view',
      title: homeTitle,
      pageType: 'home',
      customizations: customizations
    }]
  });

  // Group view configurations - one for each device group (exclude OTHER group as it doesn't have its own page)
  const deviceGroups = (Object.keys(DashboardConfig.GROUP_STYLES) as DeviceGroup[]).filter(group => group !== DeviceGroup.OTHER);
  
  for (const group of deviceGroups) {
    const groupStyle = DashboardConfig.getGroupStyle(group);
    
    const groupName = typeof groupStyle.name === 'function' ? groupStyle.name() : groupStyle.name;
    
    views.push({
      title: groupName,
      path: group,
      icon: groupStyle.icon,
      panel: true,
      subview: true,
      cards: [{
        type: 'custom:smart-home-view',
        title: groupName,
        pageType: 'group',
        deviceGroup: group,
        customizations: customizations
      }]
    });
  }

  // Add special pages (Scenes and Cameras)
  views.push({
    title: localize('pages.scenes'),
    path: 'scenes',
    icon: 'mdi:palette',
    panel: true,
    subview: true,
  cards: [{
      type: 'custom:smart-home-view',
      title: localize('pages.scenes'),
      pageType: 'scenes',
      customizations: customizations
    }]
  });

  views.push({
    title: localize('pages.cameras'),
    path: 'cameras', 
    icon: 'mdi:cctv',
    panel: true,
    subview: true,
  cards: [{
      type: 'custom:smart-home-view',
      title: localize('pages.cameras'),
      pageType: 'cameras',
      customizations: customizations
    }]
  });

  // Add room views for each area
  try {
    const areas = await hass.callWS({ type: 'config/area_registry/list' });
    
    for (const area of areas) {
      views.push({
        title: area.name,
        path: `room-${area.area_id}`,
        icon: 'mdi:home-outline',
        panel: true,
        subview: true,
        cards: [{
          type: 'custom:smart-home-view',
          title: area.name,
          pageType: 'room',
          areaId: area.area_id,
          areaName: area.name,
          customizations: customizations
        }]
      });
    }
  } catch (error) {
    console.error('Error fetching areas for room views:', error);
  }

  // Add view for "Default Room" (entities without area)
  views.push({
    title: localize('pages.default_room'),
    path: 'room-no_area',
    icon: 'mdi:home-outline',
    panel: true,
    subview: true,
  cards: [{
      type: 'custom:smart-home-view',
      title: localize('pages.default_room'),
      pageType: 'room',
      areaId: 'no_area',
      areaName: localize('pages.default_room'),
      customizations: customizations
    }]
  });

  return { views };
}

/**
 * Strategy Class - Required by Home Assistant for proper strategy registration
 * This follows the Home Assistant strategy pattern exactly like mushroom-strategy
 */
class AppleHomeStrategy extends HTMLElement {
  /**
   * Generate a dashboard configuration
   * Called by Home Assistant when creating a dashboard with this strategy
   */
  static async generateDashboard(info: { hass: any; config: any }): Promise<{ views: any[] }> {
    // Extract options from config if available
    const options = info.config?.strategy?.options || {};
    
    // Use our stateless function
    return generateLovelaceDashboard({ hass: info.hass }, options);
  }
}

// Register custom elements (components still work exactly the same)
if (!customElements.get('apple-home-card')) {
  customElements.define('apple-home-card', AppleHomeCard);
}
if (!customElements.get('smart-home-view')) {
  customElements.define('smart-home-view', AppleHomeView);
}

// Register the strategy element with Home Assistant (required pattern)
if (!customElements.get('ll-strategy-smart-home-strategy')) {
  customElements.define('ll-strategy-smart-home-strategy', AppleHomeStrategy);
}

// Register the strategy with Home Assistant cards list
if (window.customCards) {
  window.customCards.push({
    type: 'custom:apple-home-strategy',
    name: 'Smart Home Strategy',
    description: 'Smart Home-style dashboard strategy with stateless architecture',
    preview: false
  });
}

// Also register the function for backward compatibility
window.customStrategies = window.customStrategies || {};
window.customStrategies['smart-home-strategy'] = generateLovelaceDashboard;


