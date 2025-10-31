import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DataService } from '../utils/DataService';
import { Entity, CardConfig } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export class ScenesSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;

  constructor(customizationManager: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = customizationManager;
    this.cardManager = cardManager || new CardManager(customizationManager);
  }

  async render(
    container: HTMLElement,
    scenesEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>,
    context: string = 'home',
    enableNavigation: boolean = true
  ): Promise<void> {
    // Sort scenes by last used (if available)
    const sortedScenes = await this.sortScenesByLastUsed(scenesEntities, hass, 'scenes_section', context);
    
    // Add scenes section title with navigation
    const titleDiv = document.createElement('div');
    titleDiv.className = 'apple-home-section-title';
    
    if (enableNavigation) {
      // Create clickable wrapper for just the title text and chevron
      const clickableWrapper = document.createElement('div');
      clickableWrapper.className = 'clickable-section-title';
      clickableWrapper.innerHTML = `<span>${localize('section_titles.scenes')}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      
      // Add click handler to the wrapper
      clickableWrapper.addEventListener('click', () => {
        this.navigateToPath('scenes');
      });
      
      titleDiv.appendChild(clickableWrapper);
    } else {
      titleDiv.innerHTML = `<span>${localize('section_titles.scenes')}</span>`;
    }
    
    container.appendChild(titleDiv);
    
    // Create carousel container
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    
    const carouselGrid = document.createElement('div');
    carouselGrid.className = 'carousel-grid scenes';
    carouselGrid.dataset.areaId = 'scenes_section';
    carouselGrid.dataset.sectionType = 'scenes';
    
    // Create scene cards
    for (const entity of sortedScenes) {
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (cardConfig) {
        cardConfig.section_type = 'scenes';
        await this.createAndAppendCard(cardConfig, carouselGrid, hass, onTallToggle, context);
      }
    }
    
    carouselContainer.appendChild(carouselGrid);
    
    // Add mouse wheel horizontal scrolling support for desktop
    carouselContainer.addEventListener('wheel', (e) => {
      // Only handle horizontal scrolling if we're not already scrolling vertically
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        carouselContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    
    container.appendChild(carouselContainer);
  }

  private async sortScenesByLastUsed(scenesEntities: Entity[], hass: any, areaId: string, context: string = 'home'): Promise<Entity[]> {
    try {
      // First check if there's a saved manual order for scenes
      const savedOrder = this.customizationManager.getSavedCarouselOrderWithContext(areaId, 'scenes', context);
      if (savedOrder && savedOrder.length > 0) {
        // Apply saved order, similar to how regular cards are ordered
        const entityMap = new Map(scenesEntities.map(entity => [entity.entity_id, entity]));
        const orderedScenes: Entity[] = [];
        
        // First, add scenes in the saved order
        savedOrder.forEach((entityId: string) => {
          if (entityMap.has(entityId)) {
            orderedScenes.push(entityMap.get(entityId)!);
            entityMap.delete(entityId); // Remove from map to avoid duplicates
          }
        });
        
        // Then, add any new scenes that weren't in the saved order (sorted by last used)
        const remainingScenes = Array.from(entityMap.values());
        if (remainingScenes.length > 0) {
          const sortedRemaining = await this.sortScenesByLastUsed(remainingScenes, hass, areaId);
          orderedScenes.push(...sortedRemaining);
        }
        
        return orderedScenes;
      }
      
      // Default behavior: sort by last used
      const entitiesWithLastUsed = await Promise.all(
        scenesEntities.map(async (entity) => {
          const state = hass.states[entity.entity_id];
          let lastUsed: Date | null = null;
          
          // Try to get last used from state attributes
          if (state?.attributes?.last_triggered) {
            lastUsed = new Date(state.attributes.last_triggered);
          } else if (state?.last_changed) {
            lastUsed = new Date(state.last_changed);
          } else if (state?.last_updated) {
            lastUsed = new Date(state.last_updated);
          }
          
          // If still null or epoch time, treat as never triggered
          if (!lastUsed || lastUsed.getTime() <= 0) {
            lastUsed = null;
          }
          
          return { entity, lastUsed };
        })
      );
      
      // Sort by last used (most recent first) then by name for ties
      entitiesWithLastUsed.sort((a, b) => {
        // Handle null values - null should be sorted last
        if (a.lastUsed === null && b.lastUsed === null) {
          // Both never triggered, sort by name
          const aState = hass.states[a.entity.entity_id];
          const bState = hass.states[b.entity.entity_id];
          const aName = aState?.attributes?.friendly_name || a.entity.entity_id;
          const bName = bState?.attributes?.friendly_name || b.entity.entity_id;
          return aName.localeCompare(bName);
        }
        if (a.lastUsed === null) return 1;
        if (b.lastUsed === null) return -1;
        
        // Both have valid timestamps, compare them (most recent first)
        const timeDiff = b.lastUsed.getTime() - a.lastUsed.getTime();
        if (timeDiff !== 0) return timeDiff;
        
        // If same time, sort by name
        const aState = hass.states[a.entity.entity_id];
        const bState = hass.states[b.entity.entity_id];
        const aName = aState?.attributes?.friendly_name || a.entity.entity_id;
        const bName = bState?.attributes?.friendly_name || b.entity.entity_id;
        
        return aName.localeCompare(bName);
      });
      
      return entitiesWithLastUsed.map(item => item.entity);
    } catch (error) {
      // Fallback to alphabetical sorting
      const sortedEntities = [...scenesEntities].sort((a, b) => {
        const aState = hass.states[a.entity_id];
        const bState = hass.states[b.entity_id];
        
        const aName = aState?.attributes?.friendly_name || a.entity_id;
        const bName = bState?.attributes?.friendly_name || b.entity_id;
        
        return aName.localeCompare(bName);
      });
      
      return sortedEntities;
    }
  }

  private createEntityCard(entityId: string, hass: any, entity?: Entity): CardConfig | null {
    const state = hass.states[entityId];
    if (!state) {
      return null;
    }
    
    // Get custom name from CustomizationManager (priority: custom_name → friendly_name → entity_id)
    const customizations = this.customizationManager.getCustomizations();
    const entityCustomizations = customizations.entities?.[entityId] || null;
    const customName = entityCustomizations?.custom_name || null;
    
    const friendlyName = customName || state?.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
    const domain = entityId.split('.')[0];
    
    // Determine card type and properties
    let cardType = 'custom:apple-home-card';
    let isTallCard = false;
    
    // Check if domain should be tall by default
    if (DashboardConfig.isDefaultTallDomain(domain)) {
      isTallCard = true;
    }
    
    // Check if there's a custom tall card setting from customizations
    if (entity && typeof (entity as any).is_tall !== 'undefined') {
      isTallCard = (entity as any).is_tall;
    }
    
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

  private async createAndAppendCard(
    cardConfig: any,
    container: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>,
    context: string = 'home'
  ): Promise<void> {
    try {
      let cardElement: HTMLElement;
      
      if (cardConfig.type === 'custom:apple-home-card') {
        cardElement = document.createElement('apple-home-card') as HTMLElement;
        
        // Determine if card should be tall based on customizations
        const shouldBeTall = this.cardManager.shouldCardBeTall(cardConfig.entity, container.dataset.areaId || 'unknown', context);
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
      
      // Check if this is a carousel container to adjust wrapper sizing
      const isCarousel = container.classList.contains('carousel-grid');
      const sectionType = container.dataset.sectionType;
      
      // Determine if card should be tall based on customizations
      let shouldBeTall = this.cardManager.shouldCardBeTall(cardConfig.entity, container.dataset.areaId || 'unknown', context);
      
      // For scenes in carousel, they should follow their normal sizing
      if (isCarousel && sectionType === 'scenes') {
        // Keep the customization-based tall setting
      }
      
      if (shouldBeTall) {
        wrapper.classList.add('tall');
      }
      
      // Always add edit mode controls
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'entity-controls';
      
      let controlsHTML = '';
      
      // Get entity domain to check if it's a camera or scene
      const entityDomain = cardConfig.entity ? cardConfig.entity.split('.')[0] : '';
      const isFixedSizeEntity = ['camera', 'scene', 'script'].includes(entityDomain);
      
      // Add rename button (left top corner) - always added, CSS will show/hide it
      controlsHTML += `
        <button class="entity-control-btn rename-btn" 
                data-action="rename" 
                data-entity-id="${cardConfig.entity}"
                title="${localize('edit.rename_entity') || 'Rename'}">
          <ha-icon icon="mdi:rename-box"></ha-icon>
        </button>
      `;
      
      // Only show tall toggle for regular entities (not carousels, cameras, or scenes) - right top corner
      if (!isCarousel && !isFixedSizeEntity) {
        controlsHTML += `
          <button class="entity-control-btn tall-toggle ${shouldBeTall ? 'active' : ''}" 
                  data-action="toggle-tall" 
                  title="Toggle card design">
            <ha-icon icon="mdi:${shouldBeTall ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon>
          </button>
        `;
      }
      
      controlsDiv.innerHTML = controlsHTML;
      
      // Add event listeners for controls
      const renameBtn = controlsDiv.querySelector('.rename-btn') as HTMLButtonElement;
      if (renameBtn) {
        renameBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          await this.handleRenameEntity(cardConfig.entity, hass);
        });
      }
      
      const tallToggle = controlsDiv.querySelector('.tall-toggle') as HTMLButtonElement;
      if (tallToggle && onTallToggle) {
        tallToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          onTallToggle(cardConfig.entity, container.dataset.areaId || 'unknown');
        });
      }
      
      wrapper.appendChild(controlsDiv);
      wrapper.appendChild(cardElement);
      container.appendChild(wrapper);
      
    } catch (error) {
      console.error('Error creating card:', error);
    }
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

  private navigateToPath(path: string) {
    const currentPath = window.location.pathname;
    let basePath = '';
    
    // Handle different dashboard URL patterns
    if (currentPath.startsWith('/lovelace/')) {
      basePath = '/lovelace/';
    } else if (currentPath === '/lovelace') {
      basePath = '/lovelace/';
    } else {
      // Custom dashboard: extract the dashboard name
      const pathParts = currentPath.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        basePath = `/${pathParts[0]}/`;
      } else {
        basePath = '/lovelace/';
      }
    }
    
    // Clean path and construct full URL
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const newUrl = `${basePath}${cleanPath}`;
    
    // Navigate using Home Assistant's system
    window.history.pushState(null, '', newUrl);
    const event = new Event('location-changed', { bubbles: true, composed: true });
    window.dispatchEvent(event);
  }
}
