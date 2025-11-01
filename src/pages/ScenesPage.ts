import { CustomizationManager } from '../utils/CustomizationManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity } from '../types/types';
import { DragAndDropManager } from '../utils/DragAndDropManager';
import { localize } from '../utils/LocalizationService';

export class ScenesPage {
  private customizationManager?: CustomizationManager;
  private dragAndDropManager?: DragAndDropManager;
  private _hass?: any;
  private _config?: any;
  private _container?: HTMLElement; // Store reference to the container

  constructor() {
    // Regular class constructor
  }

  set hass(hass: any) {
    this._hass = hass;
  }

  async setConfig(config: any) {
    this._config = config;
    
    // Initialize customization manager from config
    if (config.customizations && this._hass) {
      this.customizationManager = CustomizationManager.getInstance(this._hass);
      await this.customizationManager.setCustomizations(config.customizations);
      
      // Initialize drag and drop manager with scenes context  
      this.dragAndDropManager = new DragAndDropManager(
        (areaId) => this.handleSaveCurrentOrder(areaId),
        this.customizationManager,
        'scenes' // Use scenes context for scenes page
      );
    }
  }

  private createScenesTitle(): HTMLElement {
    const titleElement = document.createElement('h1');
    titleElement.className = 'apple-page-title';
    titleElement.textContent = localize('pages.scenes');
    return titleElement;
  }

