// ===== LAYOUT BUILDER UI =====
// Separated for maintainability - this file handles the visual layout builder interface

export class LayoutBuilderUI {
    constructor(manager, extensionFolderPath, extensionName) {
        this.manager = manager;
        this.extensionFolderPath = extensionFolderPath;
        this.extensionName = extensionName;
        this.builderEl = null;
        this.currentLayoutId = null;
        this.selectedSlotId = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.slotStartPos = { x: 0, y: 0 };
        this.slotStartSize = { width: 0, height: 0 };
        this.resizeDirection = null;
        this.currentDragSlotEl = null;
        this.currentDragSlotId = null;
    }
    
    // Open the builder UI
    async open() {
        if (this.builderEl) {
            this.builderEl.css('display', 'block');
            return;
        }
        
        try {
            const builderHtml = await $.get(`${this.extensionFolderPath}/layout-builder.html`);
            $("body").append(builderHtml);
            
            const template = document.getElementById('fv-layout-builder-template');
            if (!template) {
                console.error(`[${this.extensionName}] Layout builder template not found`);
                return;
            }
            
            const clone = template.content.cloneNode(true);
            this.builderEl = $(clone.querySelector('.fv-layout-builder'));
            $("body").append(this.builderEl);
            
            this.initializeBuilder();
            this.builderEl.css('display', 'block');
            
            console.log(`[${this.extensionName}] Layout Builder opened`);
        } catch (error) {
            console.error(`[${this.extensionName}] Failed to load layout builder:`, error);
            toastr.error("Failed to open Layout Builder", "Floating Viewer");
        }
    }
    
    close() {
        if (this.builderEl) {
            this.builderEl.css('display', 'none');
        }
        console.log(`[${this.extensionName}] Layout Builder closed`);
    }
    
    applyAndClose() {
        if (this.currentLayoutId) {
            this.manager.setActiveLayout(this.currentLayoutId);
            toastr.success('Layout applied!', 'Floating Viewer');
        }
        this.close();
    }
    
    initializeBuilder() {
        this.bindToolbarEvents();
        this.bindToolbarDrag();
        this.bindDocumentEvents();
        this.populateLayoutSelect();
        
        const layouts = this.manager.getLayoutList();
        if (layouts.length > 0) {
            this.loadLayout(layouts[0].id);
        } else {
            this.createNewLayout();
        }
    }
    
    bindToolbarEvents() {
        const toolbar = this.builderEl.find('.fv-builder-toolbar');
        
        // Clicking anywhere on the header collapses the toolbar
        toolbar.find('.fv-toolbar-header').on('click', () => {
            toolbar.toggleClass('fv-toolbar-collapsed');
        });
        
        toolbar.find('.fv-layout-select').on('change', (e) => {
            const layoutId = $(e.target).val();
            if (layoutId) {
                this.loadLayout(layoutId);
            }
            // If empty (Default), do nothing - user must use + button to create
        });
        
        toolbar.find('.fv-layout-new').on('click', () => this.createNewLayout());
        toolbar.find('.fv-layout-save').on('click', () => this.saveCurrentLayout());
        toolbar.find('.fv-layout-rename').on('click', () => this.renameLayout());
        toolbar.find('.fv-layout-delete').on('click', () => this.deleteCurrentLayout());
        
        toolbar.find('.fv-slot-select').on('change', (e) => {
            this.selectSlot(parseInt($(e.target).val()));
        });
        
        toolbar.find('.fv-slot-add').on('click', () => this.addSlot());
        toolbar.find('.fv-slot-remove').on('click', () => this.removeSelectedSlot());
        toolbar.find('.fv-slot-move-up').on('click', () => this.moveSlot(-1));
        toolbar.find('.fv-slot-move-down').on('click', () => this.moveSlot(1));
        
        toolbar.find('.fv-slot-x, .fv-slot-y, .fv-slot-width, .fv-slot-height, .fv-slot-zindex')
            .on('change', () => this.updateSlotFromInputs());
        
        toolbar.find('.fv-grid-show').on('change', (e) => {
            const show = $(e.target).prop('checked');
            this.builderEl.find('.fv-builder-grid').toggleClass('fv-grid-visible', show);
            this.updateLayoutGridSettings();
        });
        
        toolbar.find('.fv-grid-size').on('change', (e) => {
            const size = parseInt($(e.target).val()) || 20;
            this.builderEl.find('.fv-builder-grid').css('background-size', `${size}px ${size}px`);
            this.updateLayoutGridSettings();
        });
        
        toolbar.find('.fv-grid-snap').on('change', () => this.updateLayoutGridSettings());
        toolbar.find('.fv-snap-mode').on('change', () => this.updateLayoutGridSettings());
        toolbar.find('.fv-collision-prevent').on('change', () => this.updateLayoutCollisionSettings());
        
        toolbar.find('.fv-builder-apply').on('click', () => this.applyAndClose());
        toolbar.find('.fv-builder-cancel').on('click', () => this.close());
        
        toolbar.find('.fv-layout-name').on('change', (e) => {
            const name = $(e.target).val().trim();
            if (name && this.currentLayoutId) {
                this.manager.updateLayout(this.currentLayoutId, { name });
                this.populateLayoutSelect();
            }
        });
    }
    
