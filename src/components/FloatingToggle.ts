/**
 * Floating Toggle Component
 * Mimics the floating bottom navigation toggle with liquid glass effect
 */

import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export interface FloatingToggleConfig {
  onHomeClick: () => void;
  onAutomationClick: () => void;
  currentMode: 'home' | 'automation';
  containerElement?: HTMLElement; // Optional container to position relative to
}

export class FloatingToggle extends HTMLElement {
  private config?: FloatingToggleConfig;
  private sidebarListener?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config: FloatingToggleConfig) {
    this.config = config;
    this.updatePositioning();
    this.render();
    this.setupSidebarListener();
  }

  private setupSidebarListener() {
    // Clean up existing listener if any
    if (this.sidebarListener) {
      document.removeEventListener('hass-dock-sidebar', this.sidebarListener);
    }

    // Create and store the listener
    this.sidebarListener = () => {
      // Small delay to allow layout to settle
      setTimeout(() => {
        this.recalculatePosition();
      }, 100);
    };

    // Listen for sidebar visibility changes
    document.addEventListener('hass-dock-sidebar', this.sidebarListener);
  }

  private updatePositioning() {
    if (!this.config?.containerElement) return;

    // Calculate the center of the container element
    const container = this.config.containerElement;
    const rect = container.getBoundingClientRect();
    
    // Find the center of the container relative to viewport
    const containerCenter = rect.left + rect.width / 2;
    const viewportCenter = window.innerWidth / 2;
    
    // Calculate the offset needed to center within the container
    const offset = containerCenter - viewportCenter;
    
    // Apply the offset as a CSS custom property
    this.style.setProperty('--sidebar-offset', `${offset}px`);
    this.classList.add('contained');
  }

  private render() {
    if (!this.config || !this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          pointer-events: none;
        }

        /* When container is provided, position relative to viewport but account for sidebar */
        :host(.contained) {
          left: calc(50% + var(--sidebar-offset, 0px));
        }

        .floating-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgb(0 0 0 / 20%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(25px) saturate(200%);
          border-radius: 50px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 4px;
          min-width: 180px;
          height: 50px;
          position: relative;
          overflow: hidden;
          pointer-events: all;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2),
                  0 4px 16px rgba(0, 0, 0, 0.12),
                  0 1px 4px rgba(0, 0, 0, 0.08),
                  inset 0 1px 0 rgba(255, 255, 255, 0.3),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          background-image: linear-gradient(
                    135deg,
                    rgba(255, 255, 255, 0.25) 0%,
                    rgba(255, 255, 255, 0.08) 30%,
                    rgba(255, 255, 255, 0.02) 60%,
                    rgba(255, 255, 255, 0.15) 100%
                  ),
                  linear-gradient(
                    45deg,
                    rgba(255, 255, 255, 0.1) 0%,
                    transparent 50%,
                    rgba(255, 255, 255, 0.05) 100%
                  );
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .toggle-background {
          position: absolute;
          top: 5px;
          left: 5px;
          right: 5px;
          bottom: 5px;
          border-radius: 50px;
          background: rgb(255 255 255 / 20%);
          transition: all 0.4s cubic-bezier(0.34, 1.26, 0.64, 1);
          transform: ${this.getToggleBackgroundTransform()};
          width: calc(50% - 2.5px);
        }

        .toggle-buttons {
          display: flex;
          width: 100%;
          height: 100%;
          position: relative;
        }

        .toggle-button {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.4s cubic-bezier(0.34, 1.26, 0.64, 1);
          position: relative;
          z-index: 2;
          height: 100%;
          border-radius: 50px;
          letter-spacing: -0.1px;
          min-width: 0;
          padding: 0 28px;
        }

        .toggle-button.active {
          color: #ffb30ccc;
        }

        .toggle-icon {
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          font-family: 'Material Design Icons';
        }

        /* Enhanced ripple effect */
        .toggle-button::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transform: translate(-50%, -50%);
          transition: width 0.4s cubic-bezier(0.34, 1.26, 0.64, 1), height 0.4s cubic-bezier(0.34, 1.26, 0.64, 1);
          pointer-events: none;
        }

        .toggle-button:active::after {
          width: 80px;
          height: 80px;
        }
          
        /* Animation for mode switching */
        @keyframes slideToggle {
          0% { transform: scale(0.98); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        .toggle-background.switching {
          animation: slideToggle 0.4s cubic-bezier(0.34, 1.26, 0.64, 1);
        }

        /* Responsive design for smaller screens */
        @media (max-width: 480px) {
          .floating-toggle {
            min-width: 120px;
            height: 50px;
            padding: 4px;
          }
          
          .toggle-button {
            font-size: 10px;
          }
          
          .toggle-icon {
            font-size: 14px;
          }
        }
      </style>

      <div class="floating-toggle">
        <div class="toggle-background"></div>
        <div class="toggle-buttons">
          <button class="toggle-button ${this.config.currentMode === 'home' ? 'active' : ''}" id="home-button">
            <ha-icon class="toggle-icon" icon="mdi:home"></ha-icon>
            <span>${localize('floating_toggle.home')}</span>
          </button>
          <button class="toggle-button ${this.config.currentMode === 'automation' ? 'active' : ''}" id="automation-button">
            <ha-icon class="toggle-icon" icon="mdi:clock-check"></ha-icon>
            <span>${localize('floating_toggle.automation')}</span>
          </button>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;
    
    const homeButton = this.shadowRoot.querySelector('#home-button');
    const automationButton = this.shadowRoot.querySelector('#automation-button');
    const toggleBackground = this.shadowRoot.querySelector('.toggle-background');

    homeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.config?.currentMode !== 'home') {
        this.animateToggle();
        this.config?.onHomeClick();
      }
    });

    automationButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.config?.currentMode !== 'automation') {
        this.animateToggle();
        this.config?.onAutomationClick();
      }
    });
  }

  private animateToggle() {
    if (!this.shadowRoot) return;
    
    const toggleBackground = this.shadowRoot.querySelector('.toggle-background');
    toggleBackground?.classList.add('switching');
    setTimeout(() => {
      toggleBackground?.classList.remove('switching');
    }, 300);
  }

  private getToggleBackgroundTransform(): string {
    const isRTL = RTLHelper.isRTL();
    const isHomeMode = this.config?.currentMode === 'home';
    
    if (isRTL) {
      // In RTL: home mode = right side, automation mode = left side
      return isHomeMode ? 'translateX(0)' : 'translateX(calc(5px - 100%))';
    } else {
      // In LTR: home mode = left side, automation mode = right side
      return isHomeMode ? 'translateX(0)' : 'translateX(calc(100% - 5px))';
    }
  }

  updateMode(mode: 'home' | 'automation') {
    if (this.config) {
      this.config.currentMode = mode;
      this.render();
    }
  }

  // Method to recalculate positioning when layout changes
  recalculatePosition() {
    this.updatePositioning();
  }

  // Cleanup method
  cleanup() {
    if (this.sidebarListener) {
      document.removeEventListener('hass-dock-sidebar', this.sidebarListener);
      this.sidebarListener = undefined;
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }
}

// Register the custom element
if (!customElements.get('floating-toggle')) {
  customElements.define('floating-toggle', FloatingToggle);
}
