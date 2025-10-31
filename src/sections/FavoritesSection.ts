import { CustomizationManager } from '../utils/CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity, CardConfig } from '../types/types';
import { localize } from '../utils/LocalizationService';

export class FavoritesSection {
  private customizationManager: CustomizationManager;

  constructor(customizationManager: CustomizationManager) {
    this.customizationManager = customizationManager;
  }

  async render(
    container: HTMLElement,
    allEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    // Get favorite accessories from settings
    const favoriteAccessories = await this.customizationManager.getFavoriteAccessories();
    
    if (favoriteAccessories.length === 0) {
      return; // Don't render if no favorites
    }

    // Filter entities to only show favorites that exist and are supported
    const favoriteEntities = favoriteAccessories
      .map((entityId: string) => {
        const state = hass.states[entityId];
        if (!state) {
          return null;
        }
        
        // Check if entity is hidden in the entity registry
        const entityRegistry = hass.entities?.[entityId];
        if (entityRegistry && entityRegistry.hidden_by) {
          return null;
        }
        
        // Check if entity is disabled in the entity registry
        if (entityRegistry && entityRegistry.disabled_by) {
          return null;
        }
        
        const domain = entityId.split('.')[0];
        if (!DashboardConfig.isSupportedDomain(domain)) {
          return null;
        }
        
        // Get custom name from CustomizationManager
        const customizations = this.customizationManager.getCustomizations();
        const entityCustomizations = customizations.entities?.[entityId] || null;
        const customName = entityCustomizations?.custom_name || null;

        return {
          entity_id: entityId,
          name: customName || state.attributes.friendly_name || entityId,
          area_id: state.attributes.area_id || 'favorites_section', // Use special area for favorites
          domain: domain
        };
      })
      .filter(Boolean) as Entity[];

    if (favoriteEntities.length === 0) {
      return; // Don't render if no valid favorites
    }

    // Add favorites section title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'apple-home-section-title';
    titleDiv.innerHTML = `<span>${localize('section_titles.favorites')}</span>`;
    container.appendChild(titleDiv);

    // Create cards container using the same class as AreaSection
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'area-entities'; // Use same class as other sections
    cardsContainer.dataset.areaId = 'favorites'; // Set area ID for customizations
    container.appendChild(cardsContainer);

    // Apply saved card order if available
    const savedOrder = this.customizationManager.getSavedCardOrderWithContext('favorites', 'home');
    let orderedEntities = [...favoriteEntities];
    
    if (savedOrder && savedOrder.length > 0) {
      orderedEntities = this.customizationManager.applySavedCardOrder(favoriteEntities, savedOrder);
    }

    // Create cards for each favorite entity in the correct order
    for (const entity of orderedEntities) {
      await this.createAndAppendCard(entity, cardsContainer, hass, onTallToggle);
    }
  }

  private async createAndAppendCard(
    entity: Entity,
    container: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    try {
      // Create card config using the same pattern as AreaSection
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (!cardConfig) {
        console.warn(`Failed to create card config for entity: ${entity.entity_id}`);
        return;
      }

      // Use the same card creation logic as AreaSection
      let cardElement: HTMLElement;
      
      if (cardConfig.type === 'custom:apple-home-card') {
        cardElement = document.createElement('apple-home-card') as HTMLElement;
        
        // For favorites, always use regular size (not tall)
        const configWithTall = { ...cardConfig, is_tall: false };
        
        (cardElement as any).setConfig(configWithTall);
        (cardElement as any).hass = hass;
      } else {
        // Handle other card types (same as AreaSection)
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
      
      // Favorites are always regular size, never tall
      // Don't add tall class
      
      // Add edit mode controls - rename button
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
      container.appendChild(wrapper);
    } catch (error) {
      console.error(`Error creating card for entity ${entity.entity_id}:`, error);
    }
  }

  private createEntityCard(entityId: string, hass: any, entity?: Entity): CardConfig | null {
    const state = hass.states[entityId];
    if (!state) {
      console.warn(`Entity ${entityId} not found in hass.states`);
      return null;
    }

    const domain = entityId.split('.')[0];
    
    // Get custom name from CustomizationManager (priority: custom_name → friendly_name → entity_id)
    const customizations = this.customizationManager.getCustomizations();
    const entityCustomizations = customizations.entities?.[entityId] || null;
    const customName = entityCustomizations?.custom_name || null;
    
    let friendlyName = customName || state.attributes?.friendly_name || entityId;
    
    // Determine card type and properties
    let cardType = 'custom:apple-home-card';
    let isTallCard = false; // Favorites are always regular size
    
    const card: CardConfig = {
      type: cardType,
      entity: entityId,
      name: friendlyName,
      domain: domain,
      is_tall: isTallCard
    };
    
    // Add default icon for scenes/scripts without icons
    if (DashboardConfig.isScenesDomain(domain) && !state.attributes?.icon) {
      (card as any).default_icon = 'mdi:home';
    }
    
    return card;
  }

  private async handleRenameEntity(entityId: string, hass: any) {
    if (!entityId || !hass) return;

    const state = hass.states[entityId];
    if (!state) return;

    const customizationManager = CustomizationManager.getInstance(hass);
    const currentCustomName = customizationManager.getEntityCustomName(entityId);
    const originalName = state.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
    const currentName = currentCustomName || originalName;

    // Create a modal/prompt for renaming
    const newName = prompt(localize('edit.rename_entity') || 'Rename', currentName);
    
    if (newName === null) return; // User cancelled
    
    const trimmedName = newName.trim();
    
    if (trimmedName === '' || trimmedName === originalName) {
      // Remove custom name (revert to original)
      await customizationManager.setEntityCustomName(entityId, null);
    } else if (trimmedName !== currentName) {
      // Set new custom name
      await customizationManager.setEntityCustomName(entityId, trimmedName);
    }

    // Trigger a refresh to update all cards showing this entity
    const event = new CustomEvent('apple-home-dashboard-refresh', {
      bubbles: true,
      composed: true
    });
    document.dispatchEvent(event);
  }

  private applyCardStyling(cardElement: any, entity: Entity): void {
    const state = cardElement.hass.states[entity.entity_id];
    if (!state) return;
    
    const domain = entity.entity_id.split('.')[0];
    const entityData = DashboardConfig.getEntityData(state, domain);
    
    if (entityData) {
      const styles = {
        '--card-primary-color': entityData.textColor,
        '--card-background-color': entityData.backgroundColor,
        '--primary-text-color': entityData.textColor,
        '--secondary-text-color': entityData.textColor + '80',
        '--icon-color': entityData.iconColor,
        '--rgb-primary-color': entityData.iconBackgroundColor,
        '--mush-rgb-primary': entityData.iconBackgroundColor?.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') || '255, 175, 0'
      };
      
      Object.entries(styles).forEach(([property, value]) => {
        if (value) {
          cardElement.style.setProperty(property, value);
        }
      });
    }
  }
}
