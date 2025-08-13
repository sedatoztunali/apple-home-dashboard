import { ChipsConfigurationManager } from './ChipsConfigurationManager';

export class DragAndDropManager {
  private draggedElement: HTMLElement | null = null;
  private draggedEntityId: string | null = null;
  private draggedAreaId: string | null = null;
  private saveOrderCallback: (areaId: string) => void;
  private placeholder: HTMLElement | null = null;
  private customizationManager: any;
  private context: string; // Add context property

  constructor(saveOrderCallback: (areaId: string) => void, customizationManager?: any, context: string = 'home') {
    this.saveOrderCallback = saveOrderCallback;
    this.customizationManager = customizationManager;
    this.context = context; // Store the context
  }

  makeDraggable(wrapper: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let longPressTimer: number | null = null;
    let placeholder: HTMLElement | null = null;
    let allWrappers: HTMLElement[] = [];
    let areaContainer: HTMLElement | null = null;
    let lastPlaceholderUpdate = 0;
    let currentPlaceholderZone = -1; // Track which zone placeholder is currently in
    
    // Helper function to get coordinates from mouse or touch event
    const getEventCoordinates = (e: Event) => {
      if (e.type.startsWith('touch')) {
        const touchEvent = e as any; // Safe cast to access touch properties
        const touch = touchEvent.touches?.[0] || touchEvent.changedTouches?.[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      const mouseEvent = e as MouseEvent;
      return { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY };
    };
    
    const createPlaceholder = () => {
      placeholder = document.createElement('div');
      placeholder.className = 'entity-card-wrapper drag-placeholder';
      
      // Copy the grid sizing from the original wrapper
      const isTall = wrapper.classList.contains('tall');
      
      placeholder.style.cssText = `
        background: transparent;
        border: none;
        transition: all 0.3s ease;
        pointer-events: none;
        min-height: ${isTall ? '170px' : '80px'};
        position: relative;
      `;
      
      // Set appropriate grid span based on card type and screen size
      const setGridColumns = () => {
        const width = window.innerWidth;
        let gridSpan = 3; // Default desktop
        
        if (width <= 767) {
          gridSpan = 6; // Mobile: full width
        } else if (width <= 1199) {
          gridSpan = 4; // Tablet
        }
        
        placeholder!.style.gridColumn = `span ${gridSpan}`;
        placeholder!.style.gridRow = `span ${isTall ? '2' : '1'}`;
      };
      
      setGridColumns();
      
      // Insert placeholder at the wrapper's current position
      wrapper.parentNode!.insertBefore(placeholder, wrapper);
    };
    
    const startDrag = (e: Event) => {
      // Don't drag if clicking on edit controls
      if ((e.target as HTMLElement).closest('.entity-controls')) {
        return;
      }
      
      const coords = getEventCoordinates(e);
      startDragWithCoords(coords.clientX, coords.clientY);
      e.preventDefault();
    };
    
    const startDragWithCoords = (x: number, y: number) => {
      areaContainer = wrapper.closest('.area-entities, .room-group-grid, .scenes-grid, .cameras-grid') as HTMLElement;
      if (!areaContainer) {
        return;
      }
      
      allWrappers = Array.from(areaContainer.querySelectorAll('.entity-card-wrapper:not(.drag-placeholder)')) as HTMLElement[];
      
      isDragging = true;
      startX = x;
      startY = y;
      
      // Clear any visual feedback from long press and get clean rect
      wrapper.style.transition = '';
      wrapper.style.transform = '';
      
      // Get the natural size of the element before any drag transforms
      const rect = wrapper.getBoundingClientRect();
      
      // Create placeholder and style the dragging element
      createPlaceholder();
      currentPlaceholderZone = 0; // Start tracking zones
      
      wrapper.classList.add('dragging');
      wrapper.style.cssText = `
        position: fixed;
        left: ${x - rect.width / 2}px;
        top: ${y - rect.height / 2}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 10000;
        pointer-events: none;
        opacity: 1;
        transition: none;
        border-radius: 16px;
      `;
      
      // Store drag info
      this.draggedElement = wrapper;
      this.draggedEntityId = wrapper.dataset.entityId || null;
      this.draggedAreaId = areaContainer?.dataset.areaId || null;
      
      // Add move and end listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    };
    
    const updateDragPosition = (x: number, y: number) => {
      if (!isDragging || !wrapper) return;
      
      // Position card centered on cursor for natural feel
      const rect = wrapper.getBoundingClientRect();
      wrapper.style.left = `${x - rect.width / 2}px`;
      wrapper.style.top = `${y - rect.height / 2}px`;
      
      // Increase throttling for more stable behavior (150ms for less flashing)
      const now = Date.now();
      if (now - lastPlaceholderUpdate > 150) {
        this.findAndMovePlaceholder(x, y, placeholder, areaContainer, allWrappers, wrapper, currentPlaceholderZone, (newZone) => {
          currentPlaceholderZone = newZone;
        });
        lastPlaceholderUpdate = now;
      }
    };
    
    const endDrag = () => {
      // Always clear long press timer and visual feedback
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      
      // Always reset visual feedback
      wrapper.style.transition = '';
      wrapper.style.transform = '';
      
      if (!isDragging) return;
      
      isDragging = false;
      lastPlaceholderUpdate = 0; // Reset throttling
      currentPlaceholderZone = -1; // Reset zone tracking
      
      // Reset wrapper styles and position it where placeholder is
      if (placeholder && placeholder.parentNode) {
        wrapper.classList.remove('dragging');
        // Only reset drag-specific styles, don't clear all styles
        wrapper.style.position = '';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.width = '';
        wrapper.style.height = '';
        wrapper.style.zIndex = '';
        wrapper.style.pointerEvents = '';
        wrapper.style.transform = '';
        wrapper.style.opacity = '';
        wrapper.style.transition = '';
        wrapper.style.boxShadow = '';
        wrapper.style.borderRadius = '';
        wrapper.style.backdropFilter = '';
        placeholder.parentNode.insertBefore(wrapper, placeholder);
        placeholder.remove();
        placeholder = null;
        
        const areaId = areaContainer?.dataset.areaId;
        if (areaId) {
          this.saveOrderCallback(areaId);
          
          this.reconnectSingleCameraManager(wrapper);
          
          if ('vibrate' in navigator) {
            navigator.vibrate(30);
          }
        }
      } else {
        // Fallback: only reset drag-specific styles
        wrapper.classList.remove('dragging');
        wrapper.style.position = '';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.width = '';
        wrapper.style.height = '';
        wrapper.style.zIndex = '';
        wrapper.style.pointerEvents = '';
        wrapper.style.transform = '';
        wrapper.style.opacity = '';
        wrapper.style.transition = '';
        wrapper.style.boxShadow = '';
        wrapper.style.borderRadius = '';
        wrapper.style.backdropFilter = '';
        
        // Also reconnect camera manager for the moved card in fallback case
        this.reconnectSingleCameraManager(wrapper);
      }
      
      // Clean up drag state
      this.draggedElement = null;
      this.draggedEntityId = null;
      this.draggedAreaId = null;
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left mouse button
      startDrag(e);
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      // Don't start drag immediately on touch, wait for long press
      if ((e.target as HTMLElement).closest('.entity-controls')) {
        return;
      }
      
      // Prevent default to avoid issues with touch handling
      e.preventDefault();
      
      const coords = getEventCoordinates(e);
      startX = coords.clientX;
      startY = coords.clientY;
      
      // Add visual feedback while waiting for long press
      wrapper.style.transition = 'transform 0.2s ease';
      wrapper.style.transform = 'scale(0.98)';
      
      // Long press for better mobile UX - increased to 500ms to avoid quick tap issues
      longPressTimer = window.setTimeout(() => {
        // Add haptic feedback for supported devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        // Call startDrag with stored coordinates instead of the stale event
        startDragWithCoords(startX, startY);
      }, 300);
    };
    
    const handleTouchMove = (e: Event) => {
      const coords = getEventCoordinates(e);
      const moveDistance = Math.sqrt(
        Math.pow(coords.clientX - startX, 2) + Math.pow(coords.clientY - startY, 2)
      );
      
      // Cancel long press if user moves finger too much (increased tolerance for mobile)
      if (!isDragging && moveDistance > 15) { // Back to 15px for more stable long press
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          
          // Reset visual feedback completely
          wrapper.style.transition = '';
          wrapper.style.transform = '';
        }
        return;
      }
      
      if (!isDragging) return;
      
      updateDragPosition(coords.clientX, coords.clientY);
      e.preventDefault();
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updateDragPosition(e.clientX, e.clientY);
    };
    
    const handleMouseUp = () => {
      endDrag();
    };
    
    const handleTouchEnd = () => {
      // Always clear the long press timer immediately
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        
        // If drag hasn't started yet, reset visual feedback
        if (!isDragging) {
          wrapper.style.transition = '';
          wrapper.style.transform = '';
        }
      }
      
      endDrag();
    };
    
    // Add both mouse and touch event listeners
    wrapper.addEventListener('mousedown', handleMouseDown);
    wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    wrapper.addEventListener('touchend', handleTouchEnd);
    
    // Store handlers for cleanup
    (wrapper as any).__dragHandlers = {
      handleMouseDown,
      handleTouchStart,
      handleTouchEnd
    };
  }

  makeNotDraggable(wrapper: HTMLElement) {
    const handlers = (wrapper as any).__dragHandlers;
    if (handlers) {
      wrapper.removeEventListener('mousedown', handlers.handleMouseDown);
      wrapper.removeEventListener('touchstart', handlers.handleTouchStart);
      wrapper.removeEventListener('touchend', handlers.handleTouchEnd);
      delete (wrapper as any).__dragHandlers;
    }
  }

  private findAndMovePlaceholder(
    x: number, 
    y: number, 
    placeholder: HTMLElement | null, 
    areaContainer: HTMLElement | null, 
    allWrappers: HTMLElement[], 
    wrapper: HTMLElement,
    currentPlaceholderZone: number,
    updateZone: (zone: number) => void
  ) {
    if (!placeholder || !areaContainer) return;
    
    // Filter out wrapper and placeholder first
    const validWrappers = allWrappers.filter(w => w !== wrapper && w !== placeholder);
    
    if (validWrappers.length === 0) {
      // If no other cards, just place at the end
      areaContainer.appendChild(placeholder);
      updateZone(0);
      return;
    }
    
    // Get all card positions and sort them by their position in the grid (top to bottom, left to right)
    const cardPositions = validWrappers.map(card => {
      const rect = card.getBoundingClientRect();
      return {
        element: card,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      };
    }).sort((a, b) => {
      // Use more conservative row detection - larger tolerance for stability
      const rowDiff = a.top - b.top;
      if (Math.abs(rowDiff) > 25) { // Increased tolerance to reduce row switching
        return rowDiff;
      }
      return a.left - b.left; // Same row, sort by left position
    });
    
    // Simple insertion logic: find the card that's closest to cursor position
    let bestInsertionPoint = -1;
    let bestTargetElement = null;
    
    // Check if cursor is clearly before the first card
    const firstCard = cardPositions[0];
    if (x < firstCard.left - 30) { // Larger margin for more predictable behavior
      bestInsertionPoint = 0;
      bestTargetElement = firstCard.element;
    } else {
      // Find the best position by checking each card
      for (let i = 0; i < cardPositions.length; i++) {
        const currentCard = cardPositions[i];
        const nextCard = cardPositions[i + 1];
        
        // Check if cursor is in the vertical range of this card (with generous margins)
        const isInVerticalRange = y >= currentCard.top - 40 && y <= currentCard.bottom + 40;
        
        if (isInVerticalRange) {
          if (!nextCard) {
            // After last card - only if clearly to the right
            if (x > currentCard.right - 20) {
              bestInsertionPoint = i + 1;
              bestTargetElement = null;
            }
          } else {
            // Check if we should insert between current and next
            const isNextCardOnSameRow = Math.abs(currentCard.top - nextCard.top) <= 25;
            
            if (isNextCardOnSameRow) {
              // Cards are on same row - insert if cursor is between them with margin
              const midPoint = (currentCard.right + nextCard.left) / 2;
              if (x >= currentCard.centerX && x <= midPoint + 20) {
                bestInsertionPoint = i + 1;
                bestTargetElement = nextCard.element;
              }
            } else {
              // Next card is on different row - insert after current if cursor is to the right
              if (x > currentCard.centerX) {
                bestInsertionPoint = i + 1;
                bestTargetElement = nextCard.element;
              }
            }
          }
          
          // If we found a position, break to avoid overthinking
          if (bestInsertionPoint !== -1) {
            break;
          }
        }
      }
    }
    
    // If no insertion point found, use simple fallback
    if (bestInsertionPoint === -1) {
      // Find the card whose center is closest to cursor
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      cardPositions.forEach((card, index) => {
        const distance = Math.abs(x - card.centerX) + Math.abs(y - card.centerY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      const closestCard = cardPositions[closestIndex];
      if (x < closestCard.centerX) {
        bestInsertionPoint = closestIndex;
        bestTargetElement = closestCard.element;
      } else {
        bestInsertionPoint = closestIndex + 1;
        bestTargetElement = closestIndex + 1 < cardPositions.length ? 
          cardPositions[closestIndex + 1].element : null;
      }
    }
    
    // Only move if we're definitely switching to a different position
    if (currentPlaceholderZone === bestInsertionPoint) {
      return; // Same position, don't move
    }
    
    // Move placeholder to the determined position
    try {
      if (bestTargetElement) {
        areaContainer.insertBefore(placeholder, bestTargetElement);
      } else {
        // Insert at the end
        areaContainer.appendChild(placeholder);
      }
      
      // Update current position tracking
      updateZone(bestInsertionPoint);
    } catch (error) {
      console.warn('Error moving placeholder:', error);
    }
  }

  enableDragAndDrop(container: HTMLElement) {

    
    // Handle regular area containers
    const regularEntityWrappers = container.querySelectorAll('.area-entities .entity-card-wrapper, .room-group-grid .entity-card-wrapper, .scenes-grid .entity-card-wrapper, .cameras-grid .entity-card-wrapper');

    regularEntityWrappers.forEach(wrapper => {
      this.makeDraggable(wrapper as HTMLElement);
    });
    
    // Handle carousel containers specifically (but exclude chips carousels)
    const carouselContainers = container.querySelectorAll('.carousel-grid:not(.chips)');

    carouselContainers.forEach(carouselGrid => {
      const carouselEntityWrappers = carouselGrid.querySelectorAll('.entity-card-wrapper');

      carouselEntityWrappers.forEach(wrapper => {

        this.makeDraggableCarousel(wrapper as HTMLElement, carouselGrid as HTMLElement);
      });
    });

    // Handle chips as carousel
    if (container.classList.contains('permanent-chips')) {
      this.enableChipsCarousel(container);
    }
  }

  enableChipsCarousel(container: HTMLElement) {
    const chipsCarousels = container.querySelectorAll('.carousel-grid.chips');
    chipsCarousels.forEach((chipsCarousel) => {
      const chipWrappers = chipsCarousel.querySelectorAll('.chip-wrapper');
      chipWrappers.forEach((chipWrapper) => {
        this.makeDraggableCarousel(chipWrapper as HTMLElement, chipsCarousel as HTMLElement);
      });
    });
  }

  disableDragAndDrop(container: HTMLElement) {
    // Handle regular entity wrappers
    const entityWrappers = container.querySelectorAll('.entity-card-wrapper');
    entityWrappers.forEach(wrapper => {
      this.makeNotDraggable(wrapper as HTMLElement);
      
      // Also clean up carousel drag handlers if they exist
      const handlers = (wrapper as any).__carouselDragHandlers;
      if (handlers) {
        wrapper.removeEventListener('mousedown', handlers.handleMouseDown);
        wrapper.removeEventListener('touchstart', handlers.handleTouchStart);
        wrapper.removeEventListener('touchend', handlers.handleTouchEnd);
        delete (wrapper as any).__carouselDragHandlers;
      }
    });

    // Handle chip wrappers
    const chipWrappers = container.querySelectorAll('.chip-wrapper');
    chipWrappers.forEach(chipWrapper => {
      const chipElement = chipWrapper as HTMLElement;
      const handlers = (chipElement as any).__carouselDragHandlers;
      if (handlers) {
        chipElement.removeEventListener('mousedown', handlers.handleMouseDown);
        chipElement.removeEventListener('touchstart', handlers.handleTouchStart);
        chipElement.removeEventListener('touchend', handlers.handleTouchEnd);
        delete (chipElement as any).__carouselDragHandlers;
      }
    });
  }

  saveCurrentOrder(content: HTMLElement, areaId: string) {
    const areaContainer = content.querySelector(`[data-area-id="${areaId}"]`);
    if (!areaContainer) return;

    const wrappers = areaContainer.querySelectorAll('.entity-card-wrapper:not(.drag-placeholder)');
    const newOrder: string[] = [];

    wrappers.forEach(wrapper => {
      const entityId = (wrapper as HTMLElement).dataset.entityId;
      if (entityId) {
        newOrder.push(entityId);
      }
    });

    // Call the callback to save the order
    this.saveOrderCallback(areaId);
  }

  private makeDraggableCarousel(element: HTMLElement, carousel: HTMLElement) {

    
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let longPressTimer: number | null = null;
    let placeholder: HTMLElement | null = null;
    let lastPlaceholderUpdate = 0;
    let currentScrollSpeed = 0; // For smooth edge scrolling
    let scrollAnimationFrame: number | null = null;
    let originalElementWidth = 0; // Store original dimensions
    let originalElementHeight = 0;
    
    // Helper function for smooth continuous scrolling
    const animateScroll = (scrollableElement: HTMLElement) => {
      if (!isDragging || currentScrollSpeed === 0) {

        scrollAnimationFrame = null;
        return;
      }
      
      const oldScrollLeft = scrollableElement.scrollLeft;
      scrollableElement.scrollLeft = Math.max(0, scrollableElement.scrollLeft + currentScrollSpeed);

      scrollAnimationFrame = requestAnimationFrame(() => animateScroll(scrollableElement));
    };
    
    // Helper function to get coordinates from mouse or touch event
    const getEventCoordinates = (e: Event) => {
      if (e.type.startsWith('touch')) {
        const touchEvent = e as any;
        const touch = touchEvent.touches?.[0] || touchEvent.changedTouches?.[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      const mouseEvent = e as MouseEvent;
      return { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY };
    };
    
    const createCarouselPlaceholder = () => {
      placeholder = document.createElement('div');
      
      // Determine if this is a chip wrapper or entity wrapper
      const isChipWrapper = element.classList.contains('chip-wrapper');
      
      // For chips, measure the actual chip content, not the wrapper
      let elementWidth = element.offsetWidth;
      let elementHeight = element.offsetHeight;
      
      if (isChipWrapper) {
        const chipElement = element.querySelector('.chip') as HTMLElement;
        if (chipElement) {
          elementWidth = chipElement.offsetWidth;
          elementHeight = chipElement.offsetHeight;
        }
      }

      placeholder.className = isChipWrapper ? 'chip-wrapper drag-placeholder': 'entity-card-wrapper drag-placeholder';
      placeholder.style.cssText = `
          width: ${elementWidth}px;
          height: ${elementHeight}px;
          background: transparent;
          border: none;
          margin: 0px;
          flex-shrink: 0;
          transition: all 0.2s ease;
          pointer-events: none;
        `;
    };
     const startDragWithCoords = (x: number, y: number) => {
      isDragging = true;
      startX = x;
      startY = y;

      // Disable carousel scrolling during drag
      const carouselContainer = carousel.closest('.carousel-container') as HTMLElement;
      if (carouselContainer) {
        carouselContainer.style.overflowX = 'hidden';
        carouselContainer.style.pointerEvents = 'none'; // Prevent scroll events
        carouselContainer.style.scrollBehavior = 'auto'; // Disable smooth scrolling during drag
      }

      // Clear any visual feedback from long press and get clean rect
      element.style.transition = '';
      element.style.transform = '';

      const rect = element.getBoundingClientRect();
      
      // Store original dimensions
      originalElementWidth = rect.width;
      originalElementHeight = rect.height;

      // Create placeholder and style the dragging element
      createCarouselPlaceholder();

      element.classList.add('dragging');
      element.style.cssText = `
        position: fixed;
        left: ${x - rect.width / 2}px;
        top: ${y - rect.height / 2}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 10000;
        pointer-events: none;
        opacity: 1;
        transition: none;
        border-radius: 16px;
      `;

      // Insert placeholder after dragged element
      element.parentNode?.insertBefore(placeholder!, element.nextSibling);

      // Add global event listeners for dragging
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);

      // Store reference for cleanup
      this.draggedElement = element;
    };
     const updateCarouselDragPosition = (x: number, y: number) => {
      if (!isDragging || !placeholder) return;

      // Update dragged element position using stored original dimensions
      element.style.left = `${x - originalElementWidth / 2}px`;
      element.style.top = `${y - originalElementHeight / 2}px`;

      // Handle edge scrolling for carousel
      const carouselContainer = carousel.closest('.carousel-container') as HTMLElement;
      if (!carouselContainer) {

        return;
      }
      
      const carouselRect = carouselContainer.getBoundingClientRect();
      const scrollThreshold = 120; // pixels from edge to trigger scroll
      const maxScrollSpeed = 15; // max pixels per frame
      

      
      // Calculate distance-based scroll speed
      let newScrollSpeed = 0;
      if (x < carouselRect.left + scrollThreshold) {
        // Scroll left - speed increases as we get closer to edge
        const distanceFromEdge = x - carouselRect.left;
        const speedFactor = Math.max(0, 1 - (distanceFromEdge / scrollThreshold));
        newScrollSpeed = -Math.max(3, maxScrollSpeed * speedFactor);

      } else if (x > carouselRect.right - scrollThreshold) {
        // Scroll right - speed increases as we get closer to edge
        const distanceFromEdge = carouselRect.right - x;
        const speedFactor = Math.max(0, 1 - (distanceFromEdge / scrollThreshold));
        newScrollSpeed = Math.max(3, maxScrollSpeed * speedFactor);

      }
      
      // Update scroll speed and start/stop animation as needed
      if (newScrollSpeed !== currentScrollSpeed) {
        currentScrollSpeed = newScrollSpeed;

        if (currentScrollSpeed !== 0 && scrollAnimationFrame === null) {

          scrollAnimationFrame = requestAnimationFrame(() => animateScroll(carouselContainer));
        }
      }

      // Throttle placeholder updates for performance
      const now = Date.now();
      if (now - lastPlaceholderUpdate < 50) return;

      // Find all carousel items - look for both entity-card-wrapper and chip-wrapper
      const carouselItems = Array.from(carousel.children).filter(child => 
        (child.classList.contains('entity-card-wrapper') || child.classList.contains('chip-wrapper')) && 
        child !== element && child !== placeholder
      ) as HTMLElement[];

      // Find closest item based on horizontal position
      let closestElement: HTMLElement | null = null;
      let closestDistance = Infinity;

      carouselItems.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenterX = itemRect.left + itemRect.width / 2;
        const distance = Math.abs(x - itemCenterX);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestElement = item;
        }
      });

      // Move placeholder to appropriate position
      if (closestElement && placeholder) {
        const rect = (closestElement as HTMLElement).getBoundingClientRect();

        if (x < rect.left + rect.width / 2) {
          // Insert before the closest element
          carousel.insertBefore(placeholder, closestElement);
        } else {
          // Insert after the closest element
          carousel.insertBefore(placeholder, (closestElement as HTMLElement).nextSibling);
        }
      }

      lastPlaceholderUpdate = now;
    };
     const endCarouselDrag = () => {
      // Always clear long press timer and visual feedback
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      
      // Always reset visual feedback
      element.style.transition = '';
      element.style.transform = '';
      
      if (!isDragging) {
        return;
      }



      isDragging = false;
      lastPlaceholderUpdate = 0;
      currentScrollSpeed = 0; // Stop edge scrolling
      
      // Cancel any ongoing scroll animation
      if (scrollAnimationFrame !== null) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
      }

      // Re-enable carousel scrolling
      const carouselContainer = carousel.closest('.carousel-container') as HTMLElement;
      if (carouselContainer) {
        carouselContainer.style.overflowX = 'auto';
        carouselContainer.style.pointerEvents = 'auto';
        carouselContainer.style.scrollBehavior = ''; // Restore original scroll behavior
      }

      // Reset element styles and position it where placeholder is
      if (placeholder && placeholder.parentNode) {
        element.classList.remove('dragging');
        // Only reset drag-specific styles, don't clear all styles
        element.style.position = '';
        element.style.left = '';
        element.style.top = '';
        element.style.width = '';
        element.style.height = '';
        element.style.zIndex = '';
        element.style.pointerEvents = '';
        element.style.transform = '';
        element.style.opacity = '';
        element.style.transition = '';
        element.style.boxShadow = '';
        element.style.borderRadius = '';
        element.style.backdropFilter = '';
        placeholder.parentNode.insertBefore(element, placeholder);
        placeholder.remove();
        placeholder = null;

        // Update configuration based on new order
        this.updateCarouselConfiguration(carousel);

        // After successful drop, reconnect only the camera manager of the moved element
        this.reconnectSingleCameraManager(element);

        // Add haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(30);
        }
      } else {
        // Fallback: only reset drag-specific styles
        element.classList.remove('dragging');
        element.style.position = '';
        element.style.left = '';
        element.style.top = '';
        element.style.width = '';
        element.style.height = '';
        element.style.zIndex = '';
        element.style.pointerEvents = '';
        element.style.transform = '';
        element.style.opacity = '';
        element.style.transition = '';
        element.style.boxShadow = '';
        element.style.borderRadius = '';
        element.style.backdropFilter = '';
      }

      // Clean up drag state
      this.draggedElement = null;

      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left mouse button

      startDragWithCoords(e.clientX, e.clientY);
    };
    
    const handleTouchStart = (e: Event) => {
      // Check if edit mode is active - handle both entity-card-wrapper and chip-wrapper
      const entityWrapper = element.closest('.entity-card-wrapper');
      const chipWrapper = element.closest('.chip-wrapper');
      
      const wrapper = entityWrapper || chipWrapper;
      if (!wrapper?.classList.contains('edit-mode')) return;
      

      
      e.preventDefault();
      
      const coords = getEventCoordinates(e);
      startX = coords.clientX;
      startY = coords.clientY;
      
      // Add visual feedback while waiting for long press
      element.style.transition = 'transform 0.2s ease';
      element.style.transform = 'scale(0.98)';
      
      // Long press to start drag - increased to 2000ms to avoid quick tap issues
      const timerId = window.setTimeout(() => {
        // Add haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        startDragWithCoords(startX, startY);
      }, 300); 

      longPressTimer = timerId;
      // Also store on element for debugging
      (element as any).__longPressTimer = timerId;
    };
    
    const handleTouchMove = (e: Event) => {
      const coords = getEventCoordinates(e);
      const moveDistance = Math.sqrt(
        Math.pow(coords.clientX - startX, 2) + Math.pow(coords.clientY - startY, 2)
      );
      
      // Cancel long press if user moves finger too much
      if (!isDragging && moveDistance > 15) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          
          // Reset visual feedback
          element.style.transition = '';
          element.style.transform = '';
        }
        return;
      }
      
