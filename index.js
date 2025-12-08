import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

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
    // Extract path from URL and remove the filename (index.js)
    const pathMatch = scriptUrl.match(/^.*\/extensions\/(.*)\/index\.js/);
    if (pathMatch) {
        return `extensions/${pathMatch[1]}`;
    }
    // Fallback to third-party path if detection fails
    return `scripts/extensions/third-party/${extensionName}`;
})();

const defaultSettings = { 
    enabled: true,
    interceptAvatars: true,
    interceptGallery: true
};

function loadSettings() {
    if (!extension_settings[extensionName]) extension_settings[extensionName] = {};
    
    // Merge defaults with existing settings
    extension_settings[extensionName] = Object.assign({}, defaultSettings, extension_settings[extensionName]);
    
    // Update UI
    $("#floating_viewer_enable").prop("checked", extension_settings[extensionName].enabled);
    $("#floating_viewer_intercept_avatars").prop("checked", extension_settings[extensionName].interceptAvatars);
    $("#floating_viewer_intercept_gallery").prop("checked", extension_settings[extensionName].interceptGallery);
}

function saveSettings() {
    extension_settings[extensionName].enabled = $("#floating_viewer_enable").prop("checked");
    extension_settings[extensionName].interceptAvatars = $("#floating_viewer_intercept_avatars").prop("checked");
    extension_settings[extensionName].interceptGallery = $("#floating_viewer_intercept_gallery").prop("checked");
    saveSettingsDebounced();
}

// Detect if PRIMARY input is touch (not just touch support)
// This prevents breaking on PCs that have touch screens but primarily use mouse
const isTouchDevice = () => {
    // Use CSS media query for primary pointer type (most reliable)
    if (window.matchMedia) {
        return window.matchMedia('(pointer: coarse)').matches;
    }
    // Fallback for older browsers
    return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
};