    bindToolbarDrag() {
        // Toolbar is fixed at top-center, no dragging
    }
    
    bindDocumentEvents() {
        $(document).on('mousemove.slotDrag touchmove.slotDrag', (e) => {
            if (this.isDragging) this.handleSlotDrag(e);
            else if (this.isResizing) this.handleSlotResize(e);
        });
        $(document).on('mouseup.slotDrag touchend.slotDrag', () => {
            // Save final position at end of drag
            if (this.isDragging && this.currentDragSlotEl && this.currentDragSlotId) {
                const left = parseFloat(this.currentDragSlotEl.css('left'));
                const top = parseFloat(this.currentDragSlotEl.css('top'));
                // Convert from px to % if needed, or read from current values
                const x = parseFloat(this.builderEl.find('.fv-slot-x').val()) || 0;
                const y = parseFloat(this.builderEl.find('.fv-slot-y').val()) || 0;
                this.manager.updateSlot(this.currentLayoutId, this.currentDragSlotId, {
                    position: { x, y }
                });
            }
            this.isDragging = false;
            this.isResizing = false;
            this.currentDragSlotEl = null;
            this.currentDragSlotId = null;
        });
    }
    
    populateLayoutSelect() {
        const layouts = this.manager.getLayoutList();
        const select = this.builderEl.find('.fv-layout-select');
        select.empty(); // Clear all options
        layouts.forEach(layout => {
            const option = $('<option></option>').val(layout.id).text(layout.name);
            if (layout.id === this.currentLayoutId) option.prop('selected', true);
            select.append(option);
        });
    }
    
    createNewLayout() {
        const existingCount = this.manager.getLayoutList().length;
        const name = existingCount === 0 ? 'Default' : 'Layout ' + (existingCount + 1);
        const layoutId = this.manager.createLayout(name);
        this.loadLayout(layoutId);
        this.populateLayoutSelect();
        // Name row stays hidden - user can click rename button if they want to change it
    }
    
    loadLayout(layoutId) {
        const layout = this.manager.getLayout(layoutId);
        if (!layout) return;
        
        this.currentLayoutId = layoutId;
        this.builderEl.find('.fv-layout-select').val(layoutId);
        this.builderEl.find('.fv-layout-name').val(layout.name);
        this.builderEl.find('.fv-layout-name-row').css('display', 'none');
        
        this.builderEl.find('.fv-grid-show').prop('checked', layout.gridSettings?.enabled || false);
        this.builderEl.find('.fv-grid-size').val(layout.gridSettings?.size || 20);
        this.builderEl.find('.fv-grid-snap').prop('checked', layout.gridSettings?.snap || false);
        this.builderEl.find('.fv-snap-mode').val(layout.gridSettings?.snapMode || 'grid');
        this.builderEl.find('.fv-collision-prevent').prop('checked', layout.collisionSettings?.preventOffscreen !== false);
        
        const gridSize = layout.gridSettings?.size || 20;
        this.builderEl.find('.fv-builder-grid')
            .toggleClass('fv-grid-visible', layout.gridSettings?.enabled || false)
            .css('background-size', `${gridSize}px ${gridSize}px`);
        
        this.renderSlots(layout);
        if (layout.slots.length > 0) this.selectSlot(layout.slots[0].id);
    }
    
