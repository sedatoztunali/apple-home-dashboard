import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DataService } from '../utils/DataService';
import { Entity, CardConfig, Area } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { AutomationManager } from '../utils/AutomationManager';

export interface StatusData {
  domain: string;
  icon: string;
  label: string;
  value: string;
  entityIds: string[];
  isVisible: boolean;
}

export class StatusSection {
  private customizationManager: CustomizationManager;
  private cardManager?: CardManager;
  private _hass?: any;
  private statusItems: StatusData[] = [];
  private _entities?: Entity[];
  private _areaId?: string;
  private _container?: HTMLElement;

  constructor(customizationManager: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = customizationManager;
    this.cardManager = cardManager || new CardManager(customizationManager);
  }

  set hass(hass: any) {
    this._hass = hass;
    // Update existing status section if it exists
    if (this._container && this._entities) {
      this.updateStatus(this._entities, hass, this._areaId);
    }
  }

  /**
   * Render status section for a specific area or group
   */
  async render(
    container: HTMLElement,
    entities: Entity[],
    hass: any,
    areaId?: string
  ): Promise<void> {
    this._hass = hass;
    this._entities = entities;
    this._areaId = areaId;
    this._container = container;

    // Generate status data
    this.statusItems = await this.generateStatusData(entities, hass, areaId);

    // Filter out items with no entities
    const visibleItems = this.statusItems.filter(item => item.isVisible);

    if (visibleItems.length === 0) {
      return; // Don't render empty section
    }

    // Create status section container
    const statusSection = document.createElement('div');
    statusSection.className = 'apple-status-section';

    // Generate HTML with embedded styles (like AppleChips)
    statusSection.innerHTML = this.generateHTML(visibleItems, areaId);

    container.appendChild(statusSection);

    // Attach event listeners after DOM is created
    this.attachEventListeners(statusSection, areaId);
  }

  /**
   * Update existing status section with new hass data
   */
  private async updateStatus(entities: Entity[], hass: any, areaId?: string): Promise<void> {
    if (!this._container) return;

    // Find existing status section
    const existingStatusSection = this._container.querySelector('.apple-status-section');
    if (!existingStatusSection) return;

    // Generate new status data
    const newStatusItems = await this.generateStatusData(entities, hass, areaId);
    const newVisibleItems = newStatusItems.filter((item: StatusData) => item.isVisible);

    // If no visible items, remove the section
    if (newVisibleItems.length === 0) {
      existingStatusSection.remove();
      return;
    }

    // Update only the values in the existing DOM elements
    newVisibleItems.forEach((item: StatusData) => {
      const chipElement = existingStatusSection.querySelector(`[data-domain="${item.domain}"]`);
      if (chipElement) {
        const valueElement = chipElement.querySelector('.status-chip-value');
        if (valueElement) {
          valueElement.textContent = item.value;
        }
        // Update entity ids in case they changed
        chipElement.setAttribute('data-entity-ids', item.entityIds.join(','));
      }
    });

    // Update stored status items
    this.statusItems = newStatusItems;
  }

