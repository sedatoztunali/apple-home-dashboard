import { CustomizationManager } from '../utils/CustomizationManager';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export class WeatherSection {
  private customizationManager: CustomizationManager;

  constructor(customizationManager: CustomizationManager) {
    this.customizationManager = customizationManager;
  }

  async render(
    container: HTMLElement,
    weatherEntityId: string,
    hass: any,
    enableNavigation: boolean = false
  ): Promise<void> {
    // Add weather section title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'apple-home-section-title';
    
    if (enableNavigation) {
      // Create clickable wrapper for just the title text and chevron
      const clickableWrapper = document.createElement('div');
      clickableWrapper.className = 'clickable-section-title';
      clickableWrapper.innerHTML = `<span>${localize('section_titles.weather')}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      titleDiv.appendChild(clickableWrapper);
    } else {
      titleDiv.innerHTML = `<span>${localize('section_titles.weather')}</span>`;
    }
    
    container.appendChild(titleDiv);

    // Create container for weather card
    const weatherContainer = document.createElement('div');
    weatherContainer.className = 'weather-section-container';
    weatherContainer.style.cssText = 'width: 100%; margin-bottom: 32px;';

    // Create Home Assistant weather-forecast card using Lovelace card creator
    // Try to use Home Assistant's card creator helper if available
    const cardConfig = {
      type: 'weather-forecast',
      entity: weatherEntityId,
      show_current: true,
      show_forecast: false,
      forecast_type: 'daily'
    };

    let weatherCardElement: HTMLElement;

    // Try to create card using Home Assistant's card creator (if available)
    if ((window as any).loadCardHelpers) {
      try {
        const helpers = await (window as any).loadCardHelpers();
        if (helpers && helpers.createCardElement) {
          weatherCardElement = helpers.createCardElement(cardConfig) as HTMLElement;
          (weatherCardElement as any).hass = hass;
        } else {
          // Fallback: create element manually
          weatherCardElement = this.createWeatherCardElement(cardConfig, hass);
        }
      } catch (error) {
        console.warn('Failed to use loadCardHelpers, falling back to manual creation:', error);
        weatherCardElement = this.createWeatherCardElement(cardConfig, hass);
      }
    } else {
      // Fallback: create element manually
      weatherCardElement = this.createWeatherCardElement(cardConfig, hass);
    }

    weatherContainer.appendChild(weatherCardElement);
    container.appendChild(weatherContainer);
  }

  private createWeatherCardElement(cardConfig: any, hass: any): HTMLElement {
    // Add CSS to make weather card transparent using card-mod-like approach
    // We'll inject styles directly since we can't use card-mod dynamically
    this.addWeatherCardStyles();

    // Create ha-card wrapper with transparent background
    const weatherCard = document.createElement('ha-card');
    weatherCard.style.cssText = 'background: transparent !important; box-shadow: none !important; overflow: visible !important; border: none !important;';
    
    // Try to set card-mod attribute for transparency (if card-mod is installed)
    weatherCard.setAttribute('style-mod-card', 'background: transparent; box-shadow: none; border: none;');
    
    // Create weather-forecast element
    const weatherForecast = document.createElement('hui-weather-forecast-card') as any;
    
    // Set config and hass
    if (weatherForecast.setConfig) {
      weatherForecast.setConfig(cardConfig);
    }
    if (weatherForecast.hass !== undefined) {
      weatherForecast.hass = hass;
    }
    
    // Wait for card to be rendered and then try to modify shadow DOM
    setTimeout(() => {
      this.makeWeatherCardTransparent(weatherCard, weatherForecast);
    }, 100);

    weatherCard.appendChild(weatherForecast);
    return weatherCard;
  }

  private makeWeatherCardTransparent(weatherCard: HTMLElement, weatherForecast: any): void {
    try {
      // Try to access shadow DOM of weather-forecast-card
      if (weatherForecast.shadowRoot) {
        const cardInShadow = weatherForecast.shadowRoot.querySelector('ha-card');
        if (cardInShadow) {
          (cardInShadow as HTMLElement).style.cssText = 'background: transparent !important; box-shadow: none !important; border: none !important;';
        }
      }
      
      // Also try to modify the outer ha-card
      weatherCard.style.cssText = 'background: transparent !important; box-shadow: none !important; overflow: visible !important; border: none !important;';
    } catch (error) {
      // Silently fail if we can't access shadow DOM
      console.debug('Could not modify weather card shadow DOM:', error);
    }
  }

  private addWeatherCardStyles(): void {
    // Check if styles already added
    if (document.querySelector('#apple-weather-card-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'apple-weather-card-styles';
    style.textContent = `
      .weather-section-container ha-card {
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        overflow: visible !important;
      }
      
      .weather-section-container hui-weather-forecast-card {
        background: transparent !important;
      }
      
      /* Try to access shadow DOM content */
      .weather-section-container hui-weather-forecast-card::part(card) {
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }
      
      /* Use a more aggressive approach - wait for card to be rendered and then modify */
      .weather-section-container ha-card:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: -1;
      }
      
      /* Apply card-mod style via attribute if possible */
      .weather-section-container ha-card[style-mod-card] {
        background: transparent !important;
      }
    `;
    
    document.head.appendChild(style);
  }
}

