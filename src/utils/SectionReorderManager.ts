import { CustomizationManager } from './CustomizationManager';
import { UsageTracker } from './UsageTracker';
import Sortable from 'sortablejs';
import { localize } from './LocalizationService';
import { RTLHelper } from './RTLHelper';

interface SectionItem {
  id: string;
  name: string;
  type: 'area' | 'scenes' | 'cameras' | 'favorites' | 'commonly_used';
  visible: boolean;
  order: number;
}

export class SectionReorderManager {
  private modal?: HTMLElement;
  private customizationManager: CustomizationManager;
  private onSaveCallback: () => void;
  private sections: SectionItem[] = [];
  private sortableInstance?: Sortable;

  constructor(customizationManager: CustomizationManager, onSaveCallback: () => void) {
    this.customizationManager = customizationManager;
    this.onSaveCallback = onSaveCallback;
  }

  public async showReorderModal(areas: any[], hass: any) {
    // Prepare sections data
    this.sections = await this.prepareSectionsData(areas, hass);
    
    // Create and show modal
    this.createModal();
    this.setupEventListeners();
    this.showModal();
  }

  private async prepareSectionsData(areas: any[], hass: any): Promise<SectionItem[]> {
    const sections: SectionItem[] = [];
    const customizations = this.customizationManager.getCustomizations();
    
    // Get current section order and visibility settings
    const sectionOrder = customizations.home?.sections?.order || [];
    const hiddenSections = customizations.home?.sections?.hidden || [];

    // Add Cameras section (first in default order)
    const cameraEntities = Object.values(hass.states).filter((state: any) => {
      if (!state.entity_id.startsWith('camera.')) {
        return false;
      }
      
      // Check if entity is hidden in the entity registry
      const entityRegistry = hass.entities?.[state.entity_id];
      if (entityRegistry && entityRegistry.hidden_by) {
        return false;
      }
      
      // Check if entity is disabled in the entity registry
      if (entityRegistry && entityRegistry.disabled_by) {
        return false;
      }
      
      return true;
    });
    
    if (cameraEntities.length > 0) {
      sections.push({
        id: 'cameras_section',
        name: localize('section_titles.cameras'),
        type: 'cameras',
        visible: !hiddenSections.includes('cameras_section'),
        order: sectionOrder.indexOf('cameras_section') !== -1 ? sectionOrder.indexOf('cameras_section') : 0
      });
    }

    // Add Scenes section (second in default order)
    const scenesEntities = Object.values(hass.states).filter((state: any) => {
      if (!state.entity_id.startsWith('scene.') && !state.entity_id.startsWith('script.')) {
        return false;
      }
      
      // Check if entity is hidden in the entity registry
      const entityRegistry = hass.entities?.[state.entity_id];
      if (entityRegistry && entityRegistry.hidden_by) {
        return false;
      }
      
      // Check if entity is disabled in the entity registry
      if (entityRegistry && entityRegistry.disabled_by) {
        return false;
      }
      
      return true;
    });
    
    if (scenesEntities.length > 0) {
      const baseOrder = cameraEntities.length > 0 ? 1 : 0;
      sections.push({
        id: 'scenes_section',
        name: localize('section_titles.scenes'),
        type: 'scenes',
        visible: !hiddenSections.includes('scenes_section'),
        order: sectionOrder.indexOf('scenes_section') !== -1 ? sectionOrder.indexOf('scenes_section') : baseOrder
      });
    }

    // Add Favorites section (first in default order)
    const favoriteAccessories = await this.customizationManager.getFavoriteAccessories();
    if (favoriteAccessories.length > 0) {
      const baseOrder = 0; // First section
      sections.push({
        id: 'favorites_section',
        name: localize('section_titles.favorites'),
        type: 'favorites',
        visible: !hiddenSections.includes('favorites_section'),
        order: sectionOrder.indexOf('favorites_section') !== -1 ? sectionOrder.indexOf('favorites_section') : baseOrder
      });
    }

    // Add Commonly Used section (second in default order, after favorites)
    const usageTracker = UsageTracker.getInstance(this.customizationManager);
    const hasCommonlyUsed = await usageTracker.hasCommonlyUsed(2, 24);
    if (hasCommonlyUsed) {
      const baseOrder = (favoriteAccessories.length > 0 ? 1 : 0); // After favorites
      sections.push({
        id: 'commonly_used_section',
        name: localize('section_titles.commonly_used'),
        type: 'commonly_used',
        visible: !hiddenSections.includes('commonly_used_section'),
        order: sectionOrder.indexOf('commonly_used_section') !== -1 ? sectionOrder.indexOf('commonly_used_section') : baseOrder
      });
    }

    // Add area sections
    areas.forEach((area, index) => {
      const areaId = area.area_id || area.id;
      const areaName = area.name || areaId;
      const baseOrder = (favoriteAccessories.length > 0 ? 1 : 0) + 
                       (hasCommonlyUsed ? 1 : 0) + 
                       (cameraEntities.length > 0 ? 1 : 0) + 
                       (scenesEntities.length > 0 ? 1 : 0) + 
                       index;
      
      sections.push({
        id: areaId,
        name: areaName,
        type: 'area',
        visible: !hiddenSections.includes(areaId),
        order: sectionOrder.indexOf(areaId) !== -1 ? sectionOrder.indexOf(areaId) : baseOrder
      });
    });

    // Check if there are entities without areas (Default Room)
    let hasDefaultRoom = false;
    try {
      const entities = hass.entities ? Object.values(hass.entities) : [];
      const devices = hass.devices ? Object.values(hass.devices) : [];
      
      // Check if any entities would be grouped under 'no_area'
      hasDefaultRoom = entities.some((entity: any) => {
        if (!entity.area_id && entity.device_id) {
          const device = devices.find((d: any) => d.id === entity.device_id);
          return !(device as any)?.area_id;
        }
        return !entity.area_id;
      });
    } catch (error) {
      // If we can't determine, assume there might be a default room
      hasDefaultRoom = true;
    }

    // Add Default Room if it exists
    if (hasDefaultRoom) {
      const defaultRoomOrder = (cameraEntities.length > 0 ? 1 : 0) + 
                              (scenesEntities.length > 0 ? 1 : 0) + 
                              (favoriteAccessories.length > 0 ? 1 : 0) + 
                              areas.length;
      
      sections.push({
        id: 'no_area',
        name: localize('pages.default_room'),
        type: 'area',
        visible: !hiddenSections.includes('no_area'),
        order: sectionOrder.indexOf('no_area') !== -1 ? sectionOrder.indexOf('no_area') : defaultRoomOrder
      });
    }

    // Sort by current order
    sections.sort((a, b) => a.order - b.order);
    
    return sections;
  }

