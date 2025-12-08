# Changelog

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
