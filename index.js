import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { LayoutBuilderUI } from "./layout-builder.js";

// === POLYFILLS FOR OLDER BROWSERS ===
// queueMicrotask polyfill (for browsers before 2019)
if (typeof queueMicrotask !== 'function') {
    window.queueMicrotask = function(callback) {
        Promise.resolve().then(callback).catch(e => setTimeout(() => { throw e; }));
    };
}

// Element.closest polyfill (for IE11 and old mobile)
if (!Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
        let el = this;
        while (el && el.nodeType === 1) {
            if (el.matches(selector)) return el;
            el = el.parentElement || el.parentNode;
        }
        return null;
    };
}

// Element.matches polyfill (dependency for closest)
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

const extensionName = "floating-viewer";

// Dynamically get extension folder path from the script's URL
// This works for both "Install for all users" and "Install just for me"
const extensionFolderPath = (() => {
    const scriptUrl = import.meta.url;
    // Remove origin and get the path, then remove /index.js
    try {
        const url = new URL(scriptUrl);
        const path = url.pathname;
        // Remove leading slash and the filename
        const folderPath = path.replace(/^\//, '').replace(/\/index\.js$/, '');
        console.log(`[${extensionName}] Detected path: ${folderPath}`);
        return folderPath;
    } catch (e) {
        // Fallback to third-party path if detection fails
        console.warn(`[${extensionName}] Path detection failed, using fallback`);
        return `scripts/extensions/third-party/${extensionName}`;
    }
})();

const defaultSettings = {
    enabled: true,
    interceptAvatars: true,
    interceptGallery: true,
    rememberPosition: true,
    rememberLayout: false, // Remember positions for all viewers (slot-based)
    defaultSize: 60,  // Percentage of viewport (10-100)
    enableZoom: true,
    maxZoom: 300,     // Maximum zoom percentage (100-500)
    freePan: false,   // Allow panning beyond image bounds
    multiImage: true,
    maxInstances: 5,  // Max simultaneous windows (1-10)
    preventOverlap: false, // Prevent viewers from overlapping each other
    // Layout system settings
    layoutEnabled: false,       // Master toggle for layout system
    activeLayoutId: null,       // Currently active layout ID
    layoutFillMode: false,      // DEPRECATED - kept for migration
    layoutFitMode: 'classic'    // Image fit mode: classic, cover, contain, stretch, center
};

// ===== LAYOUT MANAGER =====
const LAYOUTS_STORAGE_KEY = 'floating-viewer-layouts';

// Layout Manager Class
class LayoutManager {
    constructor() {
        this.layouts = {};          // All layouts (global + theme)
        this.activeLayout = null;   // Currently active layout object
        this.builderOpen = false;   // Is builder UI open
        this.selectedSlotId = null; // Currently selected slot in builder
        this.isDragging = false;
        this.isResizing = false;
        this.loadFromStorage();
    }
    
    // Load layouts from localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(LAYOUTS_STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this.layouts = data.layouts || {};
            }
        } catch (e) {
            console.warn(`[${extensionName}] Failed to load layouts:`, e);
            this.layouts = {};
        }
    }
    
    // Save layouts to localStorage
    saveToStorage() {
        try {
            const data = {
                layouts: this.layouts,
                version: 1
            };
            localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error(`[${extensionName}] Failed to save layouts:`, e);
        }
    }
    
    // Check if layout system is enabled
    isEnabled() {
        return extension_settings[extensionName]?.layoutEnabled || false;
    }
    
    // Get all layout IDs and names
    getLayoutList() {
        return Object.entries(this.layouts).map(([id, layout]) => ({
            id,
            name: layout.name,
            slotCount: layout.slots?.length || 0,
            scope: layout.scope || 'global',
            theme: layout.theme || null
        }));
    }
    
    // Get a specific layout by ID
    getLayout(layoutId) {
        return this.layouts[layoutId] || null;
    }
    
    // Get the currently active layout
    getActiveLayout() {
        const activeId = extension_settings[extensionName]?.activeLayoutId;
        if (activeId && this.layouts[activeId]) {
            return this.layouts[activeId];
        }
        return null;
    }
    
    // Set active layout
    setActiveLayout(layoutId) {
        extension_settings[extensionName].activeLayoutId = layoutId;
        this.activeLayout = layoutId ? this.layouts[layoutId] : null;
        saveSettingsDebounced();
    }
    
    // Create a new layout
    createLayout(name = 'New Layout') {
        const id = 'layout-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const layout = {
            name,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            scope: 'global',
            theme: null,
            slots: [
                this.createDefaultSlot(1)
            ],
            gridSettings: {
                enabled: false,
                size: 20,
                snap: false
            },
            collisionSettings: {
                preventOffscreen: true,
                preventOverlap: false
            }
        };
        
        this.layouts[id] = layout;
        this.saveToStorage();
        return id;
    }
    
    // Create a default slot
    createDefaultSlot(slotId) {
        return {
            id: slotId,
            position: { x: 10 + (slotId - 1) * 5, y: 10 + (slotId - 1) * 5 },
            size: { width: 40, height: 60 },
            zIndex: 500 + slotId,
            aspectRatio: null,
            borders: {
                enabled: false,
                width: 2,
                color: '#ffffff',
                radius: 10
            }
        };
    }
    
    // Update a layout
    updateLayout(layoutId, updates) {
        if (!this.layouts[layoutId]) return false;
        
        Object.assign(this.layouts[layoutId], updates);
        this.layouts[layoutId].modified = new Date().toISOString();
        this.saveToStorage();
        return true;
    }
    
    // Delete a layout
    deleteLayout(layoutId) {
        if (!this.layouts[layoutId]) return false;
        
        delete this.layouts[layoutId];
        this.saveToStorage();
        
        // Clear active if it was this one
        if (extension_settings[extensionName]?.activeLayoutId === layoutId) {
            this.setActiveLayout(null);
        }
        return true;
    }
    
    // Add a slot to a layout
    addSlot(layoutId) {
        const layout = this.layouts[layoutId];
        if (!layout) return null;
        
        const maxSlots = extension_settings[extensionName]?.maxInstances || 10;
        if (layout.slots.length >= maxSlots) {
            toastr.warning(`Maximum ${maxSlots} slots allowed - Update maxInstances to increase (max 10)`, 'Layout Builder');
            return null;
        }
        
        // Find next available slot ID
        const usedIds = layout.slots.map(s => s.id);
        let newId = 1;
        while (usedIds.includes(newId) && newId <= maxSlots) newId++;
        
        const newSlot = this.createDefaultSlot(newId);
        layout.slots.push(newSlot);
        layout.modified = new Date().toISOString();
        this.saveToStorage();
        
        return newSlot;
    }
    
    // Remove a slot from a layout
    removeSlot(layoutId, slotId) {
        const layout = this.layouts[layoutId];
        if (!layout) return false;
        
        if (layout.slots.length <= 1) {
            toastr.warning('Cannot remove the last slot', 'Layout Builder');
            return false;
        }
        
        layout.slots = layout.slots.filter(s => s.id !== slotId);
        layout.modified = new Date().toISOString();
        this.saveToStorage();
        return true;
    }
    
    // Update a specific slot
    updateSlot(layoutId, slotId, updates) {
        const layout = this.layouts[layoutId];
        if (!layout) return false;
        
        const slot = layout.slots.find(s => s.id === slotId);
        if (!slot) return false;
        
        Object.assign(slot, updates);
        layout.modified = new Date().toISOString();
        this.saveToStorage();
        return true;
    }
    
    // Get slot configuration for a viewer ID (matches by array position, not slot ID)
    getSlotForViewer(viewerId) {
        const layout = this.getActiveLayout();
        if (!layout) return null;
        
        // viewerId is 1-indexed, array is 0-indexed
        // So viewerId 1 → slots[0], viewerId 2 → slots[1], etc.
        const slotIndex = viewerId - 1;
        return layout.slots[slotIndex] || null;
    }
    
    // Reorder a slot to a new position (newIndex is 0-based)
    reorderSlot(layoutId, slotId, newIndex) {
        const layout = this.layouts[layoutId];
        if (!layout) return false;
        
        const currentIndex = layout.slots.findIndex(s => s.id === slotId);
        if (currentIndex === -1) return false;
        if (newIndex < 0 || newIndex >= layout.slots.length) return false;
        
        // Remove slot from current position
        const [slot] = layout.slots.splice(currentIndex, 1);
        // Insert at new position
        layout.slots.splice(newIndex, 0, slot);
        
        layout.modified = new Date().toISOString();
        this.saveToStorage();
        return true;
    }
    
    // Renumber slots to match their array order (1, 2, 3, ...)
    renumberSlots(layoutId) {
        const layout = this.layouts[layoutId];
        if (!layout) return false;
        
        layout.slots.forEach((slot, index) => {
            slot.id = index + 1;
        });
        
        layout.modified = new Date().toISOString();
        this.saveToStorage();
        return true;
    }
    
    // Get position/size for a viewer based on layout
    getViewerConfig(viewerId) {
        const slot = this.getSlotForViewer(viewerId);
        if (!slot) return null;
        
        // Convert percentage to pixels
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        return {
            left: (slot.position.x / 100) * vw,
            top: (slot.position.y / 100) * vh,
            width: (slot.size.width / 100) * vw,
            height: (slot.size.height / 100) * vh,
            zIndex: slot.zIndex,
            aspectRatio: slot.aspectRatio,
            borders: slot.borders
        };
    }
}

