/**
 * Simple debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Theme events constants
 */
const ThemeEvents = {
  variantUpdate: 'variant:update',
  variantSelected: 'variant:selected'
};

/**
 * Sticky Cart Bar Component
 * 
 * Manages the sticky cart bar that appears when the main add to cart button
 * is scrolled out of view. Handles variant synchronization and visibility.
 * 
 * @class StickyCartBar
 */
export default class StickyCartBar {
  /**
   * @type {HTMLElement | null} The sticky cart container element
   */
  element = null;

  /**
   * @type {HTMLElement | null} Main add to cart button element
   */
  #mainButton = null;

  /**
   * @type {IntersectionObserver | null} Observer for main button visibility
   */
  #intersectionObserver = null;

  /**
   * @type {boolean} Whether the main button is currently visible
   */
  #mainButtonVisible = true;

  /**
   * @type {AbortController} For cleanup of event listeners
   */
  #abortController = new AbortController();

  /**
   * @type {Object} Configuration options
   */
  #options;

  /**
   * @type {HTMLElement | null} Variant picker element in sticky bar
   */
  #stickyVariantPicker = null;

  /**
   * @type {HTMLElement | null} Main variant picker element
   */
  #mainVariantPicker = null;

  /**
   * @type {HTMLFormElement | null} Sticky cart form
   */
  #stickyForm = null;

  /**
   * @type {HTMLFormElement | null} Main product form
   */
  #mainForm = null;

  /**
   * Initialize the sticky cart bar
   * @param {HTMLElement} element - Sticky cart container element
   * @param {Object} options - Configuration options
   */
  constructor(element, options = {}) {
    this.element = element;
    this.#options = {
      mainButtonSelector: 'form[action*="/cart/add"] [type="submit"]',
      sectionId: '',
      productId: null,
      showQuantity: false,
      ...options
    };

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    if (!this.element) {
      console.warn('StickyCartBar: No element provided');
      return;
    }

    // Find main button and forms
    this.#findElements();
    
    // Setup intersection observer
    this.#setupIntersectionObserver();
    
    // Setup event listeners for variant sync
    this.#setupEventListeners();

    // Initial sync
    this.#syncFromMainToSticky();

