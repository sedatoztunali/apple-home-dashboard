import { CustomizationManager } from '../utils/CustomizationManager';
import { UsageTracker } from '../utils/UsageTracker';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity, CardConfig } from '../types/types';
import { localize } from '../utils/LocalizationService';
import { CardManager } from '../utils/CardManager';

export class CommonlyUsedSection {
  private customizationManager: CustomizationManager;
  private usageTracker: UsageTracker;
  private cardManager?: CardManager;

  constructor(customizationManager: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = customizationManager;
    this.usageTracker = UsageTracker.getInstance(customizationManager);
    this.cardManager = cardManager;
  }

  async render(
    container: HTMLElement,
    allEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    // Get commonly used entities (minimum 2 interactions in last 24 hours)
    const commonlyUsedEntityIds = await this.usageTracker.getCommonlyUsed(2, 24);
    
    if (commonlyUsedEntityIds.length === 0) {
      return; // Don't render if no commonly used entities
    }

    // Filter entities to only show commonly used ones that exist and are supported
    const commonlyUsedEntities = commonlyUsedEntityIds
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
        
        return {
          entity_id: entityId,
          name: state.attributes.friendly_name || entityId,
          area_id: state.attributes.area_id || 'commonly_used_section', // Use special area for commonly used
          domain: domain
        };
      })
      .filter(Boolean) as Entity[];

    if (commonlyUsedEntities.length === 0) {
      return; // Don't render if no valid commonly used entities
    }

    // Add commonly used section title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'apple-home-section-title';
    titleDiv.innerHTML = `<span>${localize('section_titles.commonly_used')}</span>`;
    container.appendChild(titleDiv);

    // Create cards container using the same class as AreaSection
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'area-entities'; // Use same class as other sections
    cardsContainer.dataset.areaId = 'commonly_used'; // Set area ID for customizations
    container.appendChild(cardsContainer);

    // Apply saved card order if available
    const savedOrder = this.customizationManager.getSavedCardOrderWithContext('commonly_used', 'home');
    let orderedEntities = [...commonlyUsedEntities];
    
    if (savedOrder && savedOrder.length > 0) {
      orderedEntities = this.customizationManager.applySavedCardOrder(commonlyUsedEntities, savedOrder);
    }

    // Create cards for each commonly used entity in the correct order
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
        
        // Determine if card should be tall based on customizations
        const shouldBeTall = this.cardManager?.shouldCardBeTall(entity.entity_id, entity.area_id, 'home') || false;
        const configWithTall = { ...cardConfig, is_tall: shouldBeTall };
        
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
      
      // Determine if card should be tall based on customizations
      const shouldBeTall = this.cardManager?.shouldCardBeTall(entity.entity_id, entity.area_id, 'home') || false;
      if (shouldBeTall) {
        wrapper.classList.add('tall');
      }
      
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
    let friendlyName = state.attributes?.friendly_name || entityId;
    
    // Determine card type and properties
    let cardType = 'custom:apple-home-card';
    let isTallCard = false;
    
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
}
