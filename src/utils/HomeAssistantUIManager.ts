import { CustomizationManager } from './CustomizationManager';
import { DashboardStateManager } from './DashboardStateManager';
import { localize } from './LocalizationService';

export interface HomeAssistantUIState {
  headerVisible: boolean;
  sidebarVisible: boolean;
}

export class HomeAssistantUIManager {
  private static instance: HomeAssistantUIManager | null = null;
  private state: HomeAssistantUIState;
  private headerElement: HTMLElement | null = null;
  private huiRootElement: HTMLElement | null = null;
  private initialized = false;
  private customizationManager: CustomizationManager | null = null;
  private originalState: HomeAssistantUIState | null = null;
  private dashboardStateManager: DashboardStateManager | null = null;
  private listenerSetup = false;
  private lastSidebarState: boolean | null = null;

  private constructor() {
    // Initialize with default visible state - will be overridden by dashboard settings
    this.state = {
      headerVisible: true,
      sidebarVisible: true
    };
  }

  public static getInstance(): HomeAssistantUIManager {
    if (!HomeAssistantUIManager.instance) {
      HomeAssistantUIManager.instance = new HomeAssistantUIManager();
      // Initialize only once
      HomeAssistantUIManager.instance.initialize();
    }
    return HomeAssistantUIManager.instance;
  }

  public static initializeWithCustomizations(customizationManager: CustomizationManager): HomeAssistantUIManager {
    const instance = HomeAssistantUIManager.getInstance();
    instance.setCustomizationManager(customizationManager);
    return instance;
  }