    renderSlots(layout) {
        const canvas = this.builderEl.find('.fv-builder-canvas');
        canvas.empty();
        const slotSelect = this.builderEl.find('.fv-slot-select');
        slotSelect.empty();
        
        layout.slots.forEach(slot => {
            const slotEl = this.createSlotElement(slot);
            canvas.append(slotEl);
            slotSelect.append($('<option></option>').val(slot.id).text(`Slot ${slot.id}`));
        });
    }
    
    createSlotElement(slot) {
        const slotTemplate = document.getElementById('fv-slot-template');
        const clone = slotTemplate.content.cloneNode(true);
        const slotEl = $(clone.querySelector('.fv-builder-slot'));
        
        slotEl.attr('data-slot-id', slot.id);
        slotEl.find('.fv-slot-label').text(slot.id);
        slotEl.css({
            left: slot.position.x + '%',
            top: slot.position.y + '%',
            width: slot.size.width + '%',
            height: slot.size.height + '%',
            zIndex: slot.zIndex
        });
        
        this.bindSlotEvents(slotEl, slot.id);
        return slotEl;
    }
    
    bindSlotEvents(slotEl, slotId) {
        slotEl.on('mousedown touchstart', (e) => {
            if ($(e.target).hasClass('fv-slot-resize-handle')) return;
            this.selectSlot(slotId);
            this.startSlotDrag(e, slotEl, slotId);
        });
        
        slotEl.find('.fv-slot-resize-handle').on('mousedown touchstart', (e) => {
            e.stopPropagation();
            this.selectSlot(slotId);
            const handle = $(e.target);
            let direction = '';
            if (handle.hasClass('fv-resize-n')) direction = 'n';
            else if (handle.hasClass('fv-resize-e')) direction = 'e';
            else if (handle.hasClass('fv-resize-s')) direction = 's';
            else if (handle.hasClass('fv-resize-w')) direction = 'w';
            else if (handle.hasClass('fv-resize-ne')) direction = 'ne';
            else if (handle.hasClass('fv-resize-se')) direction = 'se';
            else if (handle.hasClass('fv-resize-sw')) direction = 'sw';
            else if (handle.hasClass('fv-resize-nw')) direction = 'nw';
            this.startSlotResize(e, slotEl, slotId, direction);
        });
    }
    
    selectSlot(slotId) {
        this.selectedSlotId = slotId;
        this.builderEl.find('.fv-builder-slot').removeClass('fv-slot-selected');
        this.builderEl.find(`.fv-builder-slot[data-slot-id="${slotId}"]`).addClass('fv-slot-selected');
        this.builderEl.find('.fv-slot-select').val(slotId);
        this.updateInputsFromSlot(slotId);
    }
    
    updateInputsFromSlot(slotId) {
        const layout = this.manager.getLayout(this.currentLayoutId);
        const slot = layout?.slots.find(s => s.id === slotId);
        if (!slot) return;
        
        this.builderEl.find('.fv-slot-x').val(Math.round(slot.position.x * 10) / 10);
        this.builderEl.find('.fv-slot-y').val(Math.round(slot.position.y * 10) / 10);
        this.builderEl.find('.fv-slot-width').val(Math.round(slot.size.width * 10) / 10);
        this.builderEl.find('.fv-slot-height').val(Math.round(slot.size.height * 10) / 10);
        this.builderEl.find('.fv-slot-zindex').val(slot.zIndex);
    }
    
    updateSlotFromInputs() {
        if (!this.selectedSlotId || !this.currentLayoutId) return;
        
        const x = parseFloat(this.builderEl.find('.fv-slot-x').val()) || 0;
        const y = parseFloat(this.builderEl.find('.fv-slot-y').val()) || 0;
        const width = Math.max(5, parseFloat(this.builderEl.find('.fv-slot-width').val()) || 20);
        const height = Math.max(5, parseFloat(this.builderEl.find('.fv-slot-height').val()) || 20);
        const zIndex = parseInt(this.builderEl.find('.fv-slot-zindex').val()) || 500;
        
        const clampedX = Math.max(0, Math.min(100 - width, x));
        const clampedY = Math.max(0, Math.min(100 - height, y));
        
        this.manager.updateSlot(this.currentLayoutId, this.selectedSlotId, {
            position: { x: clampedX, y: clampedY },
            size: { width, height },
            zIndex
        });
        
        const slotEl = this.builderEl.find(`.fv-builder-slot[data-slot-id="${this.selectedSlotId}"]`);
        slotEl.css({
            left: clampedX + '%',
            top: clampedY + '%',
            width: width + '%',
            height: height + '%',
            zIndex
        });
    }
    