  private createModal() {
    this.modal = document.createElement('div');
    this.modal.className = `apple-section-reorder-modal ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}`;
    
    this.modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <button class="modal-cancel">${localize('ui_actions.cancel')}</button>
          <h2>${localize('section_reorder.title')}</h2>
          <button class="modal-done">${localize('ui_actions.done')}</button>
        </div>
        <div class="modal-body">
          <div class="sections-list">
            ${this.sections.map((section, index) => `
              <div class="section-item" data-section-id="${section.id}" data-index="${index}">
                <button class="section-visibility-toggle ${section.visible ? 'visible' : 'hidden'}" 
                        data-section-id="${section.id}">
                  <ha-icon icon="${section.visible ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon>
                </button>
                <div class="section-info">
                  <span class="section-name">${section.name}</span>
                </div>
                <div class="section-drag-handle">
                  <ha-icon icon="mdi:menu"></ha-icon>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.addModalStyles();
    document.body.appendChild(this.modal);
  }

  private addModalStyles() {
    if (document.querySelector('#apple-section-reorder-styles')) return;

    const style = document.createElement('style');
    style.id = 'apple-section-reorder-styles';
    style.textContent = `
      .apple-section-reorder-modal {
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

      .apple-section-reorder-modal.show .modal-content {
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

      .sections-list {
        padding: 0;
        border-radius: 10px !important;
        overflow: hidden;
        margin: 15px;
      }

      .section-item {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        border-bottom: 0.5px solid rgba(84, 84, 88, 0.3);
        background: rgba(44, 44, 46, 0.8);
        user-select: none;
        -webkit-user-select: none;
        transition: background 0.2s ease;
      }

      .section-item:last-child {
        border-bottom: none;
      }

      .section-item.dragging {
        background: rgba(44, 44, 46, 1);
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
      }

      .section-item.drag-over {
        border-top: 2px solid #ffaf00;
      }

      .section-drag-handle {
        color: #858585;
      }

      .section-drag-handle * {
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
      }

      .section-info {
        flex: 1;
        min-width: 0;
      }

      .section-name {
        color: white;
        font-size: 14px;
        font-weight: 500;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .section-visibility-toggle {
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
        position: relative;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }

      .section-visibility-toggle * {
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
      }

      .section-visibility-toggle.hidden {
        color: #ffffff80;
      }

      .section-item.hidden {
        opacity: 0.6;
      }

      .section-item.hidden .section-name {
        color: #ffffff;
      }

      /* RTL Support - Only fix eye icon margin */
      .apple-section-reorder-modal.rtl .section-visibility-toggle {
        margin-right: 0;
        margin-left: 12px;
      }

      /* Sortable.js ghost (dragged item) */
      .sortable-ghost {
        opacity: 0 !important;
      }

      /* Sortable.js drag class (actual dragged element) */
      .sortable-drag {
        opacity: 1 !important;
        background: rgba(44, 44, 46, 1) !important;
      }

      /* Sortable.js fallback class (fallback dragged element) */
      .sortable-fallback {
        opacity: 1 !important;
      }

      @media (max-width: 480px) {
        .apple-section-reorder-modal {
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

        .apple-section-reorder-modal.show .modal-content {
          transform: translateY(0);
          opacity: 1;
        }
        
        .section-item {
          padding: 16px 20px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners() {
    if (!this.modal) return;

    // Cancel button
    const cancelBtn = this.modal.querySelector('.modal-cancel');
    cancelBtn?.addEventListener('click', () => this.closeModal());

    // Done button
    const doneBtn = this.modal.querySelector('.modal-done');
    doneBtn?.addEventListener('click', () => this.saveAndClose());

    // Backdrop click
    const backdrop = this.modal.querySelector('.modal-backdrop');
    backdrop?.addEventListener('click', () => this.closeModal());

    // Visibility toggles - use event delegation with both click and touchstart for better mobile support
    const sectionsListEl = this.modal.querySelector('.sections-list');
    
    // Handle click events
    sectionsListEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const toggleButton = target.closest('.section-visibility-toggle');
      if (toggleButton) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSectionVisibility(toggleButton as HTMLElement);
      }
    }, { capture: true });

    // Handle touch events for better mobile responsiveness
    sectionsListEl?.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      const toggleButton = target.closest('.section-visibility-toggle');
      if (toggleButton) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSectionVisibility(toggleButton as HTMLElement);
      }
    }, { capture: true });

    // Setup Sortable.js
    this.setupSortable();

    // Escape key
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  private setupSortable() {
    const sectionsList = this.modal?.querySelector('.sections-list');
    if (!sectionsList) return;

    // Destroy existing sortable instance if it exists
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
    }

    // Create Sortable instance with Home Assistant's exact configuration
    this.sortableInstance = new Sortable(sectionsList as HTMLElement, {
      // Use Home Assistant's exact settings for smooth drag-and-drop
      scroll: true,
      scrollSensitivity: 100,
      scrollSpeed: 3,
      bubbleScroll: false,
      forceAutoScrollFallback: true,
      fallbackOnBody: true,
      swapThreshold: 1,
      animation: 150,
      easing: "cubic-bezier(1, 0, 0, 1)",
      delay: 150,
      delayOnTouchOnly: true,
      filter: '.section-visibility-toggle',
      preventOnFilter: false,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag', 
      fallbackClass: 'sortable-fallback',
      onStart: () => {
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
      },
      onEnd: (evt: any) => {
        // Re-enable text selection
        document.body.style.userSelect = '';
        
        // Update internal sections order when drag ends
        this.handleItemMoved(evt);
      }
    });
  }

  private handleItemMoved(evt: any) {
    const { oldIndex, newIndex } = evt;
    
    if (oldIndex === newIndex) return;

    // Update internal sections array
    const movedSection = this.sections.splice(oldIndex, 1)[0];
    this.sections.splice(newIndex, 0, movedSection);

    // Update order values
    this.sections.forEach((section, index) => {
      section.order = index;
    });
  }

  private toggleSectionVisibility(button: HTMLElement) {
    if (!button || !button.classList.contains('section-visibility-toggle')) {
      return;
    }

    const sectionId = button.dataset.sectionId;
    if (!sectionId) return;

    // Find section in our data
    const section = this.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Add immediate visual feedback that the click was registered
    button.style.transform = 'scale(0.85)';
    button.style.background = 'rgba(255, 255, 255, 0.2)';

    // Toggle visibility
    section.visible = !section.visible;

    // Update button state with feedback
    setTimeout(() => {
      this.updateVisibilityButtonState(button, section.visible);

      // Update section item appearance
      const sectionItem = button.closest('.section-item');
      if (sectionItem) {
        sectionItem.classList.toggle('hidden', !section.visible);
      }

      // Reset button style after update
      button.style.transform = '';
      button.style.background = '';
    }, 100);
  }

  private updateVisibilityButtonState(button: HTMLElement, visible: boolean) {
    // Update button classes
    button.classList.toggle('visible', visible);
    button.classList.toggle('hidden', !visible);

    // Update icon
    const haIcon = button.querySelector('ha-icon');
    if (haIcon) {
      haIcon.setAttribute('icon', visible ? 'mdi:eye' : 'mdi:eye-off');
    }
  }



  private showModal() {
    if (!this.modal) return;
    
    // Block background scrolling
    document.body.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
      this.modal?.classList.add('show');
    });
  }

  private closeModal() {
    if (!this.modal) return;

    // Restore background scrolling
    document.body.style.overflow = '';

    // Clean up sortable instance
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = undefined;
    }

    this.modal.classList.remove('show');
    
    setTimeout(() => {
      document.removeEventListener('keydown', this.handleEscapeKey);
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = undefined;
    }, 300);
  }