  private setCustomizationManager(customizationManager: CustomizationManager): void {
    this.customizationManager = customizationManager;
    
    if (!this.listenerSetup) {
      this.setupDashboardStateListener();
      this.listenerSetup = true;
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.waitForHomeAssistant();
    this.applyUIState();
    this.initialized = true;
  }

  private async waitForHomeAssistant(): Promise<void> {
    await customElements.whenDefined("home-assistant");
    await customElements.whenDefined("home-assistant-main");
  }

  // Utility: breadth-first search through nested shadow-DOM
  private deepQuery(root: any, sel: string): HTMLElement | null {
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


  private collapseHeader(hide: boolean = true): void {
    const haRoot = document.querySelector("home-assistant");
    const huiRoot = this.deepQuery(haRoot, "hui-root");
    const headerEl = huiRoot?.shadowRoot?.querySelector(".header");

    if (!huiRoot || !headerEl) {
      return;
    }

    this.huiRootElement = huiRoot as HTMLElement;
    this.headerElement = headerEl as HTMLElement;

    try {
      if (hide) {
        this.headerElement.style.display = "none";
        this.huiRootElement.style.setProperty("--mdc-top-app-bar-height", "0px");
        this.huiRootElement.style.setProperty("--header-height", "0px");

        const viewElement = this.huiRootElement.shadowRoot?.querySelector("#view") as HTMLElement;
        if (viewElement) {
          viewElement.style.setProperty("padding-top", "0px");
        }
      } else {
        this.headerElement.style.display = "";
        this.huiRootElement.style.removeProperty("--mdc-top-app-bar-height");
        this.huiRootElement.style.removeProperty("--header-height");
        
        const viewElement = this.huiRootElement.shadowRoot?.querySelector("#view") as HTMLElement;
        if (viewElement) {
          viewElement.style.removeProperty("padding-top");
        }
      }

      this.huiRootElement.dispatchEvent(
        new Event("iron-resize", { bubbles: true, composed: true })
      );
    } catch (error) {
      console.warn('Error in collapseHeader:', error);
    }
  }

  private headerTransparentObserver: MutationObserver | null = null;

  private makeHeaderTransparent(): void {
    // Inject global CSS to make Home Assistant header transparent
    if (document.querySelector('#apple-ha-header-transparent-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'apple-ha-header-transparent-styles';
    style.textContent = `
      /* Make Home Assistant native header transparent by default - most aggressive selectors */
      app-header,
      .header,
      hui-root app-header,
      hui-root .header,
      hui-root .mdc-top-app-bar,
      app-header[main-title],
      app-header[mode],
      ha-app-layout app-header {
        background: transparent !important;
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        --app-header-background-color: transparent !important;
        --mdc-theme-primary: transparent !important;
      }
      
      /* Remove border from header bottom */
      hui-root .header::after,
      hui-root app-header::after,
      app-header::after,
      app-header::before {
        display: none !important;
      }
      
      /* Make sure all child elements are also transparent */
      hui-root .header *,
      hui-root app-header *,
      app-header *,
      app-header ha-menu-button *,
      app-header .toolbar * {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      /* Override any theme variables */
      :root {
        --app-header-background-color: transparent !important;
      }
    `;
    
    document.head.appendChild(style);
    
    // Aggressively modify header directly in shadow DOM
    const tryModifyHeader = (attempt: number = 0): void => {
      if (attempt > 20) return; // Max 20 attempts
      
      try {
        const haRoot = document.querySelector("home-assistant");
        if (!haRoot) {
          setTimeout(() => tryModifyHeader(attempt + 1), 100);
          return;
        }
        
        const huiRoot = this.deepQuery(haRoot, "hui-root");
        if (!huiRoot || !huiRoot.shadowRoot) {
          setTimeout(() => tryModifyHeader(attempt + 1), 100);
          return;
        }
        
        // Find header in shadow DOM
        const headerEl = huiRoot.shadowRoot.querySelector(".header") as HTMLElement;
        const appHeader = huiRoot.shadowRoot.querySelector("app-header") as HTMLElement;
        const mdcTopBar = huiRoot.shadowRoot.querySelector(".mdc-top-app-bar") as HTMLElement;
        
        // Modify all found header elements
        const elements = [headerEl, appHeader, mdcTopBar].filter(Boolean);
        
        if (elements.length > 0) {
          elements.forEach(el => {
            if (el) {
              el.style.cssText = 'background: transparent !important; border: none !important; box-shadow: none !important;';
              
              // Also modify all child elements with backgrounds
              const children = el.querySelectorAll('*');
              children.forEach((child: any) => {
                if (child && child.style) {
                  const computedStyle = window.getComputedStyle(child);
                  if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && computedStyle.backgroundColor !== 'transparent') {
                    child.style.setProperty('background-color', 'transparent', 'important');
                  }
                }
              });
            }
          });
          
          // Also check huiRoot's direct style
          if (huiRoot instanceof HTMLElement) {
            const huiRootStyle = window.getComputedStyle(huiRoot);
            // Only modify if it has a background
            if (huiRootStyle.backgroundColor && huiRootStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && huiRootStyle.backgroundColor !== 'transparent') {
              // Try to clear it via CSS variable or direct style
            }
          }
          
          // Setup MutationObserver to watch for header changes
          if (!this.headerTransparentObserver && huiRoot.shadowRoot) {
            this.headerTransparentObserver = new MutationObserver(() => {
              // Re-apply transparency when header changes
              setTimeout(() => tryModifyHeader(0), 50);
            });
            
            this.headerTransparentObserver.observe(huiRoot.shadowRoot, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
          }
        } else {
          // Header not found yet, try again
          setTimeout(() => tryModifyHeader(attempt + 1), 100);
        }
      } catch (error) {
        // Silently fail and retry
        if (attempt < 20) {
          setTimeout(() => tryModifyHeader(attempt + 1), 100);
        }
      }
    };
    
    // Start trying immediately and continuously
    tryModifyHeader();
  }

  private collapseSidebar(hide: boolean = true): void {
    if (this.lastSidebarState === hide) {
      return;
    }
    
    this.lastSidebarState = hide;
    
    try {
      const ha = document.querySelector("home-assistant");
      const main = ha?.shadowRoot?.querySelector("home-assistant-main");
      
      if (!main) {
        console.warn('Home Assistant main element not found for sidebar control');
        this.lastSidebarState = null;
        return;
      }

      if (hide) {
        main.dispatchEvent(new CustomEvent("hass-dock-sidebar", {
          detail: { dock: "always_hidden" },
          bubbles: true,
          composed: true,
        }));
      } else {
        this.dockAfterDrawerClosed(main, "docked");
      }
      
    } catch (error) {
      console.warn('Error in collapseSidebar:', error);
      this.lastSidebarState = null;
    }
  }

  private async dockAfterDrawerClosed(main: Element, targetDock: string = "docked"): Promise<void> {
    const drawer = main.shadowRoot?.querySelector("ha-drawer");

    // Check if drawer is already non-blocking
    const isOpen = (drawer as any)?.mdcFoundation?.isOpen?.() || (drawer as any)?.open === true;
    
    if (!isOpen) {
      // Already non-blocking, dock immediately
      main.dispatchEvent(new CustomEvent("hass-dock-sidebar", {
        detail: { dock: targetDock },
        bubbles: true,
        composed: true,
      }));
      return;
    }

    // Build a promise that resolves when the drawer is guaranteed non-blocking
    const waitForNonBlocking = () =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { 
          if (done) return; 
          done = true; 
          cleanup(); 
          resolve(); 
        };

        const cleanups: (() => void)[] = [];

        // 1) Drawer closed event
        if (drawer) {
          const onClosed = () => finish();
          drawer.addEventListener("MDCDrawer:closed", onClosed, { once: true });
          cleanups.push(() => drawer.removeEventListener("MDCDrawer:closed", onClosed));
        }

        // 2) Body overflow released by ha-drawer adapter
        const bodyObs = new MutationObserver(() => {
          const inline = document.body.style.overflow;
          const computed = getComputedStyle(document.body).overflow;
          if (inline !== "hidden" && computed !== "hidden") finish();
        });
        bodyObs.observe(document.body, { attributes: true, attributeFilter: ["style"] });
        cleanups.push(() => bodyObs.disconnect());

        // 3) Modal attribute removed from main
        const mainObs = new MutationObserver(() => {
          if (!main.hasAttribute("modal")) finish();
        });
        mainObs.observe(main, { attributes: true, attributeFilter: ["modal"] });
        cleanups.push(() => mainObs.disconnect());

        function cleanup() { 
          cleanups.forEach((fn) => fn()); 
        }
      });

    // Step A: ensure the drawer is closing
    main.dispatchEvent(new CustomEvent("hass-toggle-menu", {
      detail: { open: false },
      bubbles: true,
      composed: true,
    }));

    // Step B: wait until the overlay is truly gone
    await waitForNonBlocking();

    // Extra safety check as suggested
    if (document.body.style.overflow === "hidden") {
      main.dispatchEvent(new CustomEvent("hass-toggle-menu", {
        detail: { open: false },
        bubbles: true,
        composed: true,
      }));
    }

    // Step C: now it is safe to change the docking mode
    main.dispatchEvent(new CustomEvent("hass-dock-sidebar", {
      detail: { dock: targetDock },
      bubbles: true,
      composed: true,
    }));
  }

  private applyUIState(): void {
    if (this.state.headerVisible) {
      // Header is visible - make it transparent
      this.makeHeaderTransparent();
    } else {
      // Header is hidden - collapse it
      this.collapseHeader(true);
    }
    this.collapseSidebar(!this.state.sidebarVisible);
  }

  public async toggleHeader(): Promise<boolean> {
    this.state.headerVisible = !this.state.headerVisible;
    
    // Save to customizations if we have a customization manager
    if (this.customizationManager) {
      await this.customizationManager.setHeaderVisibility(!this.state.headerVisible);
    }
    
    if (this.state.headerVisible) {
      // Header is visible - make it transparent
      this.makeHeaderTransparent();
    } else {
      // Header is hidden - collapse it
      this.collapseHeader(true);
    }
    
    return this.state.headerVisible;
  }

  public async toggleSidebar(): Promise<boolean> {
    this.state.sidebarVisible = !this.state.sidebarVisible;
    
    // Save to customizations if we have a customization manager
    if (this.customizationManager) {
      await this.customizationManager.setSidebarVisibility(!this.state.sidebarVisible);
    }
    
    // Reset the last state tracker since this is a manual toggle
    this.lastSidebarState = null;
    
    // Re-find elements in case DOM changed
    this.collapseSidebar(!this.state.sidebarVisible);
    
    return this.state.sidebarVisible;
  }

  public isHeaderVisible(): boolean {
    return this.state.headerVisible;
  }

  public isSidebarVisible(): boolean {
    return this.state.sidebarVisible;
  }

  public getHeaderToggleText(): string {
    return this.state.headerVisible ? localize('toggles.hide_header') : localize('toggles.show_header');
  }

  public getSidebarToggleText(): string {
    return this.state.sidebarVisible ? localize('toggles.hide_sidebar') : localize('toggles.show_sidebar');
  }

  /**
   * Setup dashboard state listener for immediate UI updates
   */
  private setupDashboardStateListener(): void {
    if (!this.customizationManager) {
      return;
    }

    this.dashboardStateManager = DashboardStateManager.getInstance();
    
    // Store original state BEFORE any dashboard modifications
    this.originalState = {
      headerVisible: true, // Default HA state
      sidebarVisible: true // Default HA state  
    };
    
    // Apply dashboard settings immediately if we're already in dashboard
    if (this.dashboardStateManager.isDashboardActive()) {
      this.applyDashboardUISettings();
    }
    
    // Debounce restoration to avoid flicker on quick navigations
    let restoreTimeout: number | null = null;
    this.dashboardStateManager.addListener((isActive: boolean) => {
      if (isActive) {
        // Cancel pending restoration
        if (restoreTimeout !== null) {
          clearTimeout(restoreTimeout);
          restoreTimeout = null;
        }
        // Entering dashboard - apply dashboard UI settings
        requestAnimationFrame(() => {
          this.applyDashboardUISettings();
        });
      } else {
        // Leaving dashboard - schedule restoration after delay
        restoreTimeout = window.setTimeout(() => {
          this.restoreOriginalUIState();
          restoreTimeout = null;
        }, 300);
      }
    });
  }

  private applyDashboardUISettings(): void {
    if (!this.customizationManager) return;

    const shouldHideHeader = this.customizationManager.isHeaderHidden();
    const shouldHideSidebar = this.customizationManager.isSidebarHidden();

    // Update state to match customizations
    this.state.headerVisible = !shouldHideHeader;
    this.state.sidebarVisible = !shouldHideSidebar;

    if (this.state.headerVisible) {
      // Header is visible - make it transparent
      this.makeHeaderTransparent();
    } else {
      // Header is hidden - collapse it
      this.collapseHeader(true);
    }
    this.collapseSidebar(!this.state.sidebarVisible);
  }

  /**
   * Force reapplication of dashboard UI settings - call when settings change
   */
  public reapplyDashboardSettings(): void {
    if (this.customizationManager) {
      this.applyDashboardUISettings();
      
      if (!this.headerElement) {
        setTimeout(() => {
          this.applyDashboardUISettings();
        }, 500);
      }
    }
  }

  /**
   * Restore the original Home Assistant UI state
   */
  private restoreOriginalUIState(): void {
    if (!this.originalState) return;

    // Force restoration to default HA state
    const needsHeaderRestore = !this.originalState.headerVisible;
    const needsSidebarRestore = !this.originalState.sidebarVisible;

    // Restore header if it was hidden
    if (needsHeaderRestore || !this.state.headerVisible) {
      this.state.headerVisible = true;
      this.collapseHeader(false); // Show header
    }

    // Restore sidebar if it was hidden
    if (needsSidebarRestore || !this.state.sidebarVisible) {
      // Reset the last state tracker to force restoration
      this.lastSidebarState = null;
      this.state.sidebarVisible = true;
      this.collapseSidebar(false); // Show sidebar
    }
  }

  /**
   * Stop dashboard state listening
   */
  private stopDashboardStateListener(): void {
    if (this.dashboardStateManager) {
      // Note: We don't remove the listener since other components might be using it
      // The DashboardStateManager will handle cleanup when destroyed
      this.dashboardStateManager = null;
    }
  }

  /**
   * Cleanup method for complete shutdown
   */
  public cleanup(): void {
    this.listenerSetup = false;
    this.lastSidebarState = null;
    this.stopDashboardStateListener();
    this.restoreOriginalUIState();
  }

  public static resetInstance(): void {
    // Only for testing or complete cleanup
    if (HomeAssistantUIManager.instance) {
      HomeAssistantUIManager.instance.cleanup();
      HomeAssistantUIManager.instance.collapseHeader(false);
      HomeAssistantUIManager.instance.collapseSidebar(false);
      HomeAssistantUIManager.instance = null;
    }
  }
}