    startSlotDrag(e, slotEl, slotId) {
        e.preventDefault();
        this.isDragging = true;
        this.currentDragSlotEl = slotEl;
        this.currentDragSlotId = slotId;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.dragStartPos = { x: clientX, y: clientY };
        
        const layout = this.manager.getLayout(this.currentLayoutId);
        const slot = layout?.slots.find(s => s.id === slotId);
        if (slot) {
            this.slotStartPos = { x: slot.position.x, y: slot.position.y };
            this.slotStartSize = { width: slot.size.width, height: slot.size.height };
        }
    }
    
    handleSlotDrag(e) {
        if (!this.isDragging || !this.currentDragSlotEl) return;
        e.preventDefault();
        
        if (this._ticking) return;
        this._ticking = true;
        
        requestAnimationFrame(() => {
            if (!this.isDragging || !this.currentDragSlotEl) {
                this._ticking = false;
                return;
            }
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const deltaXPercent = ((clientX - this.dragStartPos.x) / window.innerWidth) * 100;
            const deltaYPercent = ((clientY - this.dragStartPos.y) / window.innerHeight) * 100;
            
            // Calculate raw new position from start position + delta
            let newX = this.slotStartPos.x + deltaXPercent;
            let newY = this.slotStartPos.y + deltaYPercent;
            
            const layout = this.manager.getLayout(this.currentLayoutId);
            const slotWidth = this.slotStartSize?.width || 40;
            const slotHeight = this.slotStartSize?.height || 60;
            
            // Apply boundary constraints BEFORE snap to prevent edge jitter
            if (layout?.collisionSettings?.preventOffscreen !== false) {
                newX = Math.max(0, Math.min(100 - slotWidth, newX));
                newY = Math.max(0, Math.min(100 - slotHeight, newY));
            }
            
            // Apply snap AFTER boundary constraints
            if (layout?.gridSettings?.snap) {
                const snapInc = this.getSnapIncrement(layout);
                newX = Math.round(newX / snapInc.x) * snapInc.x;
                newY = Math.round(newY / snapInc.y) * snapInc.y;
                
                // Re-apply boundary after snap (snap might push slightly over)
                if (layout?.collisionSettings?.preventOffscreen !== false) {
                    newX = Math.max(0, Math.min(100 - slotWidth, newX));
                    newY = Math.max(0, Math.min(100 - slotHeight, newY));
                }
            }
            
            // Update DOM
            this.currentDragSlotEl.css({ left: newX + '%', top: newY + '%' });
            
            // Update input fields
            this.builderEl.find('.fv-slot-x').val(Math.round(newX * 10) / 10);
            this.builderEl.find('.fv-slot-y').val(Math.round(newY * 10) / 10);
            
            this._ticking = false;
        });
    }
    
    startSlotResize(e, slotEl, slotId, direction) {
        e.preventDefault();
        this.isResizing = true;
        this.resizeDirection = direction;
        this.currentDragSlotEl = slotEl;
        this.currentDragSlotId = slotId;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.dragStartPos = { x: clientX, y: clientY };
        
        const layout = this.manager.getLayout(this.currentLayoutId);
        const slot = layout?.slots.find(s => s.id === slotId);
        if (slot) {
            this.slotStartPos = { x: slot.position.x, y: slot.position.y };
            this.slotStartSize = { width: slot.size.width, height: slot.size.height };
        }
    }
    
