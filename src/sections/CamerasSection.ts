import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { Entity, CardConfig } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export class CamerasSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;

  constructor(customizationManager: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = customizationManager;
    this.cardManager = cardManager || new CardManager(customizationManager);
  }

  async render(
    container: HTMLElement,
    camerasEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>,
    context: string = 'home',
    enableNavigation: boolean = true,
    sectionId: string = 'cameras_section'
  ): Promise<void> {
    // Apply saved carousel order if available
    const sortedCameras = await this.sortCamerasByOrder(camerasEntities, sectionId, context);
    
    // Add cameras section title with navigation
    const titleDiv = document.createElement('div');
    titleDiv.className = 'apple-home-section-title';
    
    if (enableNavigation) {
      // Create clickable wrapper for just the title text and chevron
      const clickableWrapper = document.createElement('div');
      clickableWrapper.className = 'clickable-section-title';
      clickableWrapper.innerHTML = `<span>${localize('section_titles.cameras')}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      
      // Add click handler to the wrapper
      clickableWrapper.addEventListener('click', () => {
        this.navigateToPath('cameras');
      });
      
      titleDiv.appendChild(clickableWrapper);
    } else {
      titleDiv.innerHTML = `<span>${localize('section_titles.cameras')}</span>`;
    }
    
    container.appendChild(titleDiv);
    
    // Create carousel container
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    
    const carouselGrid = document.createElement('div');
    carouselGrid.className = 'carousel-grid cameras';
    carouselGrid.dataset.areaId = sectionId;
    carouselGrid.dataset.sectionType = 'cameras';
    
    // Create camera cards
    for (const entity of sortedCameras) {
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (cardConfig) {
        cardConfig.section_type = 'cameras';
        // Cameras should be tall by default but even taller
        cardConfig.is_tall = true;
        // Add camera-specific settings
        (cardConfig as any).camera_view = 'snapshot';
        (cardConfig as any).refresh_interval = 10000; // 10 seconds
        
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
        
        // Add camera-specific settings if specified
        if ((cardConfig as any).camera_view) {
          configWithTall.camera_view = (cardConfig as any).camera_view;
        }
        if ((cardConfig as any).refresh_interval) {
          configWithTall.refresh_interval = (cardConfig as any).refresh_interval;
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
      
      // For cameras in carousel, they should always be "tall" but with special sizing
      if (isCarousel && sectionType === 'cameras') {
        shouldBeTall = true;
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

  private async sortCamerasByOrder(camerasEntities: Entity[], areaId: string, context: string = 'home'): Promise<Entity[]> {
    try {
      // Check if there's a saved manual order for cameras
      const savedOrder = this.customizationManager.getSavedCarouselOrderWithContext(areaId, 'cameras', context);
      if (savedOrder && savedOrder.length > 0) {
        // Apply saved order, similar to how scenes are ordered
        const entityMap = new Map(camerasEntities.map(entity => [entity.entity_id, entity]));
        const orderedCameras: Entity[] = [];
        
        // First, add cameras in the saved order
        savedOrder.forEach((entityId: string) => {
          if (entityMap.has(entityId)) {
            orderedCameras.push(entityMap.get(entityId)!);
            entityMap.delete(entityId); // Remove from map to avoid duplicates
          }
        });
        
        // Then, add any new cameras that weren't in the saved order
        const remainingCameras = Array.from(entityMap.values());
        orderedCameras.push(...remainingCameras);
        
        return orderedCameras;
      }
      
      // Default behavior: return cameras in original order
      return camerasEntities;
    } catch (error) {
      console.error('Error sorting cameras by order:', error);
      return camerasEntities;
    }
  }
}
