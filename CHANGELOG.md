# Changelog

## [1.2.0] - 2025-12-27

### Added
- **SVG Lock Icons**: Replaced emoji lock icons (🔒/🔓) with monochrome SVG icons for theme consistency
- **Icon State Management**: CSS-based icon switching for locked/unlocked states
- **Image Layout System**: New layout management system for predefined image positioning
  - Create custom layouts with multiple slots
  - Full-viewport layout builder with draggable floating toolbar
  - Drag and resize slots visually
  - Grid overlay with snap-to-grid option
  - Collision prevention (keep slots on-screen)
  - Per-slot Z-index control
  - Layouts saved to localStorage (persist across sessions)
  - Global layouts available across all themes
  - **Layout Integration**: New viewers automatically position to layout slots (viewer 1 → slot 1, etc.)
  - **Fill Mode**: Toggle to zoom/crop images to fill entire slot or fit within slot
  - **Auto Max Instances**: Active layout slot count overrides manual max instances setting
  - **Slot Re-ordering**: Up/down buttons to reorder layout slots in the builder
- **Prevent Overlap**: New toggle to stop viewers from overlapping each other when dragging
- **Minimize Button**: Collapse viewer to circular thumbnail with magnifying glass icon
  - Toggle between minimized and full view
  - Double-click minimized viewer to restore
  - Smooth CSS animations

### Changed
- Lock button now uses inline SVG instead of emoji text
- Simplified lock toggle logic - relies purely on CSS class toggle
- Icons inherit theme colors via `currentColor` property
- New "Image Layouts" section in settings panel
- Resize is disabled when using layout slots (layout defines fixed sizes)

### Fixed
- **Firefox Compatibility**: Added defensive fixes for drag/resize issues reported on Firefox 146
  - Added `e.preventDefault()` to mousedown handler to prevent native image drag
  - Added `-moz-user-drag: none` CSS property for Firefox
  - Added `ondragstart` handler to prevent native browser drag behavior
  - Added `pointer-events: auto` to ensure event handling works correctly
  - Added try-catch wrapper around jQuery UI resizable initialization
  - Added defensive check for jQuery UI availability

### New Files
- `layout-builder.html` - Layout builder UI template
- `layout-builder.js` - Layout builder UI class

---

## [1.1.2] - 2025-12-09

### Added
- **Pinch-to-Zoom**: Two-finger pinch gesture now works on mobile devices

### Changed
- Mobile buttons (X and Lock) now auto-hide after 2 seconds of inactivity
- Reduced button sizes for mobile: 22px (touch devices) → 20px (narrow screens)

### Fixed
- **Pinch-to-zoom not working**: Added `touch-action: none` to enable JS touch handling
- **Choppy drag/resize animations**: Removed CSS transition on image transform
- **Box-shadow performance**: Disabled during drag for smoother movement on low-end devices
- **Buttons too big on mobile**: Adjusted sizes with proper media queries for touch/narrow screens
- Mobile buttons (Lock) were missing from touch device styles

---

## [1.1.1] - 2025-12-08

### Added
- **Lock Button**: Lock individual viewer positions (🔒/🔓 button beside X)
- **Remember Layout**: Save positions for all viewer slots (Multi-Image mode)
- **Fixed Viewer IDs**: Stable ID system (1-10) for reliable position tracking
- **Clear Saved Positions**: Button to reset all remembered positions

### Changed
- Reorganized settings: separate **Zoom Settings** and **Multi-Image Settings** sections
- Storage now uses object-based format keyed by viewer ID (more reliable)

### Fixed
- Locked positions now correctly preserved when clearing cache
- Position restore works correctly with multi-image mode
- Pan limits allow reaching image edges when zoomed
- Cursor-origin zoom math improved

---

## [1.1.0] - 2025-12-08

### Added
- **Zoom Controls**: Scroll wheel to zoom in/out (zooms toward cursor position)
- **Panning**: Drag to pan around when zoomed in
- **Free Pan Mode**: Optional setting to allow panning beyond image bounds
- **Multi-Image Support**: Open multiple images in separate windows simultaneously
- **Maximum Instances Setting**: Configure max simultaneous windows (1-10)
- **Keyboard Shortcuts**: Press Escape to close the focused viewer
- **CSS Animations**: Smooth pop-in/pop-out animations when opening/closing windows

### Changed
- Improved settings UI with new "Advanced Settings" section
- Updated "How to Use" section with zoom, pan, and keyboard instructions
- Refactored viewer to use templates for multi-instance support

### Fixed
- Pan limits now correctly allow reaching image edges when zoomed
- Cursor-origin zoom math corrected for natural feel

---

## [1.0.0] - Initial Release

### Features
- Draggable floating image viewer
- Resizable windows (maintains aspect ratio)
- Works with chat avatars and gallery images
- Remember position & size option
- Default size setting (percentage of viewport)
- Mobile touch support with custom resize handle
- Intercept toggles for avatars and gallery