  async render(
    container: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    // Store container reference for use in save methods
    this._container = container;
    // Preserve existing header and permanent chips elements
    const existingHeader = container.querySelector('.apple-home-header');
    const existingPermanentChips = container.querySelector('.permanent-chips');
    
    // Clear container but preserve important elements
    container.innerHTML = '';
    
    // Re-insert preserved elements in correct order
    if (existingHeader) {
      container.appendChild(existingHeader);
    }
    
    // Add scenes title
    const scenesTitle = this.createScenesTitle();
    container.appendChild(scenesTitle);
    
    // Re-insert permanent chips after title (this ensures chips are always below h1)
    if (existingPermanentChips) {
      container.appendChild(existingPermanentChips);
    }

    try {
      // Get data from Home Assistant
      const entities = await DataService.getEntities(hass);
      
      // Filter entities for scenes and scripts and exclude those marked for exclusion
      const allScenesEntities = entities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];
        return DashboardConfig.isScenesDomain(domain);
      });

      // Load excluded entities list once (performance optimization)
      const excludedFromDashboard = await this.customizationManager?.getExcludedFromDashboard() || [];
      const excludedSet = new Set(excludedFromDashboard);
      
      // Now apply exclusions efficiently using Set lookup (O(1))
      const scenesEntities = allScenesEntities.filter(entity => !excludedSet.has(entity.entity_id));

      // Apply user customizations
      if (!this.customizationManager) {
        throw new Error(localize('errors.customization_manager_not_initialized'));
      }
      
      const customizations = this.customizationManager.getCustomizations();
      
      // Apply entity order customizations with context
      let sortedScenes = [...scenesEntities];
      const savedOrder = this.customizationManager.getSavedCardOrderWithContext('scenes_section', 'scenes');
      
      if (savedOrder.length > 0) {
        const entityMap = new Map(scenesEntities.map(entity => [entity.entity_id, entity]));
        const orderedScenes: Entity[] = [];
        
        // First, add scenes in the saved order
        savedOrder.forEach((entityId: string) => {
          if (entityMap.has(entityId)) {
            orderedScenes.push(entityMap.get(entityId)!);
            entityMap.delete(entityId);
          }
        });
        
        // Then, add any new scenes that weren't in the saved order
        const remainingScenes = Array.from(entityMap.values());
        orderedScenes.push(...remainingScenes);
        
        sortedScenes = orderedScenes;
      }

      // Apply tall card settings - handled by CardManager in the new structure
      sortedScenes.forEach(entity => {
        // CardManager handles tall card settings in the new structure
        (entity as any).is_tall = false; // Default for scenes
      });

      // Render all scenes in a grid layout (non-carousel)
      await this.renderScenesGrid(
        container,
        sortedScenes,
        hass,
        onTallToggle
      );
      
    } catch (error) {
      console.error('Error rendering scenes page:', error);
    }
  }

  private async renderScenesGrid(
    container: HTMLElement,
    scenesEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.customizationManager) {
      throw new Error(localize('errors.customization_manager_not_initialized'));
    }

    // Create a grid container for all scenes
    const gridContainer = document.createElement('div');
    gridContainer.className = 'scenes-grid';
    gridContainer.dataset.areaId = 'scenes_section';
    gridContainer.dataset.sectionType = 'scenes';

    // Create scene cards
    for (const entity of scenesEntities) {
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (cardConfig) {
        cardConfig.section_type = 'scenes';
        await this.createAndAppendCard(cardConfig, gridContainer, hass, onTallToggle);
      }
    }

    container.appendChild(gridContainer);
  }

  private createEntityCard(entityId: string, hass: any, entity: Entity): any {
    if (!this.customizationManager) return null;

    const domain = entityId.split('.')[0];
    const stateObj = hass.states[entityId];
    
    if (!stateObj) return null;

    // Get user customizations for this entity (for individual entity overrides like names)
    const customizations = this.customizationManager.getCustomizations();
    const entityCustomizations = customizations.entities?.[entityId] || null;
    
    // Priority: custom_name → entityCustomizations.name → friendly_name → entity_id
    const customName = entityCustomizations?.custom_name || null;
    
    // Create base card configuration
    const cardConfig: any = {
      type: 'custom:apple-home-card',
      entity: entityId,
      name: customName || entityCustomizations?.name || stateObj.attributes.friendly_name || entityId,
      area_id: 'scenes_section',
      is_tall: (entity as any).is_tall !== undefined ? (entity as any).is_tall : false, // Scenes are typically not tall by default
      ...entityCustomizations
    };

    return cardConfig;
  }

  private async createAndAppendCard(
    cardConfig: any,
    gridContainer: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    // Create wrapper div for the card
    const wrapper = document.createElement('div');
    wrapper.className = 'entity-card-wrapper';
    wrapper.dataset.entityId = cardConfig.entity;
    wrapper.dataset.areaId = 'scenes_section';
    
    // Apply tall class if needed
    if (cardConfig.is_tall) {
      wrapper.classList.add('tall');
    }

    // Create the card element
    const cardElement = document.createElement('apple-home-card') as any;
    cardElement.setConfig(cardConfig);
    cardElement.hass = hass;

    // Add edit mode controls - rename button for scenes
    const controls = document.createElement('div');
    controls.className = 'entity-controls';
    
    // Rename button (left top corner)
    const renameButton = document.createElement('button');
    renameButton.className = 'entity-control-btn rename-btn';
    renameButton.innerHTML = `<ha-icon icon="mdi:rename-box"></ha-icon>`;
    renameButton.title = localize('edit.rename_entity') || 'Rename';
    
    renameButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.handleRenameEntity(cardConfig.entity, hass);
    });
    
    controls.appendChild(renameButton);
    
    wrapper.appendChild(controls);
    wrapper.appendChild(cardElement);
    gridContainer.appendChild(wrapper);
  }

  private async handleRenameEntity(entityId: string, hass: any) {
    if (!entityId || !hass || !this.customizationManager) return;

    const state = hass.states[entityId];
    if (!state) return;

    const currentCustomName = this.customizationManager.getEntityCustomName(entityId);
    const originalName = state.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
    const currentName = currentCustomName || originalName;

    // Create a modal/prompt for renaming
    const newName = prompt(localize('edit.rename_entity') || 'Rename', currentName);
    
    if (newName === null) return; // User cancelled
    
    const trimmedName = newName.trim();
    
    if (trimmedName === '' || trimmedName === originalName) {
      // Remove custom name (revert to original)
      await this.customizationManager.setEntityCustomName(entityId, null);
    } else if (trimmedName !== currentName) {
      // Set new custom name
      await this.customizationManager.setEntityCustomName(entityId, trimmedName);
    }

    // Directly refresh all cards with this entity
    await this.refreshEntityCards(entityId);
  }

  private async refreshEntityCards(entityId: string) {
    // Find all apple-home-card elements with this entity
    const allCards = document.querySelectorAll('apple-home-card');
    
    allCards.forEach((cardElement: any) => {
      // Use entityId getter if available, otherwise try entity property
      const cardEntityId = cardElement.entityId || cardElement.entity;
      if (cardEntityId === entityId && cardElement.hass) {
        // Force re-render
        if (typeof cardElement.render === 'function') {
          cardElement.render();
        }
      }
    });
    
    // Also trigger global refresh for other components
    const event = new CustomEvent('apple-home-dashboard-refresh', {
      bubbles: true,
      composed: true
    });
    document.dispatchEvent(event);
  }

  public updateDragAndDrop(editMode: boolean, container: HTMLElement) {
    if (!this.dragAndDropManager) return;
    
    if (editMode) {
      // Add a small delay to ensure cards are fully rendered
      setTimeout(() => {
        this.dragAndDropManager!.enableDragAndDrop(container);
        // Update entity wrapper styles for edit mode
        const entityWrappers = container.querySelectorAll('.entity-card-wrapper');
        entityWrappers.forEach((wrapper) => {
          const element = wrapper as HTMLElement;
          element.classList.toggle('edit-mode', true);
          
          const appleHomeCard = element.querySelector('apple-home-card') as any;
          if (appleHomeCard && typeof appleHomeCard.refreshEditMode === 'function') {
            appleHomeCard.refreshEditMode();
          }
        });
      }, 100);
    } else {
      this.dragAndDropManager.disableDragAndDrop(container);
      // Update entity wrapper styles
      const entityWrappers = container.querySelectorAll('.entity-card-wrapper');
      entityWrappers.forEach((wrapper) => {
        const element = wrapper as HTMLElement;
        element.classList.toggle('edit-mode', false);
        
        const appleHomeCard = element.querySelector('apple-home-card') as any;
        if (appleHomeCard && typeof appleHomeCard.refreshEditMode === 'function') {
          appleHomeCard.refreshEditMode();
        }
      });
    }
  }

  private handleSaveCurrentOrder(areaId: string) {
    if (!this._container) {
      return;
    }
    
    // Look for the area container within the stored container
    const areaContainer = this._container.querySelector(`[data-area-id="${areaId}"]`);
    if (!areaContainer) {
      return;
    }

    const wrappers = areaContainer.querySelectorAll('.entity-card-wrapper:not(.drag-placeholder)');
    const entityOrder = Array.from(wrappers).map(wrapper => {
      const element = wrapper as HTMLElement;
      return element.dataset.entityId || '';
    }).filter(id => id);

    // Save with 'scenes' context
    if (this.customizationManager) {
      this.customizationManager.saveCardOrderWithContext(areaId, entityOrder, 'scenes');
    }
  }
}
