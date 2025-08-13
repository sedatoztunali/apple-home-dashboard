/**
 * RTL Helper Utility
 * 
 * Provides utilities for detecting and handling right-to-left languages
 * in the Apple Home Dashboard.
 */

// List of RTL language codes
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ku', 'dv'];

/**
 * Detect if the current language is RTL based on Home Assistant locale
 * or browser language
 */
export class RTLHelper {
  private static _isRTL: boolean | null = null;
  private static _currentLanguage: string | null = null;

  /**
   * Initialize RTL detection from Home Assistant
   */
  static initialize(hass?: any): void {
    let lang = 'en';
    let isRTL = false;

    // Try to get RTL info from Home Assistant translation metadata
    if (hass?.localize?.translationMetadata?.translations) {
      const currentLang = hass.locale?.language || hass.language || 'en';
      const translationData = hass.localize.translationMetadata.translations[currentLang];
      
      if (translationData?.isRTL !== undefined) {
        isRTL = translationData.isRTL;
        lang = currentLang;
      }
    }
    
    // Fallback to manual detection if HA doesn't provide RTL info
    if (!isRTL && hass) {
      lang = hass.locale?.language || hass.language || navigator.language.split('-')[0] || 'en';
      isRTL = RTL_LANGUAGES.includes(lang);
    }

    // Fallback to browser language
    if (!hass) {
      lang = navigator.language.split('-')[0] || 'en';
      isRTL = RTL_LANGUAGES.includes(lang);
    }

    this._isRTL = isRTL;
    this._currentLanguage = lang;

    // Set document direction if RTL
    this.updateDocumentDirection();
  }

  /**
   * Check if current language is RTL
   */
  static isRTL(): boolean {
    if (this._isRTL === null) {
      this.initialize();
    }
    return this._isRTL || false;
  }

  /**
   * Get current language code
   */
  static getCurrentLanguage(): string {
    if (this._currentLanguage === null) {
      this.initialize();
    }
    return this._currentLanguage || 'en';
  }

  /**
   * Update document direction attribute
   */
  static updateDocumentDirection(): void {
    const isRTL = this.isRTL();
    
    // Set on document element
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    
    // Also set on body for extra compatibility
    document.body.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    
    // Add class to document for CSS targeting
    document.documentElement.classList.toggle('rtl', isRTL);
    document.documentElement.classList.toggle('ltr', !isRTL);
  }

  /**
   * Get appropriate icon for back/forward navigation based on RTL
   */
  static getBackIcon(): string {
    return this.isRTL() ? 'mdi:chevron-right' : 'mdi:chevron-left';
  }

  /**
   * Get appropriate icon for forward/next navigation based on RTL
   */
  static getForwardIcon(): string {
    return this.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right';
  }

  /**
   * Get appropriate positioning for dropdowns and popovers
   */
  static getDropdownAlignment(): 'left' | 'right' {
    return this.isRTL() ? 'left' : 'right';
  }

  /**
   * Get logical CSS property names based on RTL direction
   */
  static getLogicalProperty(property: string): string {
    if (!this.isRTL()) {
      return property;
    }

    // Map physical properties to logical ones for RTL
    const rtlPropertyMap: Record<string, string> = {
      'left': 'right',
      'right': 'left',
      'margin-left': 'margin-right',
      'margin-right': 'margin-left',
      'padding-left': 'padding-right',
      'padding-right': 'padding-left',
      'border-left': 'border-right',
      'border-right': 'border-left',
      'text-align: left': 'text-align: right',
      'text-align: right': 'text-align: left',
      'float: left': 'float: right',
      'float: right': 'float: left'
    };

    return rtlPropertyMap[property] || property;
  }

  /**
   * Apply RTL-aware inline styles to an element
   */
  static applyRTLStyles(element: HTMLElement, styles: Record<string, string>): void {
    Object.entries(styles).forEach(([property, value]) => {
      const logicalProperty = this.getLogicalProperty(property);
      (element.style as any)[logicalProperty] = value;
    });
  }

  /**
   * Get direction-aware transform for positioning
   */
  static getDirectionalTransform(x: number, y: number = 0): string {
    const adjustedX = this.isRTL() ? -x : x;
    return `translate(${adjustedX}px, ${y}px)`;
  }
}