  private async generateStatusData(entities: Entity[], hass: any, areaId?: string): Promise<StatusData[]> {
    const statusMap = new Map<string, StatusData>();

    // Initialize all possible status types in custom order
    const statusTypes = [
      { domain: 'security', icon: 'mdi:shield-check', label: localize('status_section.security') },
      { domain: 'occupancy', icon: 'mdi:account-check', label: localize('status_section.occupancy') },
      { domain: 'motion', icon: 'mdi:motion-sensor', label: localize('status_section.motion') },
      { domain: 'locks', icon: 'mdi:lock', label: localize('status_section.locks') },
      { domain: 'lights', icon: 'mdi:lightbulb', label: localize('status_section.lights') },
      { domain: 'switches', icon: 'mdi:toggle-switch', label: localize('status_section.switches') },
      { domain: 'outlets', icon: 'mdi:power-socket', label: localize('status_section.outlets') },
      { domain: 'doors', icon: 'mdi:door', label: localize('status_section.doors') },
      { domain: 'windows', icon: 'mdi:window-open', label: localize('status_section.windows') },
      { domain: 'contact', icon: 'mdi:door-open', label: localize('contact.contact_sensors') },
      { domain: 'temperature', icon: 'mdi:thermometer', label: localize('status_section.temperature') },
      { domain: 'humidity', icon: 'mdi:water-percent', label: localize('status_section.humidity') },
      { domain: 'light_sensor', icon: 'mdi:brightness-6', label: localize('status_section.light') },
      { domain: 'covers', icon: 'mdi:window-shutter', label: localize('status_section.covers') },
      { domain: 'tvs', icon: 'mdi:television', label: localize('status_section.tvs') },
      { domain: 'speakers', icon: 'mdi:speaker', label: localize('status_section.speakers') },
      { domain: 'smoke', icon: 'mdi:smoke-detector', label: localize('status_section.smoke') },
      { domain: 'vacuum', icon: 'mdi:robot-vacuum', label: localize('status_section.vacuum') },
      { domain: 'battery', icon: 'mdi:battery-low', label: localize('status_section.battery') },
      { domain: 'automations', icon: 'mdi:robot', label: localize('automations.chip_label') }
    ];

    // Initialize status map
    statusTypes.forEach(type => {
      statusMap.set(type.domain, {
        domain: type.domain,
        icon: type.icon,
        label: type.label,
        value: '',
        entityIds: [],
        isVisible: false
      });
    });

    // Process entities and categorize them (including unavailable/unknown entities)
    entities.forEach(entity => {
      const state = hass.states[entity.entity_id];
      if (!state) return; // Only skip entities with no state object at all

      const entityDomain = entity.entity_id.split('.')[0];
      const deviceClass = state.attributes?.device_class;

      this.categorizeEntity(entity.entity_id, entityDomain, deviceClass, state, statusMap);
    });

    // Calculate status values for each category and return in order
    const orderedStatusItems: StatusData[] = [];

    for (const type of statusTypes) {
      // Special handling for automations
      if (type.domain === 'automations') {
        try {
          if (areaId) {
            // In area pages, show total count (not just enabled)
            const totalCount = await AutomationManager.getTotalAutomationsCount(hass, areaId);
            let statusValue: string;
            if (totalCount === 0) {
              statusValue = localize('automations.no_automation');
            } else {
              const enabledCount = await AutomationManager.getEnabledAutomationsCount(hass, areaId);
              if (enabledCount === 0) {
                // Show total count even if none are enabled
                statusValue = `${totalCount}`;
              } else if (enabledCount === totalCount) {
                statusValue = `${totalCount} ${localize('automations.enabled')}`;
              } else {
                // Show enabled count with label
                statusValue = `${enabledCount} ${localize('automations.enabled')}`;
              }
            }
            
            const automationsStatus: StatusData = {
              domain: 'automations',
              icon: type.icon,
              label: type.label,
              value: statusValue,
              entityIds: [], // Automations don't have entityIds in the traditional sense
              isVisible: true
            };
            orderedStatusItems.push(automationsStatus);
          } else {
            // In home page, show enabled count only
            const enabledCount = await AutomationManager.getEnabledAutomationsCount(hass);
            if (enabledCount > 0) {
              const statusValue = `${enabledCount} ${localize('automations.enabled')}`;
              const automationsStatus: StatusData = {
                domain: 'automations',
                icon: type.icon,
                label: type.label,
                value: statusValue,
                entityIds: [],
                isVisible: true
              };
              orderedStatusItems.push(automationsStatus);
            }
          }
        } catch (error) {
          console.warn('Failed to load automations count:', error);
        }
        continue;
      }

      const status = statusMap.get(type.domain);
      if (status && status.entityIds.length > 0) {
        // Check if there's at least one available entity (not unavailable/unknown)
        const hasAvailableEntities = status.entityIds.some(entityId => {
          const state = hass.states[entityId];
          return state && state.state !== 'unavailable' && state.state !== 'unknown';
        });

        // Only show status if there are available entities
        if (hasAvailableEntities) {
          status.value = this.calculateStatusValue(type.domain, status.entityIds, hass);
          status.isVisible = true;
          orderedStatusItems.push(status);
        }
      }
    }

    return orderedStatusItems;
  }

