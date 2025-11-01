import { DashboardConfig, DeviceGroup } from '../config/DashboardConfig';
import { AutomationManager } from '../utils/AutomationManager';
import { EntityState } from '../types/types';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export interface ChipConfig {
  group: DeviceGroup;
  enabled: boolean;
  show_when_zero?: boolean;
  navigation_path?: string;
}

export interface ChipsConfig {
  climate?: ChipConfig;
  lights?: ChipConfig;
  security?: ChipConfig;
  media?: ChipConfig;
  water?: ChipConfig;
}

export interface ChipData {
  group: DeviceGroup | 'automations';
  icon: string;
  groupName: string;
  statusText: string;
  iconColor: string;
  backgroundColor: string;
  textColor: string;
  enabled: boolean;
  navigationPath?: string;
}

export class AppleChips {
  private config?: ChipsConfig;
  private _hass?: any;
  private chips: ChipData[] = [];
  private activeGroup?: DeviceGroup;
  private container?: HTMLElement;
  private lastRenderedHash?: string;
  private lastHassTimestamp?: number; // Track hass changes
  private editMode: boolean = false;
  private customizationManager?: any;
  private onRenderCallback?: () => void;
  private statusTextCache = new Map<string, string>(); // Cache for status text
  private showSwitches: boolean = false; // Cached value for showSwitches setting
  private includedSwitches: string[] = []; // Cached value for includedSwitches setting

  constructor(container: HTMLElement, customizationManager?: any) {
    this.container = container;
    this.customizationManager = customizationManager;
    // Initialize showSwitches and includedSwitches settings
    this.updateSwitchSettings();
  }

  private async updateSwitchSettings() {
    if (this.customizationManager) {
      this.showSwitches = await this.customizationManager.getShowSwitches() || false;
      this.includedSwitches = await this.customizationManager.getIncludedSwitches() || [];
    }
  }

  static getDefaultConfig(): ChipsConfig {
    return {
      climate: {
        group: DeviceGroup.CLIMATE,
        enabled: true,
        show_when_zero: true
      },
      lights: {
        group: DeviceGroup.LIGHTING,
        enabled: true,
        show_when_zero: true
      },
      security: {
        group: DeviceGroup.SECURITY,
        enabled: true,
        show_when_zero: true
      },
      media: {
        group: DeviceGroup.MEDIA,
        enabled: true,
        show_when_zero: true
      },
      water: {
        group: DeviceGroup.WATER,
        enabled: false,
        show_when_zero: false
      }
    };
  }

  setConfig(config: ChipsConfig) {
    // Merge with default config
    this.config = {
      ...AppleChips.getDefaultConfig(),
      ...config
    };

    // Update switch settings in case they changed
    this.updateSwitchSettings();

    // Trigger render if we have hass
    if (this._hass) {
      this.render();
    }
  }

  set hass(hass: any) {
    // Prevent unnecessary re-renders by comparing relevant entity states
    if (hass && this._hass && this.hasRelevantEntityChanges(hass)) {
      console.debug('[AppleChips] Relevant entity changes detected, updating hass');
      this._hass = hass;

      // Render when hass is set and there are relevant changes
      if (this.config) {
        this.render();
      }
    } else if (!this._hass) {
      // First time setting hass
      console.debug('[AppleChips] Setting hass for the first time');
      this._hass = hass;
      if (this.config) {
        this.render();
      }
    } else {
      // Update hass reference but don't re-render
      this._hass = hass;
    }
  }