// Global layout manager instance
let layoutManager = null;
let layoutBuilderUI = null;

function getLayoutManager() {
    if (!layoutManager) {
        layoutManager = new LayoutManager();
    }
    return layoutManager;
}

function getLayoutBuilderUI() {
    if (!layoutBuilderUI) {
        layoutBuilderUI = new LayoutBuilderUI(getLayoutManager(), extensionFolderPath, extensionName);
    }
    return layoutBuilderUI;
}

function openLayoutBuilder() {
    const builder = getLayoutBuilderUI();
    builder.open();
}

function loadSettings() {
    if (!extension_settings[extensionName]) extension_settings[extensionName] = {};
    
    // Merge defaults with existing settings
    extension_settings[extensionName] = Object.assign({}, defaultSettings, extension_settings[extensionName]);
    
    // Update UI
    $("#floating_viewer_enable").prop("checked", extension_settings[extensionName].enabled);
    $("#floating_viewer_intercept_avatars").prop("checked", extension_settings[extensionName].interceptAvatars);
    $("#floating_viewer_intercept_gallery").prop("checked", extension_settings[extensionName].interceptGallery);
    $("#floating_viewer_remember_position").prop("checked", extension_settings[extensionName].rememberPosition);
    $("#floating_viewer_remember_layout").prop("checked", extension_settings[extensionName].rememberLayout);
    $("#floating_viewer_default_size").val(extension_settings[extensionName].defaultSize);
    $("#floating_viewer_enable_zoom").prop("checked", extension_settings[extensionName].enableZoom);
    $("#floating_viewer_max_zoom").val(extension_settings[extensionName].maxZoom);
    $("#floating_viewer_free_pan").prop("checked", extension_settings[extensionName].freePan);
    $("#floating_viewer_multi_image").prop("checked", extension_settings[extensionName].multiImage);
    $("#floating_viewer_max_instances").val(extension_settings[extensionName].maxInstances);
    
    // Layout system settings
    $("#floating_viewer_layout_enabled").prop("checked", extension_settings[extensionName].layoutEnabled);
    
    // Migrate old layoutFillMode to new layoutFitMode
    if (extension_settings[extensionName].layoutFillMode === true && !extension_settings[extensionName].layoutFitMode) {
        extension_settings[extensionName].layoutFitMode = 'cover';
    }
    $("#floating_viewer_fit_mode").val(extension_settings[extensionName].layoutFitMode || 'classic');
    $("#floating_viewer_prevent_overlap").prop("checked", extension_settings[extensionName].preventOverlap);
    
    // Gray out default size when remember position is enabled
    updateDefaultSizeState();
    updateMultiImageState();
    updateLayoutState();
}

function updateDefaultSizeState() {
    const isRememberEnabled = extension_settings[extensionName].rememberPosition;
    $("#floating_viewer_default_size").prop("disabled", isRememberEnabled);
    $("#floating_viewer_default_size").css("opacity", isRememberEnabled ? "0.5" : "1");
}

function updateMultiImageState() {
    const isMultiEnabled = extension_settings[extensionName].multiImage;
    $("#floating_viewer_max_instances").prop("disabled", !isMultiEnabled);
    $("#floating_viewer_max_instances").css("opacity", isMultiEnabled ? "1" : "0.5");
}

function updateLayoutState() {
    const isLayoutEnabled = extension_settings[extensionName].layoutEnabled;
    const controls = $("#floating_viewer_layout_controls");
    
    if (isLayoutEnabled) {
        controls.removeClass('fv-layout-disabled');
        // Populate layout dropdown
        populateLayoutDropdown();
    } else {
        controls.addClass('fv-layout-disabled');
    }
}

function populateLayoutDropdown() {
    const manager = getLayoutManager();
    const layouts = manager.getLayoutList();
    const activeId = extension_settings[extensionName].activeLayoutId;
    const dropdown = $("#floating_viewer_active_layout");
    
    // Clear existing options except the first one
    dropdown.find('option:not(:first)').remove();
    
    // Add layout options
    layouts.forEach(layout => {
        const option = $('<option></option>')
            .val(layout.id)
            .text(`${layout.name} (${layout.slotCount} slots)`);
        if (layout.id === activeId) {
            option.prop('selected', true);
        }
        dropdown.append(option);
    });
}