    console.log('StickyCartBar: Initialized');
  }

  /**
   * Find required DOM elements
   */
  #findElements() {
    // Find main add to cart button
    this.#mainButton = document.querySelector(this.#options.mainButtonSelector);
    
    if (!this.#mainButton) {
      console.warn(`StickyCartBar: Main button not found with selector: ${this.#options.mainButtonSelector}`);
      return;
    }

    // Find forms
    this.#stickyForm = this.element.querySelector('form');
    this.#mainForm = this.#mainButton.closest('form');

    // Find variant pickers
    this.#stickyVariantPicker = this.element.querySelector('variant-picker');
    this.#mainVariantPicker = document.querySelector(`variant-picker:not(#sticky-cart-bar-${this.#options.sectionId} variant-picker)`);

    console.log('StickyCartBar: Elements found', {
      mainButton: !!this.#mainButton,
      stickyForm: !!this.#stickyForm, 
      mainForm: !!this.#mainForm,
      stickyVariantPicker: !!this.#stickyVariantPicker,
      mainVariantPicker: !!this.#mainVariantPicker
    });
  }

  /**
   * Setup intersection observer for main button visibility
   */
  #setupIntersectionObserver() {
    if (!this.#mainButton) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.#intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.#mainButtonVisible = entry.isIntersecting;
        this.#updateVisibility();
      });
    }, options);

    this.#intersectionObserver.observe(this.#mainButton);
  }

  /**
   * Setup event listeners for variant synchronization
   */
  #setupEventListeners() {
    const { signal } = this.#abortController;

    // Listen for variant updates from main form
    if (this.#mainVariantPicker) {
      this.#mainVariantPicker.addEventListener(ThemeEvents.variantUpdate, this.#onMainVariantUpdate.bind(this), { signal });
      this.#mainVariantPicker.addEventListener(ThemeEvents.variantSelected, this.#onMainVariantSelected.bind(this), { signal });
    }

    // Listen for changes in main form
    if (this.#mainForm) {
      this.#mainForm.addEventListener('change', this.#onMainFormChange.bind(this), { signal });
    }

    // Listen for variant updates from sticky form  
    if (this.#stickyVariantPicker) {
      this.#stickyVariantPicker.addEventListener(ThemeEvents.variantUpdate, this.#onStickyVariantUpdate.bind(this), { signal });
      this.#stickyVariantPicker.addEventListener(ThemeEvents.variantSelected, this.#onStickyVariantSelected.bind(this), { signal });
    }

    // Listen for changes in sticky form
    if (this.#stickyForm) {
      this.#stickyForm.addEventListener('change', this.#onStickyFormChange.bind(this), { signal });
    }

    // Listen for scroll events with debouncing
    window.addEventListener('scroll', debounce(this.#onScroll.bind(this), 50), { signal });
    window.addEventListener('resize', debounce(this.#onResize.bind(this), 100), { signal });
  }

  /**
   * Handle main variant update events
   * @param {CustomEvent} event - Variant update event
   */
  #onMainVariantUpdate(event) {
    console.log('StickyCartBar: Main variant updated', event.detail);
    this.#syncFromMainToSticky();
  }

  /**
   * Handle main variant selected events
   * @param {CustomEvent} event - Variant selected event
   */
  #onMainVariantSelected(event) {
    console.log('StickyCartBar: Main variant selected', event.detail);
    this.#syncFromMainToSticky();
  }

  /**
   * Handle main form changes
   * @param {Event} event - Form change event
   */
  #onMainFormChange(event) {
    // Debounce form changes to avoid excessive syncing
    clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      this.#syncFromMainToSticky();
    }, 100);
  }

  /**
   * Handle sticky variant update events
   * @param {CustomEvent} event - Variant update event
   */
  #onStickyVariantUpdate(event) {
    console.log('StickyCartBar: Sticky variant updated', event.detail);
    this.#syncFromStickyToMain();
  }

  /**
   * Handle sticky variant selected events
   * @param {CustomEvent} event - Variant selected event
   */
  #onStickyVariantSelected(event) {
    console.log('StickyCartBar: Sticky variant selected', event.detail);
    this.#syncFromStickyToMain();
  }

  /**
   * Handle sticky form changes
   * @param {Event} event - Form change event
   */
  #onStickyFormChange(event) {
    // Debounce form changes to avoid excessive syncing
    clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      this.#syncFromStickyToMain();
    }, 100);
  }

  /**
   * Handle scroll events
   */
  #onScroll() {
    // Additional scroll handling if needed
    // The intersection observer handles visibility
  }

  /**
   * Handle resize events
   */
  #onResize() {
    // Re-check visibility on resize
    this.#updateVisibility();
  }

  /**
   * Update sticky cart visibility based on main button visibility
   */
  #updateVisibility() {
    if (!this.element) return;

    if (this.#mainButtonVisible) {
      // Main button is visible, hide sticky cart
      this.element.hidden = true;
      this.element.classList.remove('is-visible');
    } else {
      // Main button is not visible, show sticky cart
      this.element.hidden = false;
      // Use requestAnimationFrame to ensure smooth animation
      requestAnimationFrame(() => {
        this.element.classList.add('is-visible');
      });
    }
  }

  /**
   * Sync variant selection from main form to sticky form
   */
  #syncFromMainToSticky() {
    if (!this.#mainForm || !this.#stickyForm) return;

    try {
      // Sync variant ID
      const mainVariantId = this.#mainForm.querySelector('[name="id"]');
      const stickyVariantId = this.#stickyForm.querySelector('[name="id"]');
      
      if (mainVariantId && stickyVariantId) {
        stickyVariantId.value = mainVariantId.value;
      }

      // Sync option selects
      const mainSelects = this.#mainForm.querySelectorAll('select[name^="options["]');
      const stickySelects = this.#stickyForm.querySelectorAll('select[name^="options["]');

      mainSelects.forEach((mainSelect, index) => {
        const stickySelect = stickySelects[index];
        if (stickySelect && mainSelect.value !== stickySelect.value) {
          stickySelect.value = mainSelect.value;
        }
      });

      // Sync radio buttons
      const mainRadios = this.#mainForm.querySelectorAll('input[type="radio"][name^="options["]:checked');
      mainRadios.forEach(mainRadio => {
        const stickyRadio = this.#stickyForm.querySelector(`input[type="radio"][name="${mainRadio.name}"][value="${mainRadio.value}"]`);
        if (stickyRadio) {
          stickyRadio.checked = true;
        }
      });

      // Sync quantity if enabled
      if (this.#options.showQuantity) {
        const mainQuantity = this.#mainForm.querySelector('[name="quantity"]');
        const stickyQuantity = this.#stickyForm.querySelector('[name="quantity"]');
        
        if (mainQuantity && stickyQuantity) {
          stickyQuantity.value = mainQuantity.value;
        }
      }

      // Update button state
      this.#updateButtonState();

    } catch (error) {
      console.error('StickyCartBar: Error syncing from main to sticky', error);
    }
  }

  /**
   * Sync variant selection from sticky form to main form
   */
  #syncFromStickyToMain() {
    if (!this.#mainForm || !this.#stickyForm) return;

    try {
      // Sync variant ID
      const mainVariantId = this.#mainForm.querySelector('[name="id"]');
      const stickyVariantId = this.#stickyForm.querySelector('[name="id"]');
      
      if (mainVariantId && stickyVariantId) {
        mainVariantId.value = stickyVariantId.value;
      }

      // Sync option selects
      const mainSelects = this.#mainForm.querySelectorAll('select[name^="options["]');
      const stickySelects = this.#stickyForm.querySelectorAll('select[name^="options["]');

      stickySelects.forEach((stickySelect, index) => {
        const mainSelect = mainSelects[index];
        if (mainSelect && stickySelect.value !== mainSelect.value) {
          mainSelect.value = stickySelect.value;
          // Trigger change event on main select
          mainSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Sync radio buttons
      const stickyRadios = this.#stickyForm.querySelectorAll('input[type="radio"][name^="options["]:checked');
      stickyRadios.forEach(stickyRadio => {
        const mainRadio = this.#mainForm.querySelector(`input[type="radio"][name="${stickyRadio.name}"][value="${stickyRadio.value}"]`);
        if (mainRadio) {
          mainRadio.checked = true;
          mainRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Sync quantity if enabled
      if (this.#options.showQuantity) {
        const mainQuantity = this.#mainForm.querySelector('[name="quantity"]');
        const stickyQuantity = this.#stickyForm.querySelector('[name="quantity"]');
        
        if (mainQuantity && stickyQuantity) {
          mainQuantity.value = stickyQuantity.value;
        }
      }

    } catch (error) {
      console.error('StickyCartBar: Error syncing from sticky to main', error);
    }
  }

  /**
   * Update button state based on variant availability
   */
  #updateButtonState() {
    const stickyButton = this.#stickyForm?.querySelector('[type="submit"]');
    const mainButton = this.#mainButton;

    if (stickyButton && mainButton) {
      // Copy disabled state from main button
      stickyButton.disabled = mainButton.disabled;
      
      // Copy button text if it has changed
      const mainButtonText = mainButton.querySelector('.add-to-cart-button__text, .button__text')?.textContent?.trim();
      const stickyButtonText = stickyButton.querySelector('.sticky-cart__button-text');
      
      if (mainButtonText && stickyButtonText && stickyButtonText.textContent.trim() !== mainButtonText) {
        stickyButtonText.textContent = mainButtonText;
      }
    }
  }

  /**
   * Destroy the component and clean up
   */
  destroy() {
    // Disconnect intersection observer
    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
      this.#intersectionObserver = null;
    }

    // Abort all event listeners
    this.#abortController.abort();

    // Clear timeouts
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
    }

    // Reset properties
    this.#mainButton = null;
    this.#stickyForm = null;
    this.#mainForm = null;
    this.#stickyVariantPicker = null;
    this.#mainVariantPicker = null;

    console.log('StickyCartBar: Destroyed');
  }
}