  private hasRelevantEntityChanges(newHass: any): boolean {
    if (!this._hass || !this.config) return true;

    // Get all entities that could affect chips
    const relevantDomains = ['light', 'switch', 'climate', 'alarm_control_panel', 'lock', 'media_player', 'water_heater'];
    const waterKeywords = ['water', 'leak', 'flood'];

    // Check if any relevant entities changed state or attributes
    for (const entityId of Object.keys(newHass.states)) {
      const domain = entityId.split('.')[0];
      const isWaterEntity = waterKeywords.some(keyword => entityId.includes(keyword)) ||
        newHass.states[entityId]?.attributes?.device_class === 'moisture';

      if (relevantDomains.includes(domain) || isWaterEntity) {
        const oldEntity = this._hass.states[entityId];
        const newEntity = newHass.states[entityId];

        if (!oldEntity || !newEntity) {
          return true; // Entity added or removed
        }

        // Check if state changed
        if (oldEntity.state !== newEntity.state) {
          return true;
        }

        // Check if relevant attributes changed (for climate entities)
        if (domain === 'climate' &&
          oldEntity.attributes?.current_temperature !== newEntity.attributes?.current_temperature) {
          return true;
        }
      }
    }

    return false;
  }

  get hass() {
    return this._hass;
  }

  isConfigured(): boolean {
    return !!this.config;
  }

  getConfig(): ChipsConfig | undefined {
    return this.config;
  }

  getActiveGroup(): DeviceGroup | undefined {
    return this.activeGroup;
  }

  setActiveGroup(group: DeviceGroup | undefined) {
    this.activeGroup = group;
    if (this._hass && this.config) {
      this.render();
    }
  }

  setEditMode(editMode: boolean) {
    this.editMode = editMode;
    if (this._hass && this.config) {
      this.render();
    }
  }

  setOnRenderCallback(callback: () => void) {
    this.onRenderCallback = callback;
  }

  getEditMode(): boolean {
    return this.editMode;
  }

  applySavedChipsOrder(chips: ChipData[]): ChipData[] {
    if (!this.customizationManager) return chips;

    const savedOrder = this.customizationManager.getSavedChipsOrder();
    if (savedOrder.length === 0) return chips;

    // Create a map for quick lookup
    const chipMap = new Map();
    chips.forEach(chip => {
      chipMap.set(chip.group, chip);
    });

    // Build ordered array based on saved order
    const orderedChips: ChipData[] = [];
    const usedGroups = new Set();

    // First, add chips in the saved order
    savedOrder.forEach((group: string) => {
      if (chipMap.has(group)) {
        orderedChips.push(chipMap.get(group));
        usedGroups.add(group);
      }
    });

    // Then, add any chips that weren't in the saved order (new groups)
    chips.forEach(chip => {
      if (!usedGroups.has(chip.group)) {
        orderedChips.push(chip);
      }
    });

    return orderedChips;
  }

  public async refresh() {
    // Public method to force refresh chips data
    if (this._hass && this.config) {
      await this.updateChipData();
      await this.render();
    }
  }

  private async render() {
    if (!this._hass || !this.config || !this.container) {
      return;
    }

    await this.updateChipData();

    // Only render if we have chips to show
    if (this.chips.length === 0) {
      this.container.innerHTML = '';
      this.lastRenderedHash = '';
      return;
    }

    // Create a hash of current state to prevent unnecessary re-renders
    const currentHash = JSON.stringify({
      chips: this.chips.map(c => ({ group: c.group, statusText: c.statusText })),
      activeGroup: this.activeGroup,
      editMode: this.editMode
    });

    if (this.lastRenderedHash === currentHash) {
      // No changes in chip data, skip render
      return;
    }

    // Log when chips are actually re-rendering (for debugging)
    console.debug('[AppleChips] Re-rendering chips due to state changes');

    const html = this.generateHTML();

    this.container.innerHTML = html;
    this.attachEventListeners();
    this.lastRenderedHash = currentHash;

    // Call the render callback if it exists
    if (this.onRenderCallback) {
      this.onRenderCallback();
    }

    // Force carousel styling after render (especially important for header context)
    setTimeout(() => this.forceCarouselStyling(), 50);
  }