function openEnhancedGallery(imageSrc) {
    const windowEl = $("#floating-viewer-window");
    const imgEl = $("#gallery-image");
    
    if (windowEl.length === 0 || imgEl.length === 0) {
        console.error(`[${extensionName}] Gallery elements not found`);
        return;
    }

    // Hide window first to prevent premature appearance
    windowEl.hide();
    
    // Load image to get natural dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
        let width = tempImg.naturalWidth;
        let height = tempImg.naturalHeight;
        const aspectRatio = width / height;
        
        // Use larger viewport percentage on mobile for better visibility
        const isTouch = isTouchDevice();
        const viewportPercent = isTouch ? 0.85 : 0.6;
        const maxWidth = window.innerWidth * viewportPercent;
        const maxHeight = window.innerHeight * viewportPercent;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }
        
        // Set image size and make it visible
        imgEl.css({
            display: 'block',
            width: Math.round(width) + 'px',
            height: Math.round(height) + 'px'
        });
        
        imgEl.attr("src", imageSrc);
        
        // Prevent native browser drag (Firefox compatibility)
        imgEl[0].ondragstart = function() { return false; };
        
        // Destroy previous jQuery UI instances if they exist (with safe cleanup)
        try {
            if (windowEl.hasClass('ui-draggable')) {
                windowEl.draggable('destroy');
            }
        } catch (e) { /* Widget already destroyed or not initialized */ }
        
        try {
            if (windowEl.hasClass('ui-resizable')) {
                windowEl.resizable('destroy');
            }
        } catch (e) { /* Widget already destroyed or not initialized */ }
        
        // Remove any previous touch handlers
        const windowDom = windowEl[0];
        const imgDom = imgEl[0];
        windowDom._touchHandlersActive = false;
        
        // Store natural dimensions for resize constraints
        const naturalWidth = tempImg.naturalWidth;
        const naturalHeight = tempImg.naturalHeight;
        
        if (isTouch) {
            // === MOBILE: Use native touch events for dragging and resizing ===
            let isDragging = false;
            let isResizing = false;
            let startX = 0, startY = 0;
            let initialLeft = 0, initialTop = 0;
            let initialWidth = 0, initialHeight = 0;
            
            // Get resize handle reference
            const resizeHandle = document.getElementById('gallery-resize-handle');
            
            // Helper to show/hide resize handle with animation
            const showResizeHandle = () => {
                if (resizeHandle) resizeHandle.style.opacity = '1';
            };
            const hideResizeHandle = () => {
                if (resizeHandle && !isResizing) resizeHandle.style.opacity = '0';
            };
            
            // --- DRAG HANDLERS ---
            const handleTouchStart = (e) => {
                // Don't drag if touching close button or resize handle
                if (e.target.id === 'gallery-close' || e.target.id === 'gallery-resize-handle' || e.target.closest('#gallery-resize-handle')) return;
                
                isDragging = true;
                showResizeHandle(); // Show handle when touching image
                
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                initialLeft = parseInt(windowEl.css('left')) || 0;
                initialTop = parseInt(windowEl.css('top')) || 0;
            };
            
            const handleTouchMove = (e) => {
                if (!isDragging) return;
                e.preventDefault(); // Prevent scrolling while dragging
                
                const touch = e.touches[0];
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                // Calculate new position with boundary constraints
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                // Keep within viewport
                const maxLeft = window.innerWidth - windowEl.outerWidth();
                const maxTop = window.innerHeight - windowEl.outerHeight();
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));
                
                windowEl.css({ left: newLeft + 'px', top: newTop + 'px' });
            };
            
            const handleTouchEnd = () => {
                isDragging = false;
                // Hide handle after a short delay (allows user to see it and tap it)
                setTimeout(hideResizeHandle, 1500);
            };
            
            // --- RESIZE HANDLERS ---
            const handleResizeStart = (e) => {
                e.stopPropagation();
                isResizing = true;
                showResizeHandle(); // Keep visible while resizing
                
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                initialWidth = imgEl.width();
                initialHeight = imgEl.height();
            };
            
            const handleResizeMove = (e) => {
                if (!isResizing) return;
                e.preventDefault();
                e.stopPropagation();
                
                const touch = e.touches[0];
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                // Use the larger delta to maintain aspect ratio
                const delta = Math.max(deltaX, deltaY);
                
                // Calculate new size maintaining aspect ratio
                let newWidth = initialWidth + delta;
                let newHeight = newWidth / aspectRatio;
                
                // Constrain to min/max sizes
                const minSize = 100;
                newWidth = Math.max(minSize, Math.min(newWidth, naturalWidth));
                newHeight = Math.max(minSize / aspectRatio, Math.min(newHeight, naturalHeight));
                
                // Ensure aspect ratio is maintained after constraints
                if (newWidth / newHeight !== aspectRatio) {
                    if (newWidth === naturalWidth) {
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newWidth = newHeight * aspectRatio;
                    }
                }
                
                imgEl.css({
                    width: Math.round(newWidth) + 'px',
                    height: Math.round(newHeight) + 'px'
                });
            };
            
            const handleResizeEnd = () => {
                isResizing = false;
                // Hide handle after resize ends
                setTimeout(hideResizeHandle, 1500);
            };
            
            // Attach touch handlers to the image for dragging
            imgDom.addEventListener('touchstart', handleTouchStart, { passive: true });
            imgDom.addEventListener('touchmove', handleTouchMove, { passive: false });
            imgDom.addEventListener('touchend', handleTouchEnd, { passive: true });
            
            // Attach touch handlers to resize handle
            if (resizeHandle) {
                resizeHandle.addEventListener('touchstart', handleResizeStart, { passive: true });
                resizeHandle.addEventListener('touchmove', handleResizeMove, { passive: false });
                resizeHandle.addEventListener('touchend', handleResizeEnd, { passive: true });
                // Enable the resize handle on mobile (but keep opacity 0 until touched)
                resizeHandle.style.display = 'flex';
            }
            
            // Mark that touch handlers are active (for potential cleanup)
            windowDom._touchHandlersActive = true;
            
            // Add touch-device class for CSS targeting
            windowEl.addClass('touch-device');
            
        } else {
            // === DESKTOP: Use jQuery UI for mouse-based dragging and resizing ===
            windowEl.removeClass('touch-device');
            
            // Hide mobile resize handle on desktop
            const resizeHandle = document.getElementById('gallery-resize-handle');
            if (resizeHandle) resizeHandle.style.display = 'none';
            
            windowEl.draggable({ 
                handle: "#gallery-image",
                containment: "window",
                scroll: false
            });
            
            windowEl.resizable({ 
                handles: "n, e, s, w, ne, se, sw, nw", 
                minHeight: 100, 
                minWidth: 100,
                maxHeight: tempImg.naturalHeight,
                maxWidth: tempImg.naturalWidth,
                aspectRatio: aspectRatio,
                resize: function(event, ui) {
                    imgEl.css({
                        width: ui.size.width + 'px',
                        height: ui.size.height + 'px'
                    });
                }
            });
        }
        
        // Close function (used by both button and tap-outside)
        const closeGallery = () => {
            imgEl.hide();
            windowEl.fadeOut(200, function() {
                windowEl.css({ left: '-9999px', top: '-9999px' });
            });
        };
        
        // Bind close button (works for both click and touch)
        $("#gallery-close").off("click touchend").on("click touchend", function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            closeGallery();
            return false;
        });
        
        // Center the window and show it
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        windowEl.css({ left: left + 'px', top: top + 'px' });
        windowEl.fadeIn(200);
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