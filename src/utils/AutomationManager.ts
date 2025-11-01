import { localize } from './LocalizationService';
import { RTLHelper } from './RTLHelper';
import { DataService } from './DataService';

interface AutomationItem {
  entityId: string;
  name: string;
  enabled: boolean;
  category?: string;
  areaId?: string;
}

interface CategoryGroup {
  category: string;
  automations: AutomationItem[];
}

export class AutomationManager {
  private modal?: HTMLElement;
  private hass?: any;
  private automations: AutomationItem[] = [];
  private filteredAreaId?: string;

  public async showAutomationsModal(hass: any, areaId?: string) {
    this.hass = hass;
    this.filteredAreaId = areaId;
    
    // Prepare automations data
    await this.prepareAutomationsData(hass, areaId);
    
    // Create and show modal
    this.createModal();
    this.setupEventListeners();
    this.showModal();
  }

  private async prepareAutomationsData(hass: any, areaId?: string): Promise<void> {
    this.automations = [];
    
    // Get all automation entities from hass.states
    const automationStates = Object.values(hass.states).filter((state: any) => {
      return state.entity_id.startsWith('automation.');
    }) as any[];

    // Get entity registry for additional info (category, area)
    let entityRegistry: any[] = [];
    try {
      entityRegistry = await hass.callWS({ type: 'config/entity_registry/list' });
    } catch (error) {
      console.warn('Failed to fetch entity registry:', error);
    }

    // Create a map of entity registry entries by entity_id
    const entityRegistryMap = new Map();
    entityRegistry.forEach((entity: any) => {
      if (entity.entity_id.startsWith('automation.')) {
        entityRegistryMap.set(entity.entity_id, entity);
      }
    });

    // Get devices for area mapping
    let devices: any[] = [];
    try {
      devices = await DataService.getDevices(hass);
    } catch (error) {
      console.warn('Failed to fetch devices:', error);
    }

    // Process each automation
    for (const state of automationStates) {
      const entityId = state.entity_id;
      const entityReg = entityRegistryMap.get(entityId);
      
      // Get enabled state from automation entity state
      // In Home Assistant, automation.state can be 'on' (enabled) or 'off' (disabled)
      // But we should check the 'enabled' attribute
      const enabled = state.attributes?.enabled !== false && state.state !== 'off';
      
      // Get category from entity registry
      const category = entityReg?.category || null;
      
      // Get area_id - automations don't have direct area_id, but we can check via device
      let automationAreaId: string | undefined = undefined;
      if (entityReg?.device_id) {
        const device = devices.find(d => d.id === entityReg.device_id);
        if (device?.area_id) {
          automationAreaId = device.area_id;
        }
      }
      
      // If area filter is set, only include automations from that area
      if (areaId && automationAreaId !== areaId) {
        continue;
      }

      // Get friendly name
      const name = state.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');

      this.automations.push({
        entityId,
        name,
        enabled,
        category: category || undefined,
        areaId: automationAreaId
      });
    }
  }