  private async updateChipData() {
    if (!this._hass || !this.config) return;

    this.chips = [];
    // Filter out hidden and disabled entities from chip calculations
    const allEntities = Object.values(this._hass.states).filter((entity: any) => {
      const entityRegistry = this._hass.entities?.[entity.entity_id];
      if (entityRegistry && entityRegistry.hidden_by) {
        return false;
      }
      if (entityRegistry && entityRegistry.disabled_by) {
        return false;
      }
      return true;
    }) as EntityState[];

    // For each device group, check if there are entities and create chips accordingly
    const deviceGroups = [
      { group: DeviceGroup.CLIMATE, config: this.config.climate },
      { group: DeviceGroup.LIGHTING, config: this.config.lights },
      { group: DeviceGroup.SECURITY, config: this.config.security },
      { group: DeviceGroup.MEDIA, config: this.config.media },
      { group: DeviceGroup.WATER, config: this.config.water }
    ];

    for (const { group, config } of deviceGroups) {
      if (!config?.enabled) continue;

      // Find entities that belong to this group based on domain mapping
      const groupEntities = allEntities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];
        const entityState = this.hass?.states[entity.entity_id];

        // Special handling for switches
        if (domain === 'switch') {
          if (this.showSwitches) {
            const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, this.showSwitches);
            return entityGroup === group;
          } else {
            // If showSwitches is false, only include outlets or included switches
            const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
            const isIncluded = this.includedSwitches.includes(entity.entity_id);
            if (isOutlet || isIncluded) {
              const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, true); // Force true to get proper group
              return entityGroup === group;
            }
            return false;
          }
        } else {
          const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, this.showSwitches);
          return entityGroup === group;
        }
      });

      // Special handling for water group since it's not in the domain mapping
      if (group === DeviceGroup.WATER) {
        const waterEntities = allEntities.filter(entity =>
          entity.entity_id.includes('water') ||
          entity.entity_id.includes('leak') ||
          entity.entity_id.includes('flood') ||
          entity.attributes.device_class === 'moisture'
        );
        groupEntities.push(...waterEntities);
      }

      // Show chip if there are entities for this group (or show_when_zero is true)
      const shouldShow = groupEntities.length > 0 || config.show_when_zero;

      if (shouldShow) {
        const groupStyle = DashboardConfig.getGroupStyle(group);
        let statusText = this.getGroupStatusText(group, groupEntities);

        // Get inactive background color from DashboardConfig
        const inactiveStyle = DashboardConfig.getEntityData(
          { entity_id: 'light.dummy', state: 'off', attributes: {} } as EntityState,
          'light', // Use light domain to get inactive styling
          false
        );

        this.chips.push({
          group: group,
          icon: groupStyle.icon,
          groupName: typeof groupStyle.name === 'function' ? groupStyle.name() : groupStyle.name,
          statusText: statusText,
          iconColor: groupStyle.iconColor, // Always use base iconColor for chips, active state handled in HTML/CSS
          backgroundColor: inactiveStyle.backgroundColor,
          textColor: '#ffffff',
          enabled: config.enabled,
          navigationPath: config.navigation_path || group // Store just the group name, not absolute path
        });
      }
    }

    // Add Automations chip (always last)
    if (this._hass) {
      try {
        const enabledCount = await AutomationManager.getEnabledAutomationsCount(this._hass);
        const inactiveStyle = DashboardConfig.getEntityData(
          { entity_id: 'light.dummy', state: 'off', attributes: {} } as EntityState,
          'light',
          false
        );

        this.chips.push({
          group: 'automations' as any,
          icon: 'mdi:robot',
          groupName: localize('automations.chip_label'),
          statusText: enabledCount > 0 ? `${enabledCount} ${localize('automations.enabled')}` : localize('status.off'),
          iconColor: '#ffffff',
          backgroundColor: inactiveStyle.backgroundColor,
          textColor: '#ffffff',
          enabled: true,
          navigationPath: undefined
        });
      } catch (error) {
        console.warn('Failed to load automations count:', error);
      }
    }

    // Apply saved chip order
    this.chips = this.applySavedChipsOrder(this.chips);
  }

  private generateHTML(): string {
    // Get the media group's active icon color from DashboardConfig
    const mediaGroupStyle = DashboardConfig.getGroupStyle(DeviceGroup.MEDIA);
    const mediaActiveIconColor = mediaGroupStyle.activeIconColor || mediaGroupStyle.iconColor;

    return `
      <style>
        :host {
          --media-active-icon-color: ${mediaActiveIconColor};
        }

        .apple-chips-container {
          display: block;
          padding: 0;
          margin-top: 10px;
          width: 100%;
          height: 56px;
        }

        .chips-container {
          display: flex;
          gap: 12px;
          flex-wrap: nowrap;
          align-items: center;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 0 2px;
          width: 100%;
          height: 56px;
        }

        .chips-container::-webkit-scrollbar {
          display: none;
        }

        .carousel-grid.chips {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 0;
          margin: 0;
          min-height: 36px; /* Maintain consistent height during drag */
        }

        .chip-wrapper {
          flex-shrink: 0;
          position: relative;
        }

        .chip-wrapper.edit-mode {
          animation: apple-home-shake 1.3s ease-in-out infinite;
          touch-action: none;
        }

        /* Drag placeholder for chip wrappers */
        .chip-wrapper.drag-placeholder {
          background: transparent !important;
          border: none !important;
          opacity: 1;
          pointer-events: none;
          /* Keep the same size as the original chip to maintain layout */
          display: flex;
          align-items: center;
          min-height: 36px;
        }

        .chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 20px 4px 10px;
          border-radius: 50px;
          background: var(--chip-background-color);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          min-height: 36px;
          white-space: nowrap;
          position: relative; /* Ensure proper positioning during drag */
        }

        /* RTL chips - swap left/right padding */
        .chips-container.rtl .chip {
          padding: 4px 10px 4px 20px;
        }

        /* Ensure chips maintain their position during drag operations */
        .chip-wrapper:not(.dragging) {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .chip-wrapper.dragging {
          /* Dragging styles are applied via inline styles in DragAndDropManager */
          animation: none !important; /* Disable shake animation during drag */
        }

        .chip.active {
          background: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .chip.active .chip-group-name {
          color: #1f1f1f !important;
        }

        .chip.active .chip-status {
          color: rgba(31, 31, 31, 0.7) !important;
        }

        /* Active media chip icon color */
        .chip.active[data-group="media"] .chip-icon {
          color: var(--media-active-icon-color) !important;
        }

        .chip.active[data-group="media"] .chip-icon ha-icon {
          color: var(--media-active-icon-color) !important;
        }

        .chip-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--chip-icon-color);
        }

        .chip-icon ha-icon {
          width: 24px;
          height: 24px;
          color: var(--chip-icon-color);
        }

        .chip-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .chip-group-name {
          font-size: 14px;
          font-weight: 600;
          color: white;
          line-height: 1.2;
          letter-spacing: -0.2px;
        }

        .chip-status {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.2;
        }

        @keyframes apple-home-shake {
          0%, 100% { transform: translateX(0px) rotate(0deg); }
          10% { transform: translateX(-1px) rotate(-0.6deg); }
          20% { transform: translateX(1px) rotate(0.6deg); }
          30% { transform: translateX(-1px) rotate(-0.6deg); }
          40% { transform: translateX(1px) rotate(0.6deg); }
          50% { transform: translateX(-1px) rotate(-0.6deg); }
          60% { transform: translateX(1px) rotate(0.6deg); }
          70% { transform: translateX(-1px) rotate(-0.6deg); }
          80% { transform: translateX(1px) rotate(0.6deg); }
          90% { transform: translateX(-1px) rotate(-0.6deg); }
        }
      </style>
      <div class="apple-chips-container">
        <div class="chips-container carousel-container ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}">
          <div class="carousel-grid chips" data-area-id="chips" data-section-type="chips">
            ${this.chips.map(chip => `
              <div class="chip-wrapper ${this.editMode ? 'edit-mode' : ''}"
                   data-entity-id="${chip.group}"
                   data-chip-id="${chip.group}">
                <div class="chip ${chip.group === this.activeGroup ? 'active' : ''}"
                     data-group="${chip.group}"
                     style="--chip-background-color: ${chip.backgroundColor}; --chip-icon-color: ${chip.iconColor};"
                     ${chip.navigationPath ? `data-navigation="${chip.navigationPath}"` : ''}>
                  <div class="chip-icon">
                    <ha-icon icon="${chip.icon}"></ha-icon>
                  </div>
                  <div class="chip-content">
                    <span class="chip-group-name">${chip.groupName}</span>
                    <span class="chip-status">${chip.statusText}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners() {
    if (!this.container) return;

    // Add click handlers to chips (not chip wrappers)
    this.container.querySelectorAll('.chip').forEach((chip: any) => {
      chip.addEventListener('click', this.handleChipClick.bind(this));
    });
  }

  clearContainer() {
    if (this.container) {
      this.container.innerHTML = '';
      this.lastRenderedHash = '';
      this.statusTextCache.clear(); // Clear status text cache
    }
  }

  // Debug method to check if we're in header context
  private isInHeaderContext(): boolean {
    return this.container?.closest('.apple-header-scrolled-chips') !== null;
  }

  // Force carousel styling for debugging
  forceCarouselStyling() {
    if (!this.container) return;

    const isHeader = this.isInHeaderContext();

    const chipsContainer = this.container.querySelector('.chips-container') as HTMLElement;
    if (chipsContainer) {
      chipsContainer.style.overflowX = 'auto';
      chipsContainer.style.overflowY = 'hidden';
      chipsContainer.style.width = '100%';
    }

    if (isHeader) {
      // Apply header-specific fixes
      this.container.style.width = '100%';
      this.container.style.overflowX = 'auto';
    }
  }

  private handleChipClick(event: Event) {
    // Don't handle clicks in edit mode (for dragging)
    if (this.editMode) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const chip = event.currentTarget as HTMLElement;
    const group = chip.dataset.group as DeviceGroup | 'automations';
    const navigationPath = chip.dataset.navigation;

    // Special handling for automations chip
    if (group === 'automations') {
      if (this._hass) {
        const automationManager = new AutomationManager();
        automationManager.showAutomationsModal(this._hass);
      }
      return;
    }

    // Additional safety check - ensure we have valid navigation data
    if (!group && !navigationPath) {
      return;
    }

    // Check if this is the currently active chip - if so, return to home
    if (group === this.activeGroup) {
      this.navigateToHomePage();
      return;
    }

    // Determine the path to navigate to
    const targetPath = navigationPath || group;

    // Additional check to prevent navigation to invalid paths during load
    if (!targetPath || targetPath.trim() === '') {
      return;
    }

    // Navigate to the target path
    this.navigateToPath(targetPath);
  }

  private navigateToPath(path: string) {
    // Validate the path before attempting navigation
    if (!path || path.trim() === '') {
      return;
    }

    const currentPath = window.location.pathname;
    let basePath = '';

    // Handle different dashboard URL patterns
    if (currentPath.startsWith('/lovelace/')) {
      // Default lovelace dashboard: /lovelace/home -> /lovelace/
      basePath = '/lovelace/';
    } else if (currentPath === '/lovelace') {
      // Root lovelace: /lovelace -> /lovelace/
      basePath = '/lovelace/';
    } else {
      // Custom dashboard: /apple-home/home -> /apple-home/
      // Extract the dashboard name (first segment after root)
      const pathParts = currentPath.split('/').filter(part => part.length > 0);

      if (pathParts.length > 0) {
        basePath = `/${pathParts[0]}/`;
      } else {
        // Fallback - try to detect dashboard from current location
        basePath = '/lovelace/';
      }
    }

    // Clean path and construct full URL
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const newUrl = `${basePath}${cleanPath}`;

    // Additional validation - ensure we're not navigating to a config path by mistake
    if (newUrl.includes('/config/') && !basePath.includes('/config/')) {
      return;
    }

    // Navigate using Home Assistant's system
    window.history.pushState(null, '', newUrl);
    const event = new Event('location-changed', { bubbles: true, composed: true });
    window.dispatchEvent(event);
  }

  private navigateToHomePage() {
    // Navigate to the home page
    this.navigateToPath('home');
  }

  private getGroupStatusText(group: DeviceGroup, entities: EntityState[]): string {
    // Create a cache key based on entity states
    const cacheKey = `${group}:${entities.map(e => `${e.entity_id}:${e.state}:${e.attributes?.current_temperature || ''}`).join(';')}`;

    // Return cached result if available
    if (this.statusTextCache.has(cacheKey)) {
      return this.statusTextCache.get(cacheKey)!;
    }

    let statusText: string;

    switch (group) {
      case DeviceGroup.LIGHTING:
        const onLights = entities.filter(entity => entity.state === 'on');
        statusText = onLights.length > 0 ? `${onLights.length} ${localize('status.on')}` : localize('status.off');
        break;

      case DeviceGroup.CLIMATE:
        const climateEntities = entities.filter(entity => entity.entity_id.startsWith('climate.'));
        statusText = '--°';

        if (climateEntities.length > 0) {
          const temperatures = climateEntities
            .map(entity => entity.attributes.current_temperature)
            .filter(temp => temp !== undefined && temp !== null)
            .sort((a, b) => a - b);

          if (temperatures.length > 0) {
            const min = Math.round(temperatures[0]);
            const max = Math.round(temperatures[temperatures.length - 1]);
            statusText = temperatures.length === 1 ? `${min}°` : `${min}-${max}°`;
          }
        }
        break;

      case DeviceGroup.SECURITY:
        const alarmEntities = entities.filter(entity => entity.entity_id.startsWith('alarm_control_panel.'));
        const lockEntities = entities.filter(entity => entity.entity_id.startsWith('lock.'));

        const armed = alarmEntities.filter(entity => entity.state === 'armed_away' || entity.state === 'armed_home');
        const unlocked = lockEntities.filter(entity => entity.state === 'unlocked');

        if (armed.length > 0 && unlocked.length > 0) {
          statusText = `${localize('status.armed')}, ${unlocked.length} ${localize('status.unlocked')}`;
        } else if (armed.length > 0) {
          statusText = localize('status.armed');
        } else if (unlocked.length > 0) {
          statusText = `${unlocked.length} ${localize('status.unlocked')}`;
        } else {
          statusText = localize('chip_status.secure');
        }
        break;

      case DeviceGroup.MEDIA:
        const playingMedia = entities.filter(entity => entity.state === 'playing');
        const tvEntities = entities.filter(entity =>
          entity.attributes.device_class === 'tv' ||
          entity.entity_id.includes('tv') ||
          entity.attributes.source_list
        );
        const onTVs = tvEntities.filter(entity => entity.state === 'on');

        if (playingMedia.length > 0) {
          statusText = `${playingMedia.length} ${localize('status.playing')}`;
        } else if (onTVs.length > 0) {
          statusText = `${onTVs.length} ${onTVs.length > 1 ? localize('chip_status.tvs') : localize('chip_status.tv')} ${localize('status.on')}`;
        } else {
          statusText = localize('status.off');
        }
        break;

      case DeviceGroup.WATER:
        const activeWater = entities.filter(entity => entity.state === 'on' || entity.state === 'detected');
        statusText = activeWater.length > 0 ? `${activeWater.length} ${localize('chip_status.active')}` : localize('status.off');
        break;

      default:
        statusText = localize('status.off');
        break;
    }

    // Cache the result and clear old cache entries (keep only last 20)
    if (this.statusTextCache.size > 20) {
      const firstKey = this.statusTextCache.keys().next().value;
      if (firstKey) {
        this.statusTextCache.delete(firstKey);
      }
    }
    this.statusTextCache.set(cacheKey, statusText);

    return statusText;
  }
}