function saveSettings() {
    extension_settings[extensionName].enabled = $("#floating_viewer_enable").prop("checked");
    extension_settings[extensionName].interceptAvatars = $("#floating_viewer_intercept_avatars").prop("checked");
    extension_settings[extensionName].interceptGallery = $("#floating_viewer_intercept_gallery").prop("checked");
    extension_settings[extensionName].rememberPosition = $("#floating_viewer_remember_position").prop("checked");
    extension_settings[extensionName].rememberLayout = $("#floating_viewer_remember_layout").prop("checked");
    
    // Clamp default size to valid range
    let size = parseInt($("#floating_viewer_default_size").val()) || 60;
    size = Math.max(10, Math.min(100, size));
    extension_settings[extensionName].defaultSize = size;
    $("#floating_viewer_default_size").val(size);
    
    // Zoom settings
    extension_settings[extensionName].enableZoom = $("#floating_viewer_enable_zoom").prop("checked");
    let maxZoom = parseInt($("#floating_viewer_max_zoom").val()) || 300;
    maxZoom = Math.max(100, Math.min(500, maxZoom));
    extension_settings[extensionName].maxZoom = maxZoom;
    $("#floating_viewer_max_zoom").val(maxZoom);
    extension_settings[extensionName].freePan = $("#floating_viewer_free_pan").prop("checked");
    
    // Multi-image settings
    extension_settings[extensionName].multiImage = $("#floating_viewer_multi_image").prop("checked");
    let maxInstances = parseInt($("#floating_viewer_max_instances").val()) || 5;
    maxInstances = Math.max(1, Math.min(10, maxInstances));
    extension_settings[extensionName].maxInstances = maxInstances;
    $("#floating_viewer_max_instances").val(maxInstances);
    
    // Layout system settings
    extension_settings[extensionName].layoutEnabled = $("#floating_viewer_layout_enabled").prop("checked");
    extension_settings[extensionName].layoutFitMode = $("#floating_viewer_fit_mode").val() || 'classic';
    extension_settings[extensionName].preventOverlap = $("#floating_viewer_prevent_overlap").prop("checked");
    
    saveSettingsDebounced();
}

// Detect if PRIMARY input is touch (not just touch support)
const isTouchDevice = () => {
    if (window.matchMedia) {
        return window.matchMedia('(pointer: coarse)').matches;
    }
    return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
};

// Session storage for remembering position and size
const STORAGE_KEY = 'floating-viewer-state';
const LAYOUT_KEY = 'floating-viewer-layout';

function saveViewerState(left, top, width, height) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top, width, height }));
    } catch (e) { /* Storage not available */ }
}

function getViewerState() {
    try {
        const state = sessionStorage.getItem(STORAGE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (e) {
        return null;
    }
}

// Layout storage (object keyed by viewerId)
function saveLayoutPosition(viewerId, left, top, width, height) {
    try {
        const layout = getLayoutState() || {};
        layout[viewerId] = { left, top, width, height };
        sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch (e) { /* Storage not available */ }
}

function getLayoutState() {
    try {
        const layout = sessionStorage.getItem(LAYOUT_KEY);
        return layout ? JSON.parse(layout) : null;
    } catch (e) {
        return null;
    }
}

function getLayoutPosition(viewerId) {
    const layout = getLayoutState();
    return layout ? layout[viewerId] : null;
}

// Locked viewers storage (array of viewerIds)
const LOCKED_KEY = 'floating-viewer-locked';

function getLockedViewers() {
    try {
        const locked = sessionStorage.getItem(LOCKED_KEY);
        return locked ? JSON.parse(locked) : [];
    } catch (e) {
        return [];
    }
}

function setViewerLocked(viewerId, isLocked) {
    try {
        let locked = getLockedViewers();
        if (isLocked && !locked.includes(viewerId)) {
            locked.push(viewerId);
        } else if (!isLocked) {
            locked = locked.filter(id => id !== viewerId);
        }
        sessionStorage.setItem(LOCKED_KEY, JSON.stringify(locked));
    } catch (e) { /* Storage not available */ }
}

function isViewerLocked(viewerId) {
    return getLockedViewers().includes(viewerId);
}

function clearLayoutState() {
    try {
        const locked = getLockedViewers();
        if (locked.length > 0) {
            // Keep locked positions, remove only unlocked
            const layout = getLayoutState() || {};
            const newLayout = {};
            for (const id of locked) {
                if (layout[id]) {
                    newLayout[id] = layout[id];
                }
            }
            sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(newLayout));
        } else {
            sessionStorage.removeItem(LAYOUT_KEY);
        }
        sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* Storage not available */ }
}

// ===== MULTI-IMAGE VIEWER MANAGEMENT =====
let activeViewers = [];

// Get next available viewerId (1 to maxInstances)
function getNextViewerId() {
    const settings = extension_settings[extensionName];
    const maxId = settings.maxInstances || 10;
    const usedIds = activeViewers.map(v => v.viewerId);
    for (let id = 1; id <= maxId; id++) {
        if (!usedIds.includes(id)) return id;
    }
    return null; // All IDs in use
}
let focusedViewer = null;

function closeViewer(viewerData, animate = true) {
    const { windowEl, cleanup, viewerId } = viewerData;
    const settings = extension_settings[extensionName];
    
    // Save state before closing
    if (settings.rememberPosition) {
        const imgEl = windowEl.find('.fv-image');
        const currentLeft = parseInt(windowEl.css('left')) || 0;
        const currentTop = parseInt(windowEl.css('top')) || 0;
        const width = imgEl.width();
        const height = imgEl.height();
        
        // Save to layout if layout mode, otherwise single state
        if (settings.rememberLayout && viewerId) {
            saveLayoutPosition(viewerId, currentLeft, currentTop, width, height);
        } else {
            saveViewerState(currentLeft, currentTop, width, height);
        }
    }
    
    // Run cleanup
    if (cleanup) cleanup();
    
    // Remove from active list
    activeViewers = activeViewers.filter(v => v !== viewerData);
    if (focusedViewer === viewerData) {
        focusedViewer = activeViewers[activeViewers.length - 1] || null;
    }
    
    if (animate) {
        windowEl.addClass('fv-closing');
        setTimeout(() => windowEl.remove(), 150);
    } else {
        windowEl.remove();
    }
}

function closeAllViewers() {
    [...activeViewers].forEach(v => closeViewer(v, false));
}

// Keyboard handler for Escape
function handleKeydown(e) {
    if (e.key === 'Escape' && focusedViewer) {
        e.preventDefault();
        closeViewer(focusedViewer);
    }
}

// Initialize keyboard listener once
let keyboardListenerActive = false;
function ensureKeyboardListener() {
    if (!keyboardListenerActive) {
        document.addEventListener('keydown', handleKeydown);
        keyboardListenerActive = true;
    }
}

// ===== PANEL DETECTION FOR Z-INDEX MANAGEMENT =====
const Z_INDEX_HIGH = 3500;  // Above topbar
const Z_INDEX_LOW = 500;    // Below panels

// Update z-index for all active viewers
function updateViewerZIndex(zIndex) {
    activeViewers.forEach(v => {
        if (v.windowEl) {
            v.windowEl.css('z-index', zIndex);
        }
    });
}

// Check if any SillyTavern panel is open
function isPanelOpen() {
    // Common panel selectors in SillyTavern
    const panelSelectors = [
        '.drawer-content:visible',
        '#right-nav-panel.openDrawer',
        '#left-nav-panel.openDrawer',
        '.popup:visible',
        '#character_popup:visible',
        '#dialogue_popup:visible'
    ];
    
    for (const selector of panelSelectors) {
        if ($(selector).length > 0) {
            return true;
        }
    }
    return false;
}

// Observe DOM changes to detect panel open/close
let panelObserverActive = false;
function initPanelObserver() {
    if (panelObserverActive) return;
    
    const observer = new MutationObserver(() => {
        const panelOpen = isPanelOpen();
        updateViewerZIndex(panelOpen ? Z_INDEX_LOW : Z_INDEX_HIGH);
    });
    
    // Observe body for class/style changes
    observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style']
    });
    
    panelObserverActive = true;
}

