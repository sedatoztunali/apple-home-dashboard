/**
 * Automation Page Component
 * Displays Home Assistant automation page within the dashboard using iframe with simple visibility toggle
 */

import { localize } from '../utils/LocalizationService';

export class AutomationPage extends HTMLElement {
  private _hass?: any;
  private iframe?: HTMLIFrameElement;
  private container?: HTMLElement;
  public isInitialized: boolean = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass: any) {
    this._hass = hass;
  }

  get hass() {
    return this._hass;
  }

    // Initialize the automation iframe once and keep it hidden
  async initialize(parentContainer: HTMLElement) {
    if (this.isInitialized || !this._hass) return;

    // Create the container and append to parent container for proper positioning
    this.container = document.createElement('div');
    this.container.className = 'automation-container';

    // Create the iframe
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'automation-iframe';
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      border-radius: 0;
      position: relative;
      z-index: 1;
    `;
    // Use more restrictive sandbox initially, will be relaxed after load if needed
    // This helps prevent race conditions during initial load
    this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation');
    
    // Add security headers and prevent unwanted navigation
    this.iframe.setAttribute('allow', 'autoplay; encrypted-media');
    this.iframe.setAttribute('referrerpolicy', 'same-origin');

    // Create loading indicator
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      z-index: 2;
    `;
    loadingContainer.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top: 3px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <div style="font-size: 16px; font-weight: 500;">${localize('status_messages.loading_automations')}</div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    this.container.appendChild(loadingContainer);
    this.container.appendChild(this.iframe);
    
    // Create style element for the container and add it to parent
    const containerStyle = document.createElement('style');
    containerStyle.textContent = `
      .automation-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 100vh;
        background: transparent;
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
        transition: visibility 0ms, opacity 300ms ease-in-out;
        z-index: 5;
      }
      
      @media (max-width: 768px) {
        .automation-container {
          height: calc(100vh - 80px);
          padding-bottom: 80px;
          background: #000;
        }
      }
    `;
    parentContainer.appendChild(containerStyle);
    parentContainer.appendChild(this.container);

    // Load the automation page
    const hassUrl = this.getHomeAssistantUrl();
    const automationUrl = `${hassUrl}/config/automation`;

    this.iframe.onload = () => {
      loadingContainer.style.display = 'none';
      this.isInitialized = true;
      
      // Ensure iframe is still showing the correct URL (prevent race condition navigation)
      try {
        const iframeUrl = this.iframe?.contentWindow?.location?.href;
        if (iframeUrl && !iframeUrl.includes('/config/automation') && this.iframe) {
          this.iframe.src = automationUrl;
          return;
        }
      } catch (e) {
        // Expected for cross-origin, which is fine
      }
      
      // Inject script to hide sidebar within iframe
      this.injectUIHidingScript();
    };

    this.iframe.onerror = (error) => {
      console.error('🏠 APPLE HOME: Automation iframe error:', error);
      loadingContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Unable to load automations</div>
        <div style="font-size: 14px; opacity: 0.7;">Please check your Home Assistant configuration</div>
      `;
    };

    this.iframe.src = automationUrl;
  }

  // Show the automation page
  show() {
    if (!this.container) return;
    
    // Calculate the position to cover the visible viewport area
    const parentRect = this.container.parentElement?.getBoundingClientRect();
    if (parentRect) {
      // Adjust top position to account for scrolling
      this.container.style.top = `${-parentRect.top}px`;
    }
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    this.container.style.visibility = 'visible';
    this.container.style.opacity = '1';
  }

  // Hide the automation page
  hide() {
    if (!this.container) return;
    
    // Restore background scrolling
    document.body.style.overflow = '';
    
    this.container.style.visibility = 'hidden';
    this.container.style.opacity = '0';
    
    // Reset top position
    this.container.style.top = '0';
  }

  // Inject script to hide sidebar, header, and mobile tabbar within the iframe
  private injectUIHidingScript() {
    if (!this.iframe) return;
    
    try {
      // Try to access iframe content (will fail for cross-origin)
      const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
      
      if (iframeDoc) {
        // Same-origin: Direct script injection
        this.injectUIHidingDirectly(iframeDoc);
      } else {
        // Cross-origin: Use postMessage
        this.injectUIHidingViaPostMessage();
      }
    } catch (error) {
      // Expected for cross-origin - use postMessage fallback
      this.injectUIHidingViaPostMessage();
    }
  }

  private injectUIHidingDirectly(doc: Document) {
    try {
      // Create and inject script that will hide the sidebar, header, and mobile tabbar
      const script = doc.createElement('script');
      script.textContent = `
        (function() {
          function deepQuery(root, sel) {
            const stack = [root];
            while (stack.length) {
              const n = stack.pop();
              if (!n) continue;
              const found = n.querySelector?.(sel);
              if (found) return found;
              n.children && stack.push(...n.children);
              n.shadowRoot && stack.push(n.shadowRoot);
            }
            return null;
          }
          
          function hideUIElements() {            
            try {
              const ha = document.querySelector("home-assistant");
              
              const main = ha?.shadowRoot?.querySelector("home-assistant-main");

              
              if (main) {
                // Hide sidebar using the same event as HomeAssistantUIManager
                main.dispatchEvent(new CustomEvent("hass-dock-sidebar", {
                  detail: { dock: "always_hidden" },
                  bubbles: true,
                  composed: true,
                }));
              }
              
              // Setup back button override
              setupBackButtonOverride();
              
            } catch (error) {
             console.error('Automation iframe: Error hiding UI elements', error);
            }
          }
          
          // Track retry attempts to prevent infinite loops
          let hideUIAttempts = 0;
          const maxHideUIAttempts = 3;
          
          function hideUIElementsWithRetry() {
            hideUIAttempts++;
            hideUIElements();
            
            // Only retry if we haven't reached max attempts and elements aren't ready
            if (hideUIAttempts < maxHideUIAttempts) {
              setTimeout(hideUIElementsWithRetry, 2000);
            } else {
            }
          }
          
          // Back button override functionality
          function setupBackButtonOverride() {
            
            // Helper to check if we're on a main config picker page (not editing a specific item)
            const isOnMainConfigPage = () => {
              const currentUrl = window.location.href;
              
              // Check if we're editing a specific item (automation, scene, script, or blueprint)
              const isEditingSpecificItem = currentUrl.includes('/edit/') || 
                                          currentUrl.includes('/new') ||
                                          currentUrl.includes('/trace/') ||
                                          currentUrl.includes('/show/') ||
                                          currentUrl.includes('/duplicate/');
              
              // If we're explicitly in edit/new/trace/show mode, we're NOT on main page
              if (isEditingSpecificItem) {
                return false;
              }
              
              // Check for main config picker elements (visible ones indicate we're on main page)
              const pickerElements = [
                'ha-automation-picker',
                'ha-scene-dashboard', 
                'ha-script-picker',
                'ha-blueprint-overview'
              ];
              
              for (const pickerTag of pickerElements) {
                const picker = document.querySelector(pickerTag);
                if (picker) {
                  const style = window.getComputedStyle(picker);
                  const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                  if (isVisible) {
                    return true;
                  }
                }
              }
              
              // Check for editor elements (if these exist, we're NOT on main page)
              const editorElements = [
                'ha-automation-editor',
                'ha-scene-editor',
                'ha-script-editor',
                'ha-blueprint-editor',
                '[data-panel*="edit"]'
              ];
              
              const foundEditor = editorElements.some(selector => document.querySelector(selector));
              if (foundEditor) {
                return false;
              }
              
              // Default to main page if we can't determine otherwise
              return true;
            };
            
            // Helper to attach click interceptor to a back arrow button
            const patchBackButton = (button) => {
              if (!button || button.__backOverrideApplied) {
                return;
              }
              
              const listener = (ev) => {
                // Only override if we're on the main config page
                if (!isOnMainConfigPage()) {
                  // Let the normal back navigation work for specific item pages
                  return;
                }
                
                ev.preventDefault();
                ev.stopImmediatePropagation();
                
                try {
                  // Send message to parent to switch back to home mode
                  parent.postMessage({ type: 'switchToHome' }, '*');
                } catch (err) {
                  console.error('Automation iframe: Error sending message to parent', err);
                }
              };
              
              button.addEventListener('click', listener);
              button.__backOverrideApplied = true;
            };
            
            // Search for all possible back button selectors
            const backButtonSelectors = [
              'ha-icon-button-arrow-prev',
              '[aria-label*="Back"]',
              '[aria-label*="back"]', 
              '[title*="Back"]',
              '[title*="back"]',
              'mwc-icon-button[icon="arrow_back"]',
              'ha-icon-button[icon="hass:arrow-left"]',
              'ha-icon-button[icon="mdi:arrow-left"]',
              'ha-icon-button[icon="mdi:chevron-left"]',
              '.back-button',
              '[data-action="back"]',
              // Add more generic selectors
              'ha-icon-button[icon*="arrow"]',
              'mwc-icon-button[icon*="arrow"]',
              'button[aria-label*="arrow"]',
              '[icon="mdi:arrow-left-thick"]'
            ];
            
            // Function to patch ALL back buttons (we'll check isOnMainConfigPage in the listener)
            const patchAllBackButtons = () => {
              let patchedCount = 0;
              
              // Search in main document
              backButtonSelectors.forEach(selector => {
                const foundButtons = document.querySelectorAll(selector);
                foundButtons.forEach((btn) => {
                  if (!btn.__backOverrideApplied) {
                    patchBackButton(btn);
                    patchedCount++;
                  }
                });
              });
              
              // Also search in shadow DOMs using deepQuery
              backButtonSelectors.forEach(selector => {
                const shadowButton = deepQuery(document, selector);
                if (shadowButton && !shadowButton.__backOverrideApplied) {
                  patchBackButton(shadowButton);
                  patchedCount++;
                }
              });
              
              // Specifically check all config picker shadow DOMs
              const pickerSelectors = ['ha-automation-picker', 'ha-scene-dashboard', 'ha-script-picker', 'ha-blueprint-overview'];
              pickerSelectors.forEach(pickerTag => {
                const picker = document.querySelector(pickerTag);
                if (picker?.shadowRoot) {
                  backButtonSelectors.forEach(selector => {
                    const pickerButtons = picker.shadowRoot.querySelectorAll(selector);
                    pickerButtons.forEach((btn) => {
                      if (!btn.__backOverrideApplied) {
                        patchBackButton(btn);
                        patchedCount++;
                      }
                    });
                  });
                }
              });
              
              return patchedCount;
            };
            
            // Patch all back buttons initially
            patchAllBackButtons();
            
            // Observe the DOM for added/removed back buttons
            const observer = new MutationObserver((mutations) => {
              for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the added node itself is a back button
                    backButtonSelectors.forEach(selector => {
                      if (node.matches && node.matches(selector)) {
                        patchBackButton(node);
                      }
                      
                      // Search within the subtree for nested buttons
                      if (node.querySelectorAll) {
                        node.querySelectorAll(selector).forEach((btn) => {
                          if (!btn.__backOverrideApplied) {
                            patchBackButton(btn);
                          }
                        });
                      }
                      
                      // If this is any config picker element, check its shadow DOM too
                      const pickerTags = ['HA-AUTOMATION-PICKER', 'HA-SCENE-DASHBOARD', 'HA-SCRIPT-PICKER', 'HA-BLUEPRINT-OVERVIEW'];
                      if (pickerTags.includes(node.tagName) && node.shadowRoot) {
                        node.shadowRoot.querySelectorAll(selector).forEach((btn) => {
                          if (!btn.__backOverrideApplied) {
                            patchBackButton(btn);
                          }
                        });
                      }
                    });
                  }
                }
              }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            // IMPORTANT: Watch for URL changes to catch tab switches (Home Assistant config tabs use URL changes)
            let lastUrl = window.location.href;
            const checkForUrlChanges = () => {
              if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                // Re-patch buttons after URL change (tab switch)
                setTimeout(() => {
                  patchAllBackButtons();
                }, 300);
              }
            };
            
            // Check for URL changes every 500ms to catch tab switches
            setInterval(checkForUrlChanges, 500);
            
            // Also try to find back buttons after delays - automation picker might load later
            const delayedPatch = (delay, attempt) => {
              setTimeout(() => {
                patchAllBackButtons();
              }, delay);
            };
            
            // Multiple delayed attempts with increasing delays
            delayedPatch(1000, 1);  // 1 second
            delayedPatch(3000, 2);  // 3 seconds  
            delayedPatch(5000, 3);  // 5 seconds
          }
          
          // Try immediately and also after DOM is ready
          hideUIElementsWithRetry();
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hideUIElementsWithRetry);
          }
          
          // Also try after a longer delay for dynamic content
          setTimeout(hideUIElementsWithRetry, 1500);
        })();
      `;
      
      // Append to head or body
      (doc.head || doc.documentElement).appendChild(script);
      
    } catch (error) {
    }
  }

  private injectUIHidingViaPostMessage() {
    if (!this.iframe?.contentWindow) return;
    
    try {
      // Send message to iframe with UI hiding script
      this.iframe.contentWindow.postMessage({
        type: 'HIDE_UI_SCRIPT',
        script: `
          (function() {
            function deepQuery(root, sel) {
              const stack = [root];
              while (stack.length) {
                const n = stack.pop();
                if (!n) continue;
                const found = n.querySelector?.(sel);
                if (found) return found;
                n.children && stack.push(...n.children);
                n.shadowRoot && stack.push(n.shadowRoot);
              }
              return null;
            }
            
            function hideUIElements() {
              
              try {
                const ha = document.querySelector("home-assistant");
                
                const main = ha?.shadowRoot?.querySelector("home-assistant-main");
                
                if (main) {
                  // Hide sidebar
                  main.dispatchEvent(new CustomEvent("hass-dock-sidebar", {
                    detail: { dock: "always_hidden" },
                    bubbles: true,
                    composed: true,
                  }));
                }
                
                // Setup back button override
                setupBackButtonOverride();
                
                // Retry if elements not ready
                if (!main || !huiRoot) {
                  setTimeout(hideUIElements, 1000);
                }
                
              } catch (error) {
              }
            }
            
            // Track retry attempts for postMessage version too
            let hideUIAttemptsPostMessage = 0;
            const maxHideUIAttemptsPostMessage = 3;
            
            function hideUIElementsWithRetryPostMessage() {
              hideUIAttemptsPostMessage++;
              hideUIElements();
              
              if (hideUIAttemptsPostMessage < maxHideUIAttemptsPostMessage) {
                setTimeout(hideUIElementsWithRetryPostMessage, 2000);
              } else {
              }
            }
            
            // Back button override functionality (same as direct injection)
            function setupBackButtonOverride() {
              
              // Helper to check if we're on the main automation picker page (not a specific automation)
              const isOnMainAutomationPage = () => {
                // Method 1: Check URL pattern
                const currentUrl = window.location.href;
                const isEditingAutomation = currentUrl.includes('/config/automation/edit/') || 
                                          currentUrl.includes('/config/automation/new') ||
                                          currentUrl.includes('/config/automation/trace/');
                
                // If we're explicitly in edit/new/trace mode, we're NOT on main page
                if (isEditingAutomation) {
                  return false;
                }
                
                // Method 2: Check for automation picker element
                const automationPicker = document.querySelector('ha-automation-picker');
                if (automationPicker) {
                  const style = window.getComputedStyle(automationPicker);
                  const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                  return isVisible;
                }
                
                // Method 3: Check for automation editor elements (if these exist, we're NOT on main page)
                const automationEditor = document.querySelector('ha-automation-editor') || 
                                       document.querySelector('ha-config-automation') ||
                                       document.querySelector('[data-panel="automation-edit"]');
                if (automationEditor) {
                  return false;
                }
                
                // Method 4: Default to main page if we can't determine otherwise
                return true;
              };
              
              const patchBackButton = (button) => {
                if (!button || button.__backOverrideApplied) {
                  return;
                }
                
                const listener = (ev) => {
                  // Only override if we're on the main automation page
                  if (!isOnMainAutomationPage()) {
                    // Let the normal back navigation work for specific automation pages
                    return;
                  }
                  
                  ev.preventDefault();
                  ev.stopImmediatePropagation();
                  
                  try {
                    parent.postMessage({ type: 'switchToHome' }, '*');
                  } catch (err) {
                    console.error('Automation iframe: Error sending message to parent (postMessage)', err);
                  }
                };
                
                button.addEventListener('click', listener);
                button.__backOverrideApplied = true;
              };
              
              function deepQuery(root, sel) {
                const stack = [root];
                while (stack.length) {
                  const n = stack.pop();
                  if (!n) continue;
                  const found = n.querySelector?.(sel);
                  if (found) return found;
                  n.children && stack.push(...n.children);
                  n.shadowRoot && stack.push(n.shadowRoot);
                }
                return null;
              }
              
              const backButtonSelectors = [
                'ha-icon-button-arrow-prev',
                '[aria-label*="Back"]',
                '[aria-label*="back"]', 
                '[title*="Back"]',
                '[title*="back"]',
                'mwc-icon-button[icon="arrow_back"]',
                'ha-icon-button[icon="hass:arrow-left"]',
                'ha-icon-button[icon="mdi:arrow-left"]',
                'ha-icon-button[icon="mdi:chevron-left"]',
                '.back-button',
                '[data-action="back"]',
                // Add more generic selectors
                'ha-icon-button[icon*="arrow"]',
                'mwc-icon-button[icon*="arrow"]',
                'button[aria-label*="arrow"]',
                '[icon="mdi:arrow-left-thick"]'
              ];
              
              // Function to patch ALL back buttons (we'll check isOnMainAutomationPage in the listener)
              const patchAllBackButtons = () => {
                let patchedCount = 0;
                
                // Search in main document
                backButtonSelectors.forEach(selector => {
                  const foundButtons = document.querySelectorAll(selector);
                  foundButtons.forEach((btn) => {
                    if (!btn.__backOverrideApplied) {
                      patchBackButton(btn);
                      patchedCount++;
                    }
                  });
                });
                
                // Also search in shadow DOMs using deepQuery
                backButtonSelectors.forEach(selector => {
                  const shadowButton = deepQuery(document, selector);
                  if (shadowButton && !shadowButton.__backOverrideApplied) {
                    patchBackButton(shadowButton);
                    patchedCount++;
                  }
                });
                
                // Specifically check ha-automation-picker shadow DOM
                const automationPicker = document.querySelector('ha-automation-picker');
                if (automationPicker?.shadowRoot) {
                  backButtonSelectors.forEach(selector => {
                    const pickerButtons = automationPicker.shadowRoot.querySelectorAll(selector);
                    pickerButtons.forEach((btn) => {
                      if (!btn.__backOverrideApplied) {
                        patchBackButton(btn);
                        patchedCount++;
                      }
                    });
                  });
                }
                
                return patchedCount;
              };
              
              // Patch all back buttons initially
              patchAllBackButtons();
              
              const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                      backButtonSelectors.forEach(selector => {
                        if (node.matches && node.matches(selector)) {
                          patchBackButton(node);
                        }
                        
                        if (node.querySelectorAll) {
                          node.querySelectorAll(selector).forEach((btn) => {
                            if (!btn.__backOverrideApplied) {
                              patchBackButton(btn);
                            }
                          });
                        }
                        
                        // If this is ha-automation-picker, check its shadow DOM too
                        if (node.tagName === 'HA-AUTOMATION-PICKER' && node.shadowRoot) {
                          node.shadowRoot.querySelectorAll(selector).forEach((btn) => {
                            if (!btn.__backOverrideApplied) {
                              patchBackButton(btn);
                            }
                          });
                        }
                      });
                    }
                  }
                }
              });
              
              observer.observe(document.body, { childList: true, subtree: true });
              
              const delayedPatch = (delay) => {
                setTimeout(() => {
                  patchAllBackButtons();
                }, delay);
              };
              
              delayedPatch(1000);  // 1 second
              delayedPatch(3000);  // 3 seconds  
              delayedPatch(5000);  // 5 seconds
            }
            
            hideUIElementsWithRetryPostMessage();
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', hideUIElementsWithRetryPostMessage);
            }
            
            // Also try after a longer delay for dynamic content  
            setTimeout(hideUIElementsWithRetryPostMessage, 1500);
          })();
        `
      }, '*');
      
    } catch (error) {
    }
  }

  private getHomeAssistantUrl(): string {
    // Try to get the Home Assistant URL from various sources
    if (this._hass?.connection?.options?.hassUrl) {
      return this._hass.connection.options.hassUrl;
    }
    
    if (this._hass?.auth?.data?.hassUrl) {
      return this._hass.auth.data.hassUrl;
    }

    // Fallback to current origin
    return window.location.origin;
  }

  cleanup() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = undefined;
    this.iframe = undefined;
    this.isInitialized = false;
  }
}

// Register the custom element
if (!customElements.get('automation-page')) {
  customElements.define('automation-page', AutomationPage);
}
