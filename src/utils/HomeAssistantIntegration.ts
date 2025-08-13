/**
 * Home Assistant Integration Utilities
 * Helper functions to better integrate with Home Assistant's automation system
 */

export class HomeAssistantIntegration {
  
  /**
   * Check if Home Assistant supports embedded automation pages
   */
  static async checkAutomationSupport(hass: any): Promise<boolean> {
    try {
      // Check if the automation integration is loaded
      if (hass?.config?.components?.includes?.('automation')) {
        return true;
      }
      
      // Fallback check: try to get automation entities
      const entities = Object.keys(hass?.states || {});
      return entities.some(entityId => entityId.startsWith('automation.'));
    } catch (error) {
      console.warn('Could not check automation support:', error);
      return false;
    }
  }

  /**
   * Get automation entities for display
   */
  static getAutomationEntities(hass: any): any[] {
    if (!hass?.states) return [];
    
    return Object.keys(hass.states)
      .filter(entityId => entityId.startsWith('automation.'))
      .map(entityId => hass.states[entityId])
      .sort((a, b) => (a.attributes?.friendly_name || a.entity_id).localeCompare(
        b.attributes?.friendly_name || b.entity_id
      ));
  }

  /**
   * Execute an automation
   */
  static async triggerAutomation(hass: any, automationId: string): Promise<void> {
    try {
      await hass.callService('automation', 'trigger', {
        entity_id: automationId
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
      throw error;
    }
  }

  /**
   * Toggle an automation on/off
   */
  static async toggleAutomation(hass: any, automationId: string): Promise<void> {
    try {
      await hass.callService('automation', 'toggle', {
        entity_id: automationId
      });
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      throw error;
    }
  }

  /**
   * Get Home Assistant frontend URL with proper parameters for embedding
   */
  static getEmbeddedUrl(baseUrl: string, path: string): string {
    const url = new URL(path, baseUrl);
    
    // Add parameters to hide UI elements for embedded view
    url.searchParams.set('hide_sidebar', 'true');
    url.searchParams.set('hide_header', 'true');
    url.searchParams.set('embedded', 'true');
    
    return url.toString();
  }

  /**
   * Check if URL is accessible (for iframe fallback)
   */
  static async checkUrlAccessibility(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors' 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create postMessage listener for iframe communication
   */
  static createIframeMessageListener(callback: (data: any) => void): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
      // Only listen to messages from our iframe
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'HA_AUTOMATION_EVENT') {
        callback(event.data);
      }
    };
  }
}