  private createModal() {
    // Group automations by category
    const groupedAutomations = this.groupByCategory(this.automations);

    this.modal = document.createElement('div');
    this.modal.className = `apple-automations-modal ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}`;
    
    this.modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <button class="modal-cancel">${localize('ui_actions.cancel')}</button>
          <h2>${localize('automations.title')}</h2>
          <button class="modal-done">${localize('ui_actions.done')}</button>
        </div>
        <div class="modal-body">
          ${groupedAutomations.length > 0 ? `
            ${groupedAutomations.map((group) => `
              <div class="category-section">
                <div class="category-header">
                  <span class="category-name">${group.category}</span>
                  <span class="category-count">${group.automations.length}</span>
                </div>
                <div class="automations-list">
                  ${group.automations.map((automation) => `
                    <div class="automation-item" data-entity-id="${automation.entityId}">
                      <button class="automation-toggle ${automation.enabled ? 'enabled' : 'disabled'}" 
                              data-entity-id="${automation.entityId}">
                        <ha-icon icon="${automation.enabled ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon>
                      </button>
                      <div class="automation-info">
                        <span class="automation-name">${automation.name}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          ` : `
            <div class="no-automations">
              <span>${localize('automations.no_automations')}</span>
            </div>
          `}
        </div>
      </div>
    `;

    this.addModalStyles();
    document.body.appendChild(this.modal);
  }

  private groupByCategory(automations: AutomationItem[]): CategoryGroup[] {
    const categoryMap = new Map<string, AutomationItem[]>();
    
    // Group by category
    automations.forEach(automation => {
      const category = automation.category || localize('automations.uncategorized');
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(automation);
    });

    // Convert to array and sort by category name
    const groups: CategoryGroup[] = Array.from(categoryMap.entries()).map(([category, automations]) => ({
      category,
      automations: automations.sort((a, b) => a.name.localeCompare(b.name))
    }));

    // Sort categories: Uncategorized first, then alphabetically
    groups.sort((a, b) => {
      const uncategorized = localize('automations.uncategorized');
      if (a.category === uncategorized) return -1;
      if (b.category === uncategorized) return 1;
      return a.category.localeCompare(b.category);
    });

    return groups;
  }

  private addModalStyles() {
    if (document.querySelector('#apple-automations-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'apple-automations-modal-styles';
    style.textContent = `
      .apple-automations-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      .modal-content {
        position: relative;
        width: 600px;
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

      .apple-automations-modal.show .modal-content {
        transform: scale(1);
        opacity: 1;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
      }

      .modal-header h2 {
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
        min-width: 50px;
        text-align: center;
      }

      .modal-done {
        font-weight: 600;
      }

      .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        min-height: 0;
      }

      .category-section {
        margin-bottom: 20px;
      }

      .category-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: rgba(44, 44, 46, 0.6);
        border-bottom: 0.5px solid rgba(84, 84, 88, 0.3);
      }

      .category-name {
        color: white;
        font-size: 15px;
        font-weight: 600;
      }

      .category-count {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
      }

      .automations-list {
        padding: 0;
        background: rgba(44, 44, 46, 0.8);
        border-radius: 0 0 10px 10px;
        overflow: hidden;
      }

      .automation-item {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        border-bottom: 0.5px solid rgba(84, 84, 88, 0.3);
        transition: background 0.2s ease;
      }

      .automation-item:last-child {
        border-bottom: none;
      }

      .automation-item.disabled {
        opacity: 0.6;
      }

      .automation-toggle {
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        border-radius: 16px;
        transition: all 0.2s ease;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }

      .automation-toggle * {
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
      }

      .automation-toggle.disabled {
        color: #ffffff80;
      }

      .automation-info {
        flex: 1;
        min-width: 0;
      }

      .automation-name {
        color: white;
        font-size: 14px;
        font-weight: 500;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .no-automations {
        padding: 40px 20px;
        text-align: center;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      /* RTL Support */
      .apple-automations-modal.rtl .automation-toggle {
        margin-right: 0;
        margin-left: 12px;
      }

      @media (max-width: 480px) {
        .apple-automations-modal {
          align-items: flex-end;
          justify-content: center;
        }

        .modal-content {
          width: 100vw;
          height: calc(100dvh - env(safe-area-inset-top) - 20px);
          max-width: 100vw;
          max-height: calc(100dvh - env(safe-area-inset-top) - 20px);
          border-radius: 16px 16px 0 0;
          transform: translateY(100%);
          opacity: 1;
          margin: 0;
        }

        .apple-automations-modal.show .modal-content {
          transform: translateY(0);
          opacity: 1;
        }
        
        .automation-item {
          padding: 16px 20px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners() {
    if (!this.modal || !this.hass) return;

    // Cancel button
    const cancelBtn = this.modal.querySelector('.modal-cancel');
    cancelBtn?.addEventListener('click', () => this.closeModal());

    // Done button
    const doneBtn = this.modal.querySelector('.modal-done');
    doneBtn?.addEventListener('click', () => this.closeModal());

    // Backdrop click
    const backdrop = this.modal.querySelector('.modal-backdrop');
    backdrop?.addEventListener('click', () => this.closeModal());

    // Automation toggle buttons
    const automationsList = this.modal.querySelectorAll('.automations-list');
    automationsList.forEach(list => {
      list.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const toggleButton = target.closest('.automation-toggle');
        if (toggleButton) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleAutomation(toggleButton as HTMLElement);
        }
      }, { capture: true });

      // Touch events for better mobile responsiveness
      list.addEventListener('touchstart', (e) => {
        const target = e.target as HTMLElement;
        const toggleButton = target.closest('.automation-toggle');
        if (toggleButton) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleAutomation(toggleButton as HTMLElement);
        }
      }, { capture: true });
    });

    // Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  private async toggleAutomation(button: HTMLElement) {
    const entityId = button.getAttribute('data-entity-id');
    if (!entityId || !this.hass) return;

    // Find automation in our list
    const automation = this.automations.find(a => a.entityId === entityId);
    if (!automation) return;

    const newEnabledState = !automation.enabled;

    try {
      // Call Home Assistant service to enable/disable automation
      if (newEnabledState) {
        await this.hass.callService('automation', 'enable', { entity_id: entityId });
      } else {
        await this.hass.callService('automation', 'disable', { entity_id: entityId });
      }

      // Update local state
      automation.enabled = newEnabledState;

      // Update UI
      button.classList.toggle('enabled', newEnabledState);
      button.classList.toggle('disabled', !newEnabledState);
      const icon = button.querySelector('ha-icon');
      if (icon) {
        icon.setAttribute('icon', newEnabledState ? 'mdi:eye' : 'mdi:eye-off');
      }

      // Update parent item
      const automationItem = button.closest('.automation-item');
      if (automationItem) {
        automationItem.classList.toggle('disabled', !newEnabledState);
      }

      // Update automation count in category header if needed
      this.updateCategoryCounts();
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      // Could show an error message here
    }
  }

  private updateCategoryCounts() {
    // Count enabled automations per category
    const categoryCounts = new Map<string, number>();
    this.automations.forEach(automation => {
      const category = automation.category || localize('automations.uncategorized');
      if (!categoryCounts.has(category)) {
        categoryCounts.set(category, 0);
      }
      if (automation.enabled) {
        categoryCounts.set(category, categoryCounts.get(category)! + 1);
      }
    });

    // Update category headers (if needed for future enhancements)
    // For now, we just update the visual state
  }

  private showModal() {
    if (!this.modal) return;
    
    setTimeout(() => {
      this.modal?.classList.add('show');
    }, 10);
  }

  private closeModal() {
    if (!this.modal) return;
    
    this.modal.classList.remove('show');
    setTimeout(() => {
      this.modal?.remove();
      this.modal = undefined;
    }, 300);
  }

  /**
   * Get count of enabled automations (optionally filtered by area)
   */
  public static async getEnabledAutomationsCount(hass: any, areaId?: string): Promise<number> {
    const automationStates = Object.values(hass.states).filter((state: any) => {
      return state.entity_id.startsWith('automation.');
    }) as any[];

    if (areaId) {
      // Need to filter by area - get entity registry and devices
      let entityRegistry: any[] = [];
      let devices: any[] = [];
      
      try {
        entityRegistry = await hass.callWS({ type: 'config/entity_registry/list' });
        devices = await DataService.getDevices(hass);
      } catch (error) {
        console.warn('Failed to fetch entity registry or devices:', error);
      }

      const entityRegistryMap = new Map();
      entityRegistry.forEach((entity: any) => {
        if (entity.entity_id.startsWith('automation.')) {
          entityRegistryMap.set(entity.entity_id, entity);
        }
      });

      let count = 0;
      for (const state of automationStates) {
        const entityId = state.entity_id;
        const entityReg = entityRegistryMap.get(entityId);
        
        // Get area_id via device
        let automationAreaId: string | undefined = undefined;
        if (entityReg?.device_id) {
          const device = devices.find(d => d.id === entityReg.device_id);
          if (device?.area_id) {
            automationAreaId = device.area_id;
          }
        }
        
        if (automationAreaId === areaId) {
          const enabled = state.attributes?.enabled !== false && state.state !== 'off';
          if (enabled) {
            count++;
          }
        }
      }
      
      return count;
    } else {
      // Count all enabled automations
      return automationStates.filter((state: any) => {
        const enabled = state.attributes?.enabled !== false && state.state !== 'off';
        return enabled;
      }).length;
    }
  }
}