      if (!isDragging) return;
      
      updateCarouselDragPosition(coords.clientX, coords.clientY);
      e.preventDefault();
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updateCarouselDragPosition(e.clientX, e.clientY);
    };
    
    const handleMouseUp = () => {
      endCarouselDrag();
    };
    
    const handleTouchEnd = () => {
      // Always clear the long press timer immediately
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        (element as any).__longPressTimer = null;
        
        // If drag hasn't started yet, reset visual feedback
        if (!isDragging) {
          element.style.transition = '';
          element.style.transform = '';
        }
      }
      
      endCarouselDrag();
    };
    
    // Add event listeners only for mouse down (for immediate drag)
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    
    // Store handlers for cleanup
    (element as any).__carouselDragHandlers = {
      handleMouseDown,
      handleTouchStart,
      handleTouchEnd
    };
  }

  private updateCarouselConfiguration(carousel: HTMLElement) {
    
    // Get the area container and section type from the carousel itself
    const areaId = carousel.dataset.areaId;
    const sectionType = carousel.dataset.sectionType;
    
    if (!areaId || !sectionType) {

      return;
    }
    
    // Get current order of entities in the carousel 
    // For chips, look for chip-wrapper elements, otherwise entity-card-wrapper
    const wrapperSelector = sectionType === 'chips' ? '.chip-wrapper' : '.entity-card-wrapper';
    const entityWrappers = Array.from(carousel.querySelectorAll(wrapperSelector));
    const newOrder: string[] = [];
    
    entityWrappers.forEach((wrapper) => {
      // Primary source: wrapper data attribute (set during card creation)
      let entityId = (wrapper as HTMLElement).dataset.entityId;
      
      // For chips, also try chip-id
      if (!entityId && sectionType === 'chips') {
        entityId = (wrapper as HTMLElement).dataset.chipId;
      }
      
      // Fallback: try to get from the apple-home-card element
      if (!entityId) {
        const appleHomeCard = wrapper.querySelector('apple-home-card') as any;
        if (appleHomeCard) {
          entityId = appleHomeCard.entity || appleHomeCard.entityId || appleHomeCard.getAttribute('entity');
        }
      }
      
      if (entityId) {
        newOrder.push(entityId);
      } else {

      }
    });
    
    // Update the configuration through the customization manager
    if (this.customizationManager) {
      if (sectionType === 'chips') {
        // For chips, use ChipsConfigurationManager
        ChipsConfigurationManager.saveChipsOrder(this.customizationManager, newOrder);
      } else {
        // For other carousels, use the context-aware method
        this.customizationManager.updateCarouselOrderWithContext(areaId, sectionType, newOrder, this.context);
      }
    }
  }

  private reconnectSingleCameraManager(wrapper: HTMLElement) {
    const appleHomeCard = wrapper.querySelector('apple-home-card') as any;
    if (appleHomeCard && typeof appleHomeCard.reloadCameraImage === 'function') {
      appleHomeCard.reloadCameraImage();
    }
  }


}