  private categorizeEntity(
    entityId: string,
    domain: string,
    deviceClass: string | undefined,
    state: any,
    statusMap: Map<string, StatusData>
  ): void {

    // Lights
    if (domain === 'light') {
      statusMap.get('lights')?.entityIds.push(entityId);
    }

    // Switches and Outlets
    else if (domain === 'switch') {
      // Check if this switch is an outlet
      if (DashboardConfig.isOutlet(entityId, state.attributes)) {
        statusMap.get('outlets')?.entityIds.push(entityId);
      } else {
        statusMap.get('switches')?.entityIds.push(entityId);
      }
    }

    // Temperature sensors
    else if (domain === 'sensor' && (deviceClass === 'temperature' || state.attributes?.unit_of_measurement === '°C' || state.attributes?.unit_of_measurement === '°F')) {
      statusMap.get('temperature')?.entityIds.push(entityId);
    }
    else if (domain === 'climate') {
      statusMap.get('temperature')?.entityIds.push(entityId);
    }

    // Humidity sensors
    else if (domain === 'sensor' && deviceClass === 'humidity') {
      statusMap.get('humidity')?.entityIds.push(entityId);
    }

    // Covers
    else if (domain === 'cover') {
      statusMap.get('covers')?.entityIds.push(entityId);
    }

    // Security systems
    else if (domain === 'alarm_control_panel') {
      statusMap.get('security')?.entityIds.push(entityId);
    }

    // Locks
    else if (domain === 'lock') {
      statusMap.get('locks')?.entityIds.push(entityId);
    }

    // Motion sensors
    else if (domain === 'binary_sensor' && deviceClass === 'motion') {
      statusMap.get('motion')?.entityIds.push(entityId);
    }

    // Occupancy sensors
    else if (domain === 'binary_sensor' && deviceClass === 'occupancy') {
      statusMap.get('occupancy')?.entityIds.push(entityId);
    }

    // Light sensors (illuminance)
    else if (domain === 'sensor' && (deviceClass === 'illuminance' || state.attributes?.unit_of_measurement === 'lx')) {
      statusMap.get('light_sensor')?.entityIds.push(entityId);
    }

    // Smoke detectors
    else if (domain === 'binary_sensor' && deviceClass === 'smoke') {
      statusMap.get('smoke')?.entityIds.push(entityId);
    }

    // Battery sensors (only low battery ones)
    else if (domain === 'sensor' && deviceClass === 'battery' && parseFloat(state.state) < 20) {
      statusMap.get('battery')?.entityIds.push(entityId);
    }

    // Door sensors
    else if (domain === 'binary_sensor' && deviceClass === 'door') {
      statusMap.get('doors')?.entityIds.push(entityId);
    }

    // Window sensors
    else if (domain === 'binary_sensor' && deviceClass === 'window') {
      statusMap.get('windows')?.entityIds.push(entityId);
    }

    // General contact sensors (not doors or windows)
    else if (domain === 'binary_sensor' && (deviceClass === 'opening' && !['door', 'window'].includes(deviceClass || ''))) {
      statusMap.get('contact')?.entityIds.push(entityId);
    }

    // TVs (media players with TV device class)
    else if (domain === 'media_player' && (deviceClass === 'tv' || entityId.includes('tv'))) {
      statusMap.get('tvs')?.entityIds.push(entityId);
    }

    // Speakers (other media players)
    else if (domain === 'media_player' && deviceClass !== 'tv' && !entityId.includes('tv')) {
      statusMap.get('speakers')?.entityIds.push(entityId);
    }

    // Vacuum cleaners (show all vacuums, regardless of state)
    else if (domain === 'vacuum') {
      statusMap.get('vacuum')?.entityIds.push(entityId);
    }
  }

  private calculateStatusValue(domain: string, entityIds: string[], hass: any): string {
    switch (domain) {
      case 'lights':
      case 'switches':
      case 'outlets':
        return this.calculateOnOffStatus(entityIds, hass);

      case 'temperature':
        return this.calculateTemperatureRange(entityIds, hass);

      case 'humidity':
        return this.calculateHumidityRange(entityIds, hass);

      case 'covers':
        return this.calculateCoverStatus(entityIds, hass);

      case 'security':
        return this.calculateSecurityStatus(entityIds, hass);

      case 'locks':
        return this.calculateLockStatus(entityIds, hass);

      case 'motion':
        return this.calculateMotionStatus(entityIds, hass);

      case 'occupancy':
        return this.calculateOccupancyStatus(entityIds, hass);

      case 'light_sensor':
        return this.calculateLightSensorRange(entityIds, hass);

      case 'smoke':
        return this.calculateSmokeStatus(entityIds, hass);

      case 'battery':
        return entityIds.length === 1 ? localize('battery.low_battery') : localize('battery.low_battery_count').replace('{count}', entityIds.length.toString());

      case 'doors':
      case 'windows':
      case 'contact':
        return this.calculateContactStatus(entityIds, hass);

      case 'tvs':
      case 'speakers':
        return this.calculateMediaStatus(entityIds, hass);

      case 'vacuum':
        return this.calculateVacuumStatus(entityIds, hass);

      default:
        return '';
    }
  }