    handleSlotResize(e) {
        if (!this.isResizing || !this.currentDragSlotEl) return;
        e.preventDefault();
        
        if (this._ticking) return;
        this._ticking = true;
        
        requestAnimationFrame(() => {
            if (!this.isResizing || !this.currentDragSlotEl) {
                this._ticking = false;
                return;
            }
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const deltaXPercent = ((clientX - this.dragStartPos.x) / window.innerWidth) * 100;
            const deltaYPercent = ((clientY - this.dragStartPos.y) / window.innerHeight) * 100;
            
            let newX = this.slotStartPos.x;
            let newY = this.slotStartPos.y;
            let newWidth = this.slotStartSize.width;
            let newHeight = this.slotStartSize.height;
            
            const dir = this.resizeDirection;
            const layout = this.manager.getLayout(this.currentLayoutId);
            
            // Calculate new size based on direction
            if (dir.includes('e')) {
                newWidth = Math.max(5, this.slotStartSize.width + deltaXPercent);
            }
            if (dir.includes('w')) {
                const proposedWidth = this.slotStartSize.width - deltaXPercent;
                if (proposedWidth >= 5) {
                    newWidth = proposedWidth;
                    newX = this.slotStartPos.x + deltaXPercent;
                } else {
                    newWidth = 5;
                    newX = this.slotStartPos.x + this.slotStartSize.width - 5;
                }
            }
            if (dir.includes('s')) {
                newHeight = Math.max(5, this.slotStartSize.height + deltaYPercent);
            }
            if (dir.includes('n')) {
                const proposedHeight = this.slotStartSize.height - deltaYPercent;
                if (proposedHeight >= 5) {
                    newHeight = proposedHeight;
                    newY = this.slotStartPos.y + deltaYPercent;
                } else {
                    newHeight = 5;
                    newY = this.slotStartPos.y + this.slotStartSize.height - 5;
                }
            }
            
            // Enforce minimum size
            newWidth = Math.max(5, newWidth);
            newHeight = Math.max(5, newHeight);
            
            // Apply snap for resize if enabled
            if (layout?.gridSettings?.snap) {
                const snapInc = this.getSnapIncrement(layout);
                
                newWidth = Math.round(newWidth / snapInc.x) * snapInc.x;
                newHeight = Math.round(newHeight / snapInc.y) * snapInc.y;
                
                if (dir.includes('w')) {
                    newX = Math.round(newX / snapInc.x) * snapInc.x;
                }
                if (dir.includes('n')) {
                    newY = Math.round(newY / snapInc.y) * snapInc.y;
                }
                
                newWidth = Math.max(snapInc.x, newWidth);
                newHeight = Math.max(snapInc.y, newHeight);
            }
            
            // Prevent going off-screen
            if (layout?.collisionSettings?.preventOffscreen !== false) {
                if (newX < 0) {
                    newWidth = newWidth + newX;
                    newX = 0;
                }
                if (newY < 0) {
                    newHeight = newHeight + newY;
                    newY = 0;
                }
                if (newX + newWidth > 100) {
                    newWidth = 100 - newX;
                }
                if (newY + newHeight > 100) {
                    newHeight = 100 - newY;
                }
            }
            
            this.currentDragSlotEl.css({ left: newX + '%', top: newY + '%', width: newWidth + '%', height: newHeight + '%' });
            this.manager.updateSlot(this.currentLayoutId, this.currentDragSlotId, {
                position: { x: newX, y: newY },
                size: { width: newWidth, height: newHeight }
            });
            this.updateInputsFromSlot(this.currentDragSlotId);
            
            this._ticking = false;
        });
    }
    
    addSlot() {
        if (!this.currentLayoutId) return;
        const newSlot = this.manager.addSlot(this.currentLayoutId);
        if (newSlot) {
            const layout = this.manager.getLayout(this.currentLayoutId);
            this.renderSlots(layout);
            this.selectSlot(newSlot.id);
            toastr.success(`Slot ${newSlot.id} added`, 'Layout Builder');
        }
    }
    
    removeSelectedSlot() {
        if (!this.currentLayoutId || !this.selectedSlotId) return;
        const removed = this.manager.removeSlot(this.currentLayoutId, this.selectedSlotId);
        if (removed) {
            const layout = this.manager.getLayout(this.currentLayoutId);
            this.renderSlots(layout);
            if (layout.slots.length > 0) this.selectSlot(layout.slots[0].id);
            toastr.success('Slot removed', 'Layout Builder');
        }
    }
    
    // Move selected slot up (-1) or down (+1) in the order
    moveSlot(direction) {
        if (!this.currentLayoutId || !this.selectedSlotId) return;
        
        const layout = this.manager.getLayout(this.currentLayoutId);
        if (!layout) return;
        
        const currentIndex = layout.slots.findIndex(s => s.id === this.selectedSlotId);
        if (currentIndex === -1) return;
        
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= layout.slots.length) return; // Out of bounds
        
