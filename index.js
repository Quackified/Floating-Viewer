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
    maxInstances: 5   // Max simultaneous windows (1-10)
};

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
    
    // Gray out default size when remember position is enabled
    updateDefaultSizeState();
    updateMultiImageState();
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

function openEnhancedGallery(imageSrc) {
    const settings = extension_settings[extensionName];
    
    // Check multi-image settings
    if (!settings.multiImage) {
        // Close existing viewers first
        closeAllViewers();
    } else {
        // Enforce max instances
        while (activeViewers.length >= settings.maxInstances) {
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
        
        // Determine which saved state to use
        if (settings.rememberPosition) {
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
        imgEl.css({ width: finalWidth + 'px', height: finalHeight + 'px' });
        containerEl.css({ width: finalWidth + 'px', height: finalHeight + 'px' });
        
        // Position window
        windowEl.css({ left: finalLeft + 'px', top: finalTop + 'px', display: 'block' });
        
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
        
        const handleDragStart = (e) => {
            if (e.target.closest('.fv-close') || e.target.closest('.fv-resize-handle') || e.target.closest('.fv-lock')) return;
            
            focusedViewer = viewerData;
            
            // Pinch-to-zoom with two fingers
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
                isPanning = true;
                initialPanX = panX;
                initialPanY = panY;
                containerEl.addClass('fv-panning');
            } else {
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
                // Update left/top directly during drag (legacy approach)
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                const maxLeft = window.innerWidth - windowEl.outerWidth();
                const maxTop = window.innerHeight - windowEl.outerHeight();
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));
                
                windowEl[0].style.left = newLeft + 'px';
                windowEl[0].style.top = newTop + 'px';
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
        
        // Touch auto-hide for buttons: show on touch, hide after delay
        let touchHideTimeout = null;
        const showButtonsOnTouch = () => {
            windowEl.addClass('fv-touched');
            if (touchHideTimeout) clearTimeout(touchHideTimeout);
            touchHideTimeout = setTimeout(() => {
                windowEl.removeClass('fv-touched');
            }, 2000); // Hide after 2 seconds of no touch
        };
        
        if (isTouch) {
            windowEl[0].addEventListener('touchstart', showButtonsOnTouch, { passive: true });
        }
        
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
        if (!isTouch) {
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
        }
        
        // ===== TOUCH RESIZE HANDLER =====
        if (isTouch && resizeHandle.length) {
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
        
        // Lock button
        const lockBtn = windowEl.find('.fv-lock');
        let isLocked = isViewerLocked(viewerId);
        
        // Initialize lock state from storage
        if (isLocked) {
            lockBtn.addClass('fv-locked');
            lockBtn.text('🔒');
            lockBtn.attr('title', 'Unlock position');
        }
        
        lockBtn.on('click touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isLocked = !isLocked;
            setViewerLocked(viewerId, isLocked);
            
            if (isLocked) {
                lockBtn.addClass('fv-locked');
                lockBtn.text('🔒');
                lockBtn.attr('title', 'Unlock position');
            } else {
                lockBtn.removeClass('fv-locked');
                lockBtn.text('🔓');
                lockBtn.attr('title', 'Lock position');
            }
            return false;
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