  private calculateOnOffStatus(entityIds: string[], hass: any): string {
    const onCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && (state.state === 'on' || state.state === 'playing');
    }).length;

    if (onCount === 0) {
      return localize('lights.all_off');
    } else if (onCount === entityIds.length) {
      return onCount === 1 ? localize('lights.on') : localize('lights.all_on');
    } else {
      return `${onCount} ${localize('lights.on')}`;
    }
  }

  private calculateTemperatureRange(entityIds: string[], hass: any): string {
    const temperatures: number[] = [];

    entityIds.forEach(id => {
      const state = hass.states[id];
      if (!state) return;

      let temp: number | undefined;

      const domain = id.split('.')[0];
      if (domain === 'climate') {
        temp = state.attributes?.current_temperature;
      } else {
        temp = parseFloat(state.state);
      }

      if (temp !== undefined && !isNaN(temp) && temp > -100 && temp < 200) { // Reasonable temperature range
        temperatures.push(temp);
      }
    });

    if (temperatures.length === 0) return '';
    if (temperatures.length === 1) return `${temperatures[0].toFixed(1)}°`;

    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);

    if (Math.abs(min - max) < 0.1) { // If temperatures are essentially the same
      return `${min.toFixed(1)}°`;
    }

    return `${min.toFixed(1)}°-${max.toFixed(1)}°`;
  }

  private calculateHumidityRange(entityIds: string[], hass: any): string {
    const humidities: number[] = [];

    entityIds.forEach(id => {
      const state = hass.states[id];
      if (state) {
        const humidity = parseFloat(state.state);
        if (!isNaN(humidity) && humidity >= 0 && humidity <= 100) { // Valid humidity range
          humidities.push(Math.round(humidity)); // Round to whole numbers for better display
        }
      }
    });

    if (humidities.length === 0) return '';
    if (humidities.length === 1) return `${humidities[0]}%`;

    const min = Math.min(...humidities);
    const max = Math.max(...humidities);

    if (min === max) { // If all humidity values are the same
      return `${min}%`;
    }

    return `${min}%-${max}%`;
  }

  private generateHTML(statusItems: StatusData[], areaId?: string): string {
    return `
      <style>
        .apple-status-section {
          display: block;
          padding: 0;
          margin-top: 10px;
          width: 100%;
          height: 56px;
        }

        .status-chips-container {
          display: flex;
          gap: 36px;
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

        .status-chips-container::-webkit-scrollbar {
          display: none;
        }

        .status-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          min-height: 36px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .status-chip-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .status-chip-icon ha-icon {
          width: 24px;
          height: 24px;
          color: white;
        }

        .status-chip-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .status-chip-label {
          font-size: 14px;
          font-weight: 600;
          color: white;
          line-height: 1.2;
          letter-spacing: -0.2px;
        }

        .status-chip-value {
          font-size: 12px;
          font-weight: 500;
          color: white;
          line-height: 1.2;
          opacity: 0.9;
        }
      </style>
      <div class="status-chips-container">
        ${statusItems.map(item => `
          <div class="status-chip" data-domain="${item.domain}" data-entity-ids="${item.entityIds.join(',')}">
            <div class="status-chip-icon">
              <ha-icon icon="${item.icon}"></ha-icon>
            </div>
            <div class="status-chip-content">
              <span class="status-chip-label">${item.label}</span>
              <span class="status-chip-value">${item.value}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private attachEventListeners(statusSection: HTMLElement, areaId?: string): void {
    const chips = statusSection.querySelectorAll('.status-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const domain = chip.getAttribute('data-domain');
        const entityIds = chip.getAttribute('data-entity-ids')?.split(',') || [];

        const statusData: StatusData = {
          domain: domain || '',
          icon: '',
          label: domain || '',
          value: '',
          entityIds,
          isVisible: true
        };

        // Find the full status data
        const fullStatusData = this.statusItems.find(item => item.domain === domain);
        if (fullStatusData) {
          this.handleStatusChipClick(fullStatusData, areaId);
        }
      });
    });
  }

  private calculateCoverStatus(entityIds: string[], hass: any): string {
    const openCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'open';
    }).length;

    if (openCount === 0) {
      return localize('covers.all_closed');
    } else if (openCount === entityIds.length) {
      return openCount === 1 ? localize('covers.open') : localize('covers.all_open');
    } else {
      return `${openCount} ${localize('covers.open')}`;
    }
  }

  private calculateSecurityStatus(entityIds: string[], hass: any): string {
    if (entityIds.length === 1) {
      const state = hass.states[entityIds[0]];
      return state?.state?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown';
    }

    const armed = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state !== "disarmed" && state.state.includes('armed');
    }).length;

    return armed === 0 ? localize('status.disarmed') : `${armed} ${localize('status.armed')}`;
  }

  private calculateLockStatus(entityIds: string[], hass: any): string {
    const unlockedCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'unlocked';
    }).length;

    if (unlockedCount === 0) {
      return localize('status_section.all_locked');
    } else if (unlockedCount === entityIds.length) {
      return unlockedCount === 1 ? localize('status.unlocked') : localize('status_section.all_unlocked');
    } else {
      return `${unlockedCount} ${localize('status.unlocked')}`;
    }
  }

  private calculateMotionStatus(entityIds: string[], hass: any): string {
    const activeCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'on';
    }).length;

    if (activeCount === 0) {
      return localize('motion.not_detected');
    } else if (activeCount === 1) {
      return localize('motion.detected');
    } else {
      return `${activeCount} ${localize('motion.detected')}`;
    }
  }

  private calculateOccupancyStatus(entityIds: string[], hass: any): string {
    const activeCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'on';
    }).length;

    if (activeCount === 0) {
      return localize('occupancy.not_detected');
    } else if (activeCount === 1) {
      return localize('occupancy.detected');
    } else {
      return `${activeCount} ${localize('occupancy.detected')}`;
    }
  }

  private calculateLightSensorRange(entityIds: string[], hass: any): string {
    const luxValues: number[] = [];

    entityIds.forEach(id => {
      const state = hass.states[id];
      if (state) {
        const lux = parseFloat(state.state);
        if (!isNaN(lux) && lux >= 0) {
          luxValues.push(Math.round(lux)); // Round lux values for cleaner display
        }
      }
    });

    if (luxValues.length === 0) return '';
    if (luxValues.length === 1) return `${luxValues[0]} lux`;

    const min = Math.min(...luxValues);
    const max = Math.max(...luxValues);

    if (min === max) { // If all values are the same
      return `${min} lux`;
    }

    return `${min}-${max} lux`;
  }

  private calculateSmokeStatus(entityIds: string[], hass: any): string {
    const detectedCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'on';
    }).length;

    return detectedCount === 0 ? localize('smoke.not_detected') : localize('smoke.detected');
  }

  private calculateContactStatus(entityIds: string[], hass: any): string {
    const openCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'on';
    }).length;

    if (openCount === 0) {
      return localize('contact.all_closed');
    } else if (openCount === 1) {
      return `1 ${localize('covers.open')}`;
    } else {
      return `${openCount} ${localize('covers.open')}`;
    }
  }

  private calculateVacuumStatus(entityIds: string[], hass: any): string {
    if (entityIds.length === 0) {
      return '';
    } else if (entityIds.length === 1) {
      // Single vacuum - show its state
      const state = hass.states[entityIds[0]];
      const vacuumState = state?.state;
      if (vacuumState === 'cleaning') {
        return localize('vacuum.cleaning');
      } else if (vacuumState === 'returning') {
        return localize('vacuum.returning');
      } else if (vacuumState === 'paused') {
        return localize('vacuum.paused');
      } else if (vacuumState === 'docked') {
        return localize('vacuum.docked');
      } else if (vacuumState === 'idle') {
        return localize('vacuum.idle');
      } else if (vacuumState === 'error') {
        return localize('vacuum.error');
      }
      return vacuumState ? vacuumState.charAt(0).toUpperCase() + vacuumState.slice(1) : '';
    } else {
      // Multiple vacuums - show count and state summary
      // Count active ones
      const activeCount = entityIds.filter(id => {
        const state = hass.states[id];
        if (!state) return false;
        const vacuumState = state.state;
        return vacuumState === 'cleaning' || vacuumState === 'returning' || vacuumState === 'paused';
      }).length;
      
      if (activeCount > 0) {
        return `${activeCount} ${localize('vacuum.cleaning')}`;
      } else {
        // All are inactive (docked/idle/etc) - just show count
        return `${entityIds.length} Vacuum${entityIds.length > 1 ? 's' : ''}`;
      }
    }
  }

  private calculateMediaStatus(entityIds: string[], hass: any): string {
    const playingCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state === 'playing';
    }).length;

    if (playingCount > 0) {
      return playingCount === 1 ? localize('media.playing') : `${playingCount} ${localize('media.multiple_playing')}`;
    }

    const onCount = entityIds.filter(id => {
      const state = hass.states[id];
      return state && state.state !== 'off' && state.state !== 'unavailable' && state.state !== 'standby';
    }).length;

    if (onCount === 0) {
      return localize('lights.all_off');
    } else if (onCount === entityIds.length) {
      return onCount === 1 ? localize('lights.on') : localize('lights.all_on');
    } else {
      return `${onCount} ${localize('lights.on')}`;
    }
  }

  private handleStatusChipClick(statusData: StatusData, areaId?: string): void {
    // Special handling for automations
    if (statusData.domain === 'automations') {
      if (this._hass) {
        const automationManager = new AutomationManager();
        automationManager.showAutomationsModal(this._hass, areaId);
      }
      return;
    }

    if (statusData.entityIds.length === 1) {
      // Single entity - open native Home Assistant more info
      this.openMoreInfoDialog(statusData.entityIds[0]);
    } else {
      // Multiple entities - open modal with cards
      this.openStatusModal(statusData, areaId);
    }
  }

  private openMoreInfoDialog(entityId: string): void {
    if (this._hass) {
      // Create the more-info event
      const event = new CustomEvent('hass-more-info', {
        detail: { entityId },
        bubbles: true,
        composed: true
      });

      // Try to dispatch from the main Home Assistant app elements
      const targets = [
        document.querySelector('ha-app'),
        document.querySelector('home-assistant'),
        document.querySelector('hui-root'),
        document.querySelector('ha-panel-lovelace')
      ].filter(Boolean);

      let dispatched = false;
      for (const target of targets) {
        if (target) {
          target.dispatchEvent(event);
          dispatched = true;
          break; // Only need to dispatch from one target
        }
      }

      // Fallback to document body if no Home Assistant elements found
      if (!dispatched) {
        document.body.dispatchEvent(event);
      }
    }
  }

  private async groupEntitiesByArea(entityIds: string[]): Promise<{ [areaId: string]: string[] }> {
    const entitiesByArea: { [areaId: string]: string[] } = {};

    // Get areas, devices, and entities from Home Assistant
    let areas: Area[] = [];
    let devices: any[] = [];
    let entities: Entity[] = [];
    try {
      areas = await DataService.getAreas(this._hass);
      devices = await DataService.getDevices(this._hass);
      entities = await DataService.getEntities(this._hass);
    } catch (error) {
      // Silently handle error
    }

    // Initialize areas
    areas.forEach(area => {
      entitiesByArea[area.area_id] = [];
    });

    // Add entities without area to 'no_area'
    entitiesByArea['no_area'] = [];

    // Group entities by area
    for (const entityId of entityIds) {
      // Find the entity in the registry
      const entityRegistry = entities.find(e => e.entity_id === entityId);

      let entityAreaId = entityRegistry?.area_id;

      // If entity doesn't have an area but has a device, check device's area
      if (!entityAreaId && entityRegistry?.device_id) {
        const device = devices.find(d => d.id === entityRegistry.device_id);
        if (device?.area_id) {
          entityAreaId = device.area_id;
        }
      }

      // If still no area, put in 'no_area'
      if (!entityAreaId) {
        entityAreaId = 'no_area';
      }

      // Initialize area if it doesn't exist (shouldn't happen, but just in case)
      if (!entitiesByArea[entityAreaId]) {
        entitiesByArea[entityAreaId] = [];
      }

      entitiesByArea[entityAreaId].push(entityId);
    }

    // Remove empty areas
    Object.keys(entitiesByArea).forEach(areaId => {
      if (entitiesByArea[areaId].length === 0) {
        delete entitiesByArea[areaId];
      }
    });

    return entitiesByArea;
  }

  private async openStatusModal(statusData: StatusData, areaId?: string): Promise<void> {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.className = 'status-modal-backdrop';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'status-modal-content';

    // Modal header
    const header = document.createElement('div');
    header.className = 'status-modal-header';
    header.innerHTML = `
      <button class="modal-cancel">${localize('ui_actions.cancel')}</button>
      <h2>${statusData.label}</h2>
      <button class="modal-done">${localize('ui_actions.done')}</button>
    `;

    // Modal body
    const body = document.createElement('div');
    body.className = 'status-modal-body';

    // Group entities by room
    const entitiesByArea = await this.groupEntitiesByArea(statusData.entityIds);

    // Create sections for each room
    for (const [roomAreaId, roomEntityIds] of Object.entries(entitiesByArea) as [string, string[]][]) {
      if (roomEntityIds.length === 0) continue;

      // Get area name (capitalized like home screen titles)
      let areaName = roomAreaId;
      if (roomAreaId !== 'no_area') {
        try {
          const areas = await DataService.getAreas(this._hass);
          const area = areas.find((a: Area) => a.area_id === roomAreaId);
          areaName = area?.name || roomAreaId;
        } catch (error) {
          // Silently handle error
        }
      } else {
        areaName = localize('pages.default_room');
      }

      // Create room title
      const roomTitle = document.createElement('div');
      roomTitle.className = 'status-modal-room-title';
      roomTitle.innerHTML = `<span>${areaName}</span>`;
      body.appendChild(roomTitle);

      // Create cards grid for this room
      const cardsGrid = document.createElement('div');
      cardsGrid.className = 'status-modal-cards';
      cardsGrid.dataset.areaId = roomAreaId;

      // Create cards for entities in this room
      for (const entityId of roomEntityIds) {
        const cardConfig = this.createEntityCard(entityId, this._hass);
        if (cardConfig) {
          await this.createAndAppendCard(cardConfig, cardsGrid, this._hass, roomAreaId);
        }
      }

      body.appendChild(cardsGrid);
    }

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);

    // Add event listeners
    const cancelBtn = header.querySelector('.modal-cancel');
    const doneBtn = header.querySelector('.modal-done');

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    cancelBtn?.addEventListener('click', closeModal);
    doneBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Forward hass-more-info events from cards to main app
    modal.addEventListener('hass-more-info', (e: Event) => {
      e.stopPropagation(); // Stop the event from bubbling further
      const event = e as CustomEvent;

      // Close the modal first
      closeModal();

      // Then dispatch the more-info event to the main app
      setTimeout(() => {
        // Try multiple Home Assistant app selectors
        const targets = [
          document.querySelector('ha-app'),
          document.querySelector('home-assistant'),
          document.querySelector('hui-root'),
          document.querySelector('ha-panel-lovelace')
        ].filter(Boolean);

        targets.forEach(target => {
          if (target) {
            const forwardedEvent = new CustomEvent('hass-more-info', {
              detail: event.detail,
              bubbles: true,
              composed: true
            });
            target.dispatchEvent(forwardedEvent);
          }
        });

        // Also try dispatching from document body as fallback
        if (targets.length === 0) {
          const fallbackEvent = new CustomEvent('hass-more-info', {
            detail: event.detail,
            bubbles: true,
            composed: true
          });
          document.body.dispatchEvent(fallbackEvent);
        }
      }, 100);
    });

    // Add to DOM and show
    document.body.appendChild(modal);

    // Add styles for modal
    this.addModalStyles();

    // Trigger animation
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

  private createEntityCard(entityId: string, hass: any): CardConfig | null {
    const state = hass.states[entityId];
    if (!state) {
      return null;
    }

    // Get custom name from CustomizationManager (priority: custom_name → friendly_name → entity_id)
    const customName = this.customizationManager.getEntityCustomName(entityId);
    let friendlyName = customName || state?.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
    const domain = entityId.split('.')[0];

    // Determine card type and properties
    let cardType = 'custom:apple-home-card';
    let isTallCard = false;

    // Check if domain should be tall by default
    if (DashboardConfig.isDefaultTallDomain(domain)) {
      isTallCard = true;
    }

    const card: CardConfig = {
      type: cardType,
      entity: entityId,
      name: friendlyName,
      domain: domain,
      is_tall: isTallCard
    };

    // Add default icons for entities without icons
    if (!state.attributes?.icon) {
      let defaultIcon = '';

      if (DashboardConfig.isScenesDomain(domain)) {
        defaultIcon = 'mdi:home';
      } else if (domain === 'sensor') {
        // Set default icons based on device class for sensors
        switch (state.attributes?.device_class) {
          case 'temperature':
            defaultIcon = 'mdi:thermometer';
            break;
          case 'humidity':
            defaultIcon = 'mdi:water-percent';
            break;
          case 'illuminance':
            defaultIcon = 'mdi:brightness-6';
            break;
          case 'battery':
            defaultIcon = 'mdi:battery';
            break;
          default:
            defaultIcon = 'mdi:gauge';
        }
      } else if (domain === 'binary_sensor') {
        // Set default icons based on device class for binary sensors
        switch (state.attributes?.device_class) {
          case 'motion':
            defaultIcon = 'mdi:motion-sensor';
            break;
          case 'occupancy':
            defaultIcon = 'mdi:account-check';
            break;
          case 'door':
            defaultIcon = 'mdi:door';
            break;
          case 'window':
            defaultIcon = 'mdi:window-open';
            break;
          case 'contact':
            defaultIcon = 'mdi:door-open';
            break;
          case 'smoke':
            defaultIcon = 'mdi:smoke-detector';
            break;
          default:
            defaultIcon = 'mdi:checkbox-marked-circle';
        }
      }

      if (defaultIcon) {
        (card as any).default_icon = defaultIcon;
      }
    }

    return card;
  }

  private async createAndAppendCard(
    cardConfig: any,
    container: HTMLElement,
    hass: any,
    areaId?: string
  ): Promise<void> {
    try {
      let cardElement: HTMLElement;

      if (cardConfig.type === 'custom:apple-home-card') {
        cardElement = document.createElement('apple-home-card') as HTMLElement;

        // Determine if card should be tall based on customizations
        const shouldBeTall = this.cardManager?.shouldCardBeTall(
          cardConfig.entity,
          areaId || 'unknown',
          'modal'
        ) || cardConfig.is_tall;

        const configWithTall = { ...cardConfig, is_tall: shouldBeTall };

        // Add default icon if specified
        if ((cardConfig as any).default_icon) {
          configWithTall.default_icon = (cardConfig as any).default_icon;
        }

        (cardElement as any).setConfig(configWithTall);
        (cardElement as any).hass = hass;
      } else {
        // Handle other card types
        const customCardType = cardConfig.type.replace('custom:', '');
        if (customElements.get(customCardType)) {
          cardElement = document.createElement(customCardType);
          if (cardElement && typeof (cardElement as any).setConfig === 'function') {
            (cardElement as any).setConfig(cardConfig);
            (cardElement as any).hass = hass;
          }
        } else {
          cardElement = document.createElement('div');
          cardElement.innerHTML = `<div style="color: red;">Unknown card type: ${cardConfig.type}</div>`;
        }
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'entity-card-wrapper';
      wrapper.dataset.entityId = cardConfig.entity;

      // Apply tall class if needed
      const shouldBeTall = this.cardManager?.shouldCardBeTall(
        cardConfig.entity,
        areaId || 'unknown',
        'modal'
      ) || cardConfig.is_tall;

      if (shouldBeTall) {
        wrapper.classList.add('tall');
      }

      wrapper.appendChild(cardElement);
      container.appendChild(wrapper);

    } catch (error) {
      console.error('Error creating status modal card:', error);
    }
  }

  private addModalStyles(): void {
    if (document.querySelector('#status-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'status-modal-styles';
    style.textContent = `
      .status-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .status-modal-backdrop.show {
        opacity: 1;
      }

      .status-modal-content {
        position: relative;
        width: 800px;
        max-width: 90vw;
        max-height: 80vh;
        background: rgba(28, 28, 30, 1);
        backdrop-filter: blur(40px);
        -webkit-backdrop-filter: blur(40px);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        transform: scale(0.9);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        display: flex;
        flex-direction: column;
      }

      .status-modal-backdrop.show .status-modal-content {
        transform: scale(1);
        opacity: 1;
      }

      .status-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 0.5px solid rgba(84, 84, 88, 0.3);
      }

      .status-modal-header h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: white;
        text-align: center;
        flex: 1;
      }

      .modal-cancel,
      .modal-done {
        background: none;
        border: none;
        color: #ffaf00;
        font-size: 16px;
        font-weight: 400;
        cursor: pointer;
        padding: 8px 0;
        min-width: 60px;
        text-align: center;
      }

      .modal-done {
        font-weight: 600;
      }

      .status-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        min-height: 0;
      }

      .status-modal-room-title {
        margin: 0 0 8px 0;
        font-size: 13px;
        font-weight: 400;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
      }

      .status-modal-room-title:first-child {
        margin-top: 0;
      }

      .status-modal-cards {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: 80px;
        gap: 12px;
        auto-rows: min-content;
        margin-bottom: 32px;
      }

      .status-modal-cards:last-child {
        margin-bottom: 0;
      }

      .entity-card-wrapper {
        display: flex;
        flex-direction: column;
        position: relative;
        grid-column: span 3;
        border-radius: 16px;
        overflow: hidden;
      }

      .entity-card-wrapper.tall {
        grid-row: span 2;
      }

      .entity-card-wrapper apple-home-card {
        width: 100%;
        height: 100%;
        border-radius: 16px;
      }

      @media (max-width: 1199px) {
        .entity-card-wrapper {
          grid-column: span 4;
        }
      }

      @media (max-width: 767px) {
        .entity-card-wrapper {
          grid-column: span 6;
        }
      }

      @media (max-width: 768px) {
        .status-modal-content {
          width: 100vw;
          max-width: 100vw;
          height: calc(100dvh - env(safe-area-inset-top) - 20px);
          max-height: calc(100dvh - env(safe-area-inset-top) - 20px);
          border-radius: 16px 16px 0 0;
          transform: translateY(100%);
        }

        .status-modal-backdrop.show .status-modal-content {
          transform: translateY(0);
        }

        .status-card-wrapper {
          height: 120px;
        }

        .status-card-wrapper.tall {
          height: 240px;
        }
      }
    `;

    document.head.appendChild(style);
  }
}