  private async saveAndClose() {
    // Save the new section order and visibility settings
    await this.saveSectionConfiguration();
    
    // Clean up sortable instance
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = undefined;
    }
    
    // Start closing the modal with fade effect
    if (this.modal) {
      this.modal.style.transition = 'opacity 0.3s ease-out';
      this.modal.style.opacity = '0';
    }
    
    // Wait for modal to fully fade before doing anything else
    setTimeout(() => {
      // Restore background scrolling
      document.body.style.overflow = '';
      
      // Remove modal from DOM
      document.removeEventListener('keydown', this.handleEscapeKey);
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = undefined;
      
      // Only trigger callback after everything is cleaned up
      if (this.onSaveCallback) {
        // Additional small delay to ensure smooth transition
        setTimeout(() => {
          this.onSaveCallback();
        }, 100);
      }
    }, 350); // Wait for fade animation + buffer
  }

  private async saveSectionConfiguration() {
    // Get section order and hidden sections
    const sectionOrder = this.sections.map(s => s.id);
    const hiddenSections = this.sections
      .filter(s => !s.visible)
      .map(s => s.id);

    // Update home section directly
    const home = this.customizationManager.getCustomization('home') || {};
    if (!home.sections) home.sections = {};
    home.sections.order = sectionOrder;
    home.sections.hidden = hiddenSections;
    await this.customizationManager.setCustomization('home', home);
  }

  private handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.closeModal();
    }
  };

  public destroy() {
    this.closeModal();
    
    // Remove styles
    const styleElement = document.querySelector('#apple-section-reorder-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }
}