function openEnhancedGallery(imageSrc) {
    const settings = extension_settings[extensionName];
    
    // Get effective max instances (use layout slot count when layout is active)
    let effectiveMaxInstances = settings.maxInstances;
    if (settings.layoutEnabled) {
        const layout = getLayoutManager().getActiveLayout();
        if (layout && layout.slots) {
            effectiveMaxInstances = layout.slots.length;
        }
    }
    
    // Check multi-image settings
    if (!settings.multiImage) {
        // Close existing viewers first
        closeAllViewers();
    } else {
        // Enforce max instances
        while (activeViewers.length >= effectiveMaxInstances) {
            closeViewer(activeViewers[0], false);
        }
    }
    
    // Get template and clone it
    const template = document.getElementById('floating-viewer-template');
    if (!template) {
        console.error(`[${extensionName}] Viewer template not found`);
        return;
    }
    
    const clone = template.content.cloneNode(true);
    const windowEl = $(clone.querySelector('.floating-viewer-window'));
    const containerEl = windowEl.find('.fv-image-container');
    const imgEl = windowEl.find('.fv-image');
    const closeBtn = windowEl.find('.fv-close');
    const resizeHandle = windowEl.find('.fv-resize-handle');
    
    // Append to body
    $(document.body).append(windowEl);
    
    // Cleanup functions to call on close
    let cleanupFns = [];
    
    // Load image to get natural dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
        const naturalWidth = tempImg.naturalWidth;
        const naturalHeight = tempImg.naturalHeight;
        const aspectRatio = naturalWidth / naturalHeight;
        
        // Calculate initial size
        const viewportPercent = (settings.defaultSize || 60) / 100;
        let width = naturalWidth;
        let height = naturalHeight;
        const maxWidth = window.innerWidth * viewportPercent;
        const maxHeight = window.innerHeight * viewportPercent;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }
        
        // Get viewerId for this viewer
        const viewerId = getNextViewerId();
        if (!viewerId) {
            console.warn(`[${extensionName}] No available viewer ID`);
            windowEl.remove();
            return;
        }
        
        // Check for remembered state
        let finalLeft, finalTop, finalWidth, finalHeight;
        let usedSavedState = false;
        
        // Helper to apply saved state
        const applySavedState = (state) => {
            finalWidth = Math.min(state.width || width, naturalWidth);
            finalHeight = finalWidth / aspectRatio;
            
            if (finalWidth > window.innerWidth * 0.95) {
                finalWidth = window.innerWidth * 0.95;
                finalHeight = finalWidth / aspectRatio;
            }
            if (finalHeight > window.innerHeight * 0.95) {
                finalHeight = window.innerHeight * 0.95;
                finalWidth = finalHeight * aspectRatio;
            }
            
            const maxLeft = window.innerWidth - finalWidth;
            const maxTop = window.innerHeight - finalHeight;
            finalLeft = Math.max(0, Math.min(state.left || 0, maxLeft));
            finalTop = Math.max(0, Math.min(state.top || 0, maxTop));
            usedSavedState = true;
        };
        
        // Check for active layout configuration FIRST (highest priority)
        let layoutConfig = null;
        let usingLayoutSlot = false;
        let slotWidth = 0, slotHeight = 0;  // Slot dimensions (container size)
        
        if (settings.layoutEnabled) {
            const layoutMgr = getLayoutManager();
            if (layoutMgr.isEnabled()) {
                layoutConfig = layoutMgr.getViewerConfig(viewerId);
                if (layoutConfig) {
                    // Layout provides position and size in pixels
                    finalLeft = layoutConfig.left;
                    finalTop = layoutConfig.top;
                    slotWidth = layoutConfig.width;
                    slotHeight = layoutConfig.height;
                    
                    const fitMode = settings.layoutFitMode || 'classic';
                    
                    if (fitMode === 'classic') {
                        // Classic: normal viewer behavior, container matches image size
                        if (slotWidth / slotHeight > aspectRatio) {
                            finalHeight = slotHeight;
                            finalWidth = finalHeight * aspectRatio;
                        } else {
                            finalWidth = slotWidth;
                            finalHeight = finalWidth / aspectRatio;
                        }
                    } else if (fitMode === 'cover') {
                        // Cover: scale to cover entire slot, overflow clipped
                        if (slotWidth / slotHeight > aspectRatio) {
                            finalWidth = slotWidth;
                            finalHeight = finalWidth / aspectRatio;
                        } else {
                            finalHeight = slotHeight;
                            finalWidth = finalHeight * aspectRatio;
                        }
                    } else if (fitMode === 'contain') {
                        // Contain: fit within slot, maintain aspect ratio
                        if (slotWidth / slotHeight > aspectRatio) {
                            finalHeight = slotHeight;
                            finalWidth = finalHeight * aspectRatio;
                        } else {
                            finalWidth = slotWidth;
                            finalHeight = finalWidth / aspectRatio;
                        }
                    } else if (fitMode === 'stretch') {
                        // Stretch: distort to fill slot exactly
                        finalWidth = slotWidth;
                        finalHeight = slotHeight;
                    } else if (fitMode === 'center') {
                        // Center: original size centered in slot (scaled down if larger, maintains aspect ratio)
                        if (naturalWidth <= slotWidth && naturalHeight <= slotHeight) {
                            // Image fits within slot - use original size
                            finalWidth = naturalWidth;
                            finalHeight = naturalHeight;
                        } else {
                            // Image larger than slot - scale down to fit while maintaining aspect ratio
                            const scaleX = slotWidth / naturalWidth;
                            const scaleY = slotHeight / naturalHeight;
                            const scale = Math.min(scaleX, scaleY);
                            finalWidth = naturalWidth * scale;
                            finalHeight = naturalHeight * scale;
                        }
                    }
                    
                    usingLayoutSlot = (fitMode !== 'classic');
                    usedSavedState = true;
                }
            }
        }
        
        // Determine which saved state to use (only if no layout config)
        if (!usedSavedState && settings.rememberPosition) {
            if (settings.rememberLayout) {
                // Layout mode: use viewerId-specific position
                const savedPos = getLayoutPosition(viewerId);
                if (savedPos) {
                    applySavedState(savedPos);
                }
            } else if (activeViewers.length === 0) {
                // Single-state mode: only first viewer uses saved position
                const savedState = getViewerState();
                if (savedState) {
                    applySavedState(savedState);
                }
            }
        }
        
        // Default position if no saved state (offset based on active count)
        if (!usedSavedState) {
            finalWidth = width;
            finalHeight = height;
            const offset = activeViewers.length * 20;
            finalLeft = (window.innerWidth - width) / 2 + offset;
            finalTop = (window.innerHeight - height) / 2 + offset;
        }
        
        // Set image and container size
        imgEl.attr('src', imageSrc);
        // Ensure draggable is false to prevent native browser drag (Firefox fix)
        imgEl.attr('draggable', 'false');
        imgEl[0].ondragstart = () => false;
        
        if (usingLayoutSlot) {
            const fitMode = settings.layoutFitMode || 'classic';
            
            // For non-classic modes: container AND window fill the entire slot
            // The image uses CSS object-fit for proper scaling
            containerEl.css({ 
                width: slotWidth + 'px', 
                height: slotHeight + 'px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            });
            
            // Apply the appropriate object-fit style based on mode
            if (fitMode === 'cover') {
                // Cover: fill entire slot, crop overflow
                imgEl.css({ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover'
                });
            } else if (fitMode === 'contain') {
                // Contain: fit within slot, maintain aspect ratio (letterboxing)
                imgEl.css({ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain'
                });
            } else if (fitMode === 'stretch') {
                // Stretch: distort to fill slot exactly
                imgEl.css({ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'fill'
                });
            } else if (fitMode === 'center') {
                // Center: original size (capped by slot), centered
                imgEl.css({ 
                    width: finalWidth + 'px', 
                    height: finalHeight + 'px',
                    objectFit: 'none'
                });
            }
            
            // Set window size to match slot for non-classic modes
            windowEl.css({ 
                width: slotWidth + 'px', 
                height: slotHeight + 'px'
            });
        } else {
            // Normal mode (classic or no layout): container matches image size
            imgEl.css({ width: finalWidth + 'px', height: finalHeight + 'px' });
            containerEl.css({ width: finalWidth + 'px', height: finalHeight + 'px' });
        }
        
        // Position window
        windowEl.css({ left: finalLeft + 'px', top: finalTop + 'px', display: 'block' });
        
        // Apply z-index from layout if available
        if (layoutConfig && layoutConfig.zIndex) {
            windowEl.css('z-index', layoutConfig.zIndex);
        }
        
        // ===== ZOOM STATE =====
        let zoomLevel = 100;
        let panX = 0, panY = 0;
        
        // Calculate max pan based on overflow (in screen pixels)
        function getMaxPan() {
            const scale = zoomLevel / 100;
            const containerWidth = containerEl.width();
            const containerHeight = containerEl.height();
            
            // At scale S, image is S times larger. Overflow is the extra on each side.
            const overflowX = containerWidth * (scale - 1) / 2;
            const overflowY = containerHeight * (scale - 1) / 2;
            return { maxPanX: overflowX, maxPanY: overflowY };
        }
        
        function clampPan() {
            if (settings.freePan) return;
            const { maxPanX, maxPanY } = getMaxPan();
            panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
            panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
        }
        
        function updateTransform() {
            const scale = zoomLevel / 100;
            // Scale first from center, then translate (pan is in screen pixels)
            imgEl.css('transform', `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`);
            imgEl.css('transform-origin', 'center center');
            containerEl.toggleClass('fv-zoomed', zoomLevel > 100);
        }
        
        // ===== ZOOM HANDLERS =====
        if (settings.enableZoom) {
            const handleWheel = (e) => {
                e.preventDefault();
                
                const oldZoom = zoomLevel;
                const delta = e.deltaY > 0 ? -10 : 10;
                zoomLevel = Math.max(100, Math.min(settings.maxZoom, zoomLevel + delta));
                
                if (zoomLevel !== oldZoom && zoomLevel > 100) {
                    // Zoom toward cursor position
                    const rect = containerEl[0].getBoundingClientRect();
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const mouseX = e.clientX - rect.left - centerX;
                    const mouseY = e.clientY - rect.top - centerY;
                    
                    // Scale the pan to maintain cursor position
                    const zoomRatio = zoomLevel / oldZoom;
                    panX = panX * zoomRatio + mouseX * (zoomRatio - 1);
                    panY = panY * zoomRatio + mouseY * (zoomRatio - 1);
                } else if (zoomLevel === 100) {
                    panX = 0;
                    panY = 0;
                }
                
                clampPan();
                updateTransform();
            };
            containerEl[0].addEventListener('wheel', handleWheel, { passive: false });
            cleanupFns.push(() => containerEl[0].removeEventListener('wheel', handleWheel));
        }
        
        // ===== DRAG/PAN/PINCH HANDLERS =====
        const isTouch = isTouchDevice();
        let isDragging = false;
        let isPanning = false;
        let isPinching = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let initialPanX = 0, initialPanY = 0;
        let initialPinchDistance = 0;
        let initialPinchZoom = 100;
        let initialPinchCenter = { x: 0, y: 0 };
        
        // Calculate distance between two touch points
        const getPinchDistance = (touches) => {
            const dx = touches[1].clientX - touches[0].clientX;
            const dy = touches[1].clientY - touches[0].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };
        
        // Get center point between two touches
        const getPinchCenter = (touches) => ({
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        });
        
        // Check if new position would overlap with other viewers
        const wouldOverlap = (newLeft, newTop) => {
            const width = windowEl.outerWidth();
            const height = windowEl.outerHeight();
            const newRect = {
                left: newLeft,
                top: newTop,
                right: newLeft + width,
                bottom: newTop + height
            };
            
            for (const viewer of activeViewers) {
                // Skip self (viewerData not created yet, compare by DOM element)
                if (viewer.windowEl && viewer.windowEl[0] === windowEl[0]) continue;
                
                const rect = viewer.windowEl[0].getBoundingClientRect();
                // Check for overlap
                if (!(newRect.right < rect.left || 
                      newRect.left > rect.right || 
                      newRect.bottom < rect.top || 
                      newRect.top > rect.bottom)) {
                    return true; // Overlap detected
                }
            }
            return false;
        };
        
        const handleDragStart = (e) => {
            if (e.target.closest('.fv-close') || e.target.closest('.fv-resize-handle') || e.target.closest('.fv-lock')) return;
            
            // Prevent default to stop Firefox from initiating native image drag
            e.preventDefault();
            
            // If locked, prevent dragging (but still allow zoom/pan)
            const currentlyLocked = isViewerLocked(viewerId);
            
            focusedViewer = viewerData;
            
            // Pinch-to-zoom with two fingers (always allowed, even when locked)
            if (e.touches && e.touches.length >= 2 && settings.enableZoom) {
                isPinching = true;
                isDragging = false;
                isPanning = false;
                initialPinchDistance = getPinchDistance(e.touches);
                initialPinchZoom = zoomLevel;
                initialPinchCenter = getPinchCenter(e.touches);
                initialPanX = panX;
                initialPanY = panY;
                // Optimize for pinch animation
                imgEl.css('will-change', 'transform');
                return;
            }
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            startX = clientX;
            startY = clientY;
            
            if (zoomLevel > 100 && settings.enableZoom) {
                // Panning within zoomed image (allowed even when locked)
                isPanning = true;
                initialPanX = panX;
                initialPanY = panY;
                containerEl.addClass('fv-panning');
            } else if (!currentlyLocked) {
                // Only allow dragging if NOT locked
                isDragging = true;
                initialLeft = parseInt(windowEl.css('left')) || 0;
                initialTop = parseInt(windowEl.css('top')) || 0;
                // Enable performance mode (disables box-shadow)
                windowEl.addClass('fv-dragging');
            }
            
            if (isTouch && resizeHandle.length) {
                resizeHandle.css('opacity', '1');
            }
        };
        
        const handleDragMove = (e) => {
            // Handle pinch-to-zoom
            if (isPinching && e.touches && e.touches.length >= 2) {
                if (e.cancelable) e.preventDefault();
                
                const currentDistance = getPinchDistance(e.touches);
                const scale = currentDistance / initialPinchDistance;
                const newZoom = Math.max(100, Math.min(settings.maxZoom, initialPinchZoom * scale));
                
                if (newZoom !== zoomLevel) {
                    const oldZoom = zoomLevel;
                    zoomLevel = newZoom;
                    
                    // Zoom toward pinch center
                    if (zoomLevel > 100) {
                        const rect = containerEl[0].getBoundingClientRect();
                        const centerX = rect.width / 2;
                        const centerY = rect.height / 2;
                        const currentCenter = getPinchCenter(e.touches);
                        const pinchX = currentCenter.x - rect.left - centerX;
                        const pinchY = currentCenter.y - rect.top - centerY;
                        
                        const zoomRatio = zoomLevel / oldZoom;
                        panX = initialPanX * zoomRatio + pinchX * (zoomRatio - 1);
                        panY = initialPanY * zoomRatio + pinchY * (zoomRatio - 1);
                    } else {
                        panX = 0;
                        panY = 0;
                    }
                    
                    clampPan();
                    updateTransform();
                }
                return;
            }
            
            if (!isDragging && !isPanning) return;
            if (e.cancelable) e.preventDefault();
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            if (isPanning) {
                // Pan values are in screen pixels, so drag 1:1
                panX = initialPanX + deltaX;
                panY = initialPanY + deltaY;
                
                clampPan();
                updateTransform();
            } else {
                // Update left/top directly during drag
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                // Use actual element dimensions for bounds (works for both normal and minimized)
                const maxLeft = window.innerWidth - windowEl.outerWidth();
                const maxTop = window.innerHeight - windowEl.outerHeight();
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));
                
                // Prevent overlap with other viewers if enabled
                if (settings.preventOverlap && !wouldOverlap(newLeft, newTop)) {
                    windowEl[0].style.left = newLeft + 'px';
                    windowEl[0].style.top = newTop + 'px';
                } else if (!settings.preventOverlap) {
                    windowEl[0].style.left = newLeft + 'px';
                    windowEl[0].style.top = newTop + 'px';
                }
                // If overlap detected and prevention enabled, don't update position
            }
        };
        
        const handleDragEnd = () => {
            if (isPinching) {
                isPinching = false;
                initialPanX = panX;
                initialPanY = panY;
                imgEl.css('will-change', 'auto');
            }
            
            // Exit performance mode (restore box-shadow)
            if (isDragging) {
                windowEl.removeClass('fv-dragging');
            }
            
            isDragging = false;
            if (isPanning) {
                isPanning = false;
                containerEl.removeClass('fv-panning');
            }
            if (isTouch && resizeHandle.length) {
                setTimeout(() => resizeHandle.css('opacity', '0'), 1500);
            }
        };
        
        // (Touch button visibility is now handled purely by CSS)
        
        // Attach drag handlers
        if (isTouch) {
            containerEl[0].addEventListener('touchstart', handleDragStart, { passive: false });
            containerEl[0].addEventListener('touchmove', handleDragMove, { passive: false });
            containerEl[0].addEventListener('touchend', handleDragEnd, { passive: true });
            windowEl.addClass('touch-device');
            resizeHandle.css('display', 'flex');
        } else {
            containerEl[0].addEventListener('mousedown', handleDragStart);
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
            cleanupFns.push(() => {
                document.removeEventListener('mousemove', handleDragMove);
                document.removeEventListener('mouseup', handleDragEnd);
            });
        }
        
        // ===== RESIZE (Desktop only - jQuery UI) =====
        // Skip resize in layout slot mode - layout defines fixed sizes
        if (!isTouch && !usingLayoutSlot) {
            // Check if jQuery UI resizable is available (defensive check for Firefox)
            if (typeof $.fn.resizable !== 'function') {
                console.warn(`[${extensionName}] jQuery UI resizable not available`);
            } else {
            try {
            windowEl.resizable({
                handles: 'n, e, s, w, ne, se, sw, nw',
                minHeight: 100,
                minWidth: 100,
                maxHeight: naturalHeight,
                maxWidth: naturalWidth,
                aspectRatio: aspectRatio,
                resize: function(event, ui) {
                    imgEl.css({ width: ui.size.width + 'px', height: ui.size.height + 'px' });
                    containerEl.css({ width: ui.size.width + 'px', height: ui.size.height + 'px' });
                    // Reset zoom on resize
                    zoomLevel = 100;
                    panX = 0;
                    panY = 0;
                    updateTransform();
                }
            });
            } catch (err) {
                console.warn(`[${extensionName}] jQuery UI resizable initialization failed:`, err);
            }
            }
        }
        
        // ===== TOUCH RESIZE HANDLER =====
        // Skip resize in layout slot mode - layout defines fixed sizes
        if (isTouch && resizeHandle.length && !usingLayoutSlot) {
            let isResizing = false;
            let resizeStartX = 0, resizeStartY = 0;
            let initialWidth = 0, initialHeight = 0;
            
            const handleResizeStart = (e) => {
                e.stopPropagation();
                isResizing = true;
                const touch = e.touches[0];
                resizeStartX = touch.clientX;
                resizeStartY = touch.clientY;
                initialWidth = imgEl.width();
                initialHeight = imgEl.height();
                resizeHandle.css('opacity', '1');
            };
            
            const handleResizeMove = (e) => {
                if (!isResizing) return;
                e.preventDefault();
                e.stopPropagation();
                
                const touch = e.touches[0];
                const delta = Math.max(touch.clientX - resizeStartX, touch.clientY - resizeStartY);
                
                let newWidth = Math.max(100, Math.min(initialWidth + delta, naturalWidth));
                let newHeight = newWidth / aspectRatio;
                
                imgEl.css({ width: newWidth + 'px', height: newHeight + 'px' });
                containerEl.css({ width: newWidth + 'px', height: newHeight + 'px' });
            };
            
            const handleResizeEnd = () => {
                isResizing = false;
                setTimeout(() => resizeHandle.css('opacity', '0'), 1500);
            };
            
            resizeHandle[0].addEventListener('touchstart', handleResizeStart, { passive: true });
            resizeHandle[0].addEventListener('touchmove', handleResizeMove, { passive: false });
            resizeHandle[0].addEventListener('touchend', handleResizeEnd, { passive: true });
        }
        
        // Create viewer data object
        const viewerData = {
            windowEl,
            imgEl,
            viewerId,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
        
        activeViewers.push(viewerData);
        focusedViewer = viewerData;
        
        // Close button
        closeBtn.on('click touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeViewer(viewerData);
            return false;
        });
        
        // Lock button - uses CSS class toggle for SVG icon state
        const lockBtn = windowEl.find('.fv-lock');
        let isLocked = isViewerLocked(viewerId);
        
        // Initialize lock state from storage
        if (isLocked) {
            lockBtn.addClass('fv-locked');
            lockBtn.attr('title', 'Unlock position');
        }
        
        lockBtn.on('click touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isLocked = !isLocked;
            setViewerLocked(viewerId, isLocked);
            
            // Toggle class - CSS handles icon visibility
            lockBtn.toggleClass('fv-locked', isLocked);
            lockBtn.attr('title', isLocked ? 'Unlock position' : 'Lock position');
            return false;
        });
        
        // Minimize button - toggle between full view and circular thumbnail
        const minimizeBtn = windowEl.find('.fv-minimize');
        let isMinimized = false;
        let originalDimensions = null;
        
        minimizeBtn.on('click touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isMinimized) {
                // Restore to original size
                windowEl.removeClass('fv-minimized');
                minimizeBtn.removeClass('fv-minimized-active');
                if (originalDimensions) {
                    imgEl.css({
                        width: originalDimensions.width + 'px',
                        height: originalDimensions.height + 'px'
                    });
                    containerEl.css({
                        width: originalDimensions.width + 'px',
                        height: originalDimensions.height + 'px'
                    });
                    
                    // Check if restored viewer would be off-screen and adjust
                    const currentLeft = parseInt(windowEl.css('left')) || 0;
                    const currentTop = parseInt(windowEl.css('top')) || 0;
                    const restoredWidth = originalDimensions.width;
                    const restoredHeight = originalDimensions.height;
                    
                    let newLeft = currentLeft;
                    let newTop = currentTop;
                    
                    // If going off right edge, expand to left
                    if (currentLeft + restoredWidth > window.innerWidth) {
                        newLeft = Math.max(0, window.innerWidth - restoredWidth);
                    }
                    // If going off bottom edge, expand upward
                    if (currentTop + restoredHeight > window.innerHeight) {
                        newTop = Math.max(0, window.innerHeight - restoredHeight);
                    }
                    
                    if (newLeft !== currentLeft || newTop !== currentTop) {
                        windowEl.css({ left: newLeft + 'px', top: newTop + 'px' });
                    }
                }
                minimizeBtn.attr('title', 'Minimize');
            } else {
                // Save current dimensions and minimize
                originalDimensions = {
                    width: imgEl.width(),
                    height: imgEl.height()
                };
                windowEl.addClass('fv-minimized');
                minimizeBtn.addClass('fv-minimized-active');
                minimizeBtn.attr('title', 'Restore');
            }
            
            isMinimized = !isMinimized;
            return false;
        });
        
        // Click on minimized bubble to restore (not drag)
        // Use mouseup/touchend with distance check to distinguish from drag
        let minimizedClickStart = null;
        
        containerEl.on('mousedown touchstart', (e) => {
            if (isMinimized) {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                minimizedClickStart = { x: clientX, y: clientY };
            }
        });
        
        containerEl.on('mouseup touchend', (e) => {
            if (isMinimized && minimizedClickStart) {
                const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
                const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
                const dx = Math.abs(clientX - minimizedClickStart.x);
                const dy = Math.abs(clientY - minimizedClickStart.y);
                
                // If barely moved, treat as click to restore
                if (dx < 10 && dy < 10) {
                    minimizeBtn.trigger('click');
                }
            }
            minimizedClickStart = null;
        });
        
        // Ensure keyboard listener is active
        ensureKeyboardListener();
        
        // Focus on click
        windowEl.on('mousedown touchstart', () => {
            focusedViewer = viewerData;
        });
    };
    
    tempImg.onerror = () => {
        console.error(`[${extensionName}] Failed to load image: ${imageSrc}`);
        windowEl.remove();
    };
    
    tempImg.src = imageSrc;
}