        // Swap slots in array
        const moved = this.manager.reorderSlot(this.currentLayoutId, this.selectedSlotId, newIndex);
        if (moved) {
            const updatedLayout = this.manager.getLayout(this.currentLayoutId);
            this.renderSlots(updatedLayout);
            this.selectSlot(this.selectedSlotId);
            
            // Update slot IDs to match their order
            this.manager.renumberSlots(this.currentLayoutId);
            const finalLayout = this.manager.getLayout(this.currentLayoutId);
            this.renderSlots(finalLayout);
            
            // Find new ID of moved slot
            const newSlotId = finalLayout.slots[newIndex].id;
            this.selectSlot(newSlotId);
            
            toastr.info(`Slot moved to position ${newIndex + 1}`, 'Layout Builder');
        }
    }
    
    saveCurrentLayout() {
        if (!this.currentLayoutId) return;
        const name = this.builderEl.find('.fv-layout-name').val().trim();
        if (name) this.manager.updateLayout(this.currentLayoutId, { name });
        this.manager.saveToStorage();
        this.populateLayoutSelect();
        toastr.success('Layout saved!', 'Layout Builder');
    }
    
    renameLayout() {
        if (!this.currentLayoutId) {
            toastr.warning('No layout selected', 'Layout Builder');
            return;
        }
        
        const layout = this.manager.getLayout(this.currentLayoutId);
        if (!layout) return;
        
        const newName = prompt('Enter new layout name:', layout.name);
        if (newName && newName.trim()) {
            this.manager.updateLayout(this.currentLayoutId, { name: newName.trim() });
            this.populateLayoutSelect();
            this.builderEl.find('.fv-layout-name').val(newName.trim());
            toastr.success(`Layout renamed to "${newName.trim()}"`, 'Layout Builder');
        }
    }
    
    deleteCurrentLayout() {
        if (!this.currentLayoutId) return;
        const layout = this.manager.getLayout(this.currentLayoutId);
        if (!layout) return;
        
        if (confirm(`Delete layout "${layout.name}"?`)) {
            this.manager.deleteLayout(this.currentLayoutId);
            this.currentLayoutId = null; // Clear current ID before checking
            this.populateLayoutSelect();
            const layouts = this.manager.getLayoutList();
            if (layouts.length > 0) {
                this.loadLayout(layouts[0].id);
                toastr.success('Layout deleted', 'Layout Builder');
            } else {
                this.createNewLayout();
                toastr.success('Layout deleted. Created new layout.', 'Layout Builder');
            }
        }
    }
    
    updateLayoutGridSettings() {
        if (!this.currentLayoutId) return;
        this.manager.updateLayout(this.currentLayoutId, {
            gridSettings: {
                enabled: this.builderEl.find('.fv-grid-show').prop('checked'),
                size: parseInt(this.builderEl.find('.fv-grid-size').val()) || 20,
                snap: this.builderEl.find('.fv-grid-snap').prop('checked'),
                snapMode: this.builderEl.find('.fv-snap-mode').val() || 'grid'
            }
        });
    }
    
    updateLayoutCollisionSettings() {
        if (!this.currentLayoutId) return;
        this.manager.updateLayout(this.currentLayoutId, {
            collisionSettings: {
                preventOffscreen: this.builderEl.find('.fv-collision-prevent').prop('checked'),
                preventOverlap: false
            }
        });
    }
    
    // Helper to get snap increment based on mode
    getSnapIncrement(layout) {
        const snapMode = layout?.gridSettings?.snapMode || 'grid';
        const gridSize = layout?.gridSettings?.size || 20;
        
        switch (snapMode) {
            case 'pixel':
                // 1px in percentage
                return {
                    x: (1 / window.innerWidth) * 100,
                    y: (1 / window.innerHeight) * 100
                };
            case 'percent':
                // 1%
                return { x: 1, y: 1 };
            case 'grid':
            default:
                return {
                    x: (gridSize / window.innerWidth) * 100,
                    y: (gridSize / window.innerHeight) * 100
                };
        }
    }
}