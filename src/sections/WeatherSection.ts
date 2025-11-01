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
    // Create ha-card wrapper
    const weatherCard = document.createElement('ha-card');
    weatherCard.style.cssText = 'background: transparent; box-shadow: none; overflow: hidden;';

    // Create weather-forecast element
    const weatherForecast = document.createElement('hui-weather-forecast-card') as any;
    
    // Set config and hass
    if (weatherForecast.setConfig) {
      weatherForecast.setConfig(cardConfig);
    }
    if (weatherForecast.hass !== undefined) {
      weatherForecast.hass = hass;
    }

    weatherCard.appendChild(weatherForecast);
    return weatherCard;
  }
}