// Store observer reference for cleanup
let domObserver = null;

// Debounce mechanism using microtask queue
let pendingNodes = [];
let processingScheduled = false;

function scheduleProcessing() {
    if (processingScheduled) return;
    processingScheduled = true;
    
    // Use queueMicrotask for efficient batching without delay
    queueMicrotask(() => {
        processPendingNodes();
        processingScheduled = false;
    });
}

function processPendingNodes() {
    const settings = extension_settings[extensionName];
    if (!settings?.enabled) {
        pendingNodes = [];
        return;
    }
    
    const nodesToProcess = pendingNodes;
    pendingNodes = [];
    
    for (const node of nodesToProcess) {
        // Skip non-element nodes early
        if (!(node instanceof HTMLElement) || !node.classList) continue;
        
        // Check for zoomed avatar (chat avatar viewer)
        if (node.classList.contains('zoomed_avatar')) {
            if (!settings.interceptAvatars) continue;
            
            const img = node.querySelector('.zoomed_avatar_img');
            if (img?.src) {
                node.remove();
                openEnhancedGallery(img.src);
            }
            continue;
        }
        
        // Check for gallery image popup
        if (node.classList.contains('galleryImageDraggable')) {
            if (!settings.interceptGallery) continue;
            
            const img = node.querySelector('img');
            if (img?.src) {
                node.remove();
                openEnhancedGallery(img.src);
            }
        }
    }
}

// Single optimized MutationObserver for both avatar and gallery interception
function initializeObserver() {
    if (domObserver) {
        domObserver.disconnect();
    }
    
    domObserver = new MutationObserver((mutations) => {
        // Quick check if extension is enabled before processing
        if (!extension_settings[extensionName]?.enabled) return;
        
        for (const mutation of mutations) {
            if (mutation.addedNodes.length === 0) continue;
            
            for (const node of mutation.addedNodes) {
                // Fast filter: only process element nodes with classList
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                
                // Only queue nodes that might be relevant (have classList with target classes)
                const classList = node.classList;
                if (classList && (classList.contains('zoomed_avatar') || classList.contains('galleryImageDraggable'))) {
                    pendingNodes.push(node);
                }
            }
        }
        
        if (pendingNodes.length > 0) {
            scheduleProcessing();
        }
    });
    
    // Observe document body with optimized options
    domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

// Initialize extension
async function initializeExtension() {
    console.log(`[${extensionName}] Initializing...`);
   
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);
        
        const galleryHtml = await $.get(`${extensionFolderPath}/gallery.html`);
        $("body").append(galleryHtml);
        
        loadSettings();
        initializeObserver();
        
        // Bind settings changes
        $("#floating_viewer_enable").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] ${extension_settings[extensionName].enabled ? "Enabled" : "Disabled"}`);
        });
        
        $("#floating_viewer_intercept_avatars").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Avatar interception: ${extension_settings[extensionName].interceptAvatars ? "ON" : "OFF"}`);
        });
        
        $("#floating_viewer_intercept_gallery").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Gallery interception: ${extension_settings[extensionName].interceptGallery ? "ON" : "OFF"}`);
        });
        
        // Default size input
        $("#floating_viewer_default_size").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Default size: ${extension_settings[extensionName].defaultSize}%`);
        });
        
        // Remember position checkbox
        $("#floating_viewer_remember_position").on("change", function() {
            saveSettings();
            updateDefaultSizeState();
            if (!extension_settings[extensionName].rememberPosition) {
                clearLayoutState();
            }
            console.log(`[${extensionName}] Remember position: ${extension_settings[extensionName].rememberPosition ? "ON" : "OFF"}`);
        });
        
        // Remember layout checkbox
        $("#floating_viewer_remember_layout").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Remember layout: ${extension_settings[extensionName].rememberLayout ? "ON" : "OFF"}`);
        });
        
        // Clear saved positions button
        $("#floating_viewer_clear_layout").on("click", function() {
            const settings = extension_settings[extensionName];
            
            // First, save positions of LOCKED viewers so they persist after clear
            activeViewers.forEach(viewer => {
                if (isViewerLocked(viewer.viewerId)) {
                    const imgEl = viewer.windowEl.find('.fv-image');
                    const currentLeft = parseInt(viewer.windowEl.css('left')) || 0;
                    const currentTop = parseInt(viewer.windowEl.css('top')) || 0;
                    saveLayoutPosition(viewer.viewerId, currentLeft, currentTop, imgEl.width(), imgEl.height());
                }
            });
            
            // Temporarily disable saving, close all viewers
            const wasRememberEnabled = settings.rememberPosition;
            settings.rememberPosition = false;
            closeAllViewers();
            settings.rememberPosition = wasRememberEnabled;
            
            // Clear unlocked positions (locked ones preserved by clearLayoutState)
            clearLayoutState();
            toastr.success("Saved positions cleared", "Floating Viewer");
            console.log(`[${extensionName}] Cleared saved positions`);
        });
        
        // Zoom settings
        $("#floating_viewer_enable_zoom").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Zoom: ${extension_settings[extensionName].enableZoom ? "ON" : "OFF"}`);
        });
        
        $("#floating_viewer_max_zoom").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Max zoom: ${extension_settings[extensionName].maxZoom}%`);
        });
        
        $("#floating_viewer_free_pan").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Free pan: ${extension_settings[extensionName].freePan ? "ON" : "OFF"}`);
        });
        
        // Multi-image settings
        $("#floating_viewer_multi_image").on("change", function() {
            saveSettings();
            updateMultiImageState();
            if (!extension_settings[extensionName].multiImage) {
                // Close all but one viewer when disabling
                while (activeViewers.length > 1) {
                    closeViewer(activeViewers[0], false);
                }
            }
            console.log(`[${extensionName}] Multi-image: ${extension_settings[extensionName].multiImage ? "ON" : "OFF"}`);
        });
        
        $("#floating_viewer_max_instances").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Max instances: ${extension_settings[extensionName].maxInstances}`);
        });
        
        // Layout system settings
        $("#floating_viewer_layout_enabled").on("change", function() {
            saveSettings();
            updateLayoutState();
            console.log(`[${extensionName}] Layout system: ${extension_settings[extensionName].layoutEnabled ? "ON" : "OFF"}`);
        });
        
        $("#floating_viewer_active_layout").on("change", function() {
            const layoutId = $(this).val() || null;
            getLayoutManager().setActiveLayout(layoutId);
            console.log(`[${extensionName}] Active layout: ${layoutId || "None"}`);
        });
        
        $("#floating_viewer_fit_mode").on("change", function() {
            saveSettings();
            console.log(`[${extensionName}] Fit mode: ${extension_settings[extensionName].layoutFitMode}`);
        });
        
        $("#floating_viewer_open_builder").on("click", function() {
            openLayoutBuilder();
        });
        
        // Initialize panel observer for z-index management
        initPanelObserver();
       
        console.log(`[${extensionName}] Loaded successfully`);
        
    } catch (error) {
        console.error(`[${extensionName}] Failed to load:`, error);
        toastr.error("Failed to load Floating Viewer. Check console for details.", "Floating Viewer");
    }
}

// Wait for SillyTavern to initialize
jQuery(() => {
    setTimeout(initializeExtension, 1000);
});