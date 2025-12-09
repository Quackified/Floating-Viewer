# Floating Viewer

A SillyTavern extension that replaces the default image popup with a **draggable and resizable floating window**.

![Version](https://img.shields.io/badge/version-1.1.2-blue)
![Platform](https://img.shields.io/badge/platform-SillyTavern-purple)

## ✨ Features

- **Draggable Window** – Move the image anywhere on screen
- **Resizable** – Drag edges or corners to resize (maintains aspect ratio)
- **Zoom Controls** – Scroll wheel to zoom in/out (zooms toward cursor)
- **Pan Support** – Drag to pan around when zoomed in
- **Multi-Image** – Open multiple images in separate windows
- **Lock Positions** – Lock individual viewer positions (🔒 button)
- **Remember Layout** – Save positions for all viewer slots
- **Keyboard Shortcuts** – Press Escape to close the focused viewer
- **Touch Support** – Full mobile/tablet compatibility
- **Smooth Animations** – Pop-in/pop-out effects

## 📦 Installation

### Automatic Installation

1. Open SillyTavern
2. Go to **Extensions** panel
3. Click **Install Extension**
4. Paste: `https://github.com/Quackified/Floating-Viewer`
5. Click **Save**

### Manual Installation

1. Navigate to your SillyTavern installation folder
2. Go to `public/scripts/extensions/third-party/`
3. Create a new folder called `floating-viewer`
4. Copy all extension files into the folder
5. Refresh SillyTavern

### File Structure

```
floating-viewer/
├── index.js
├── style.css
├── settings.html
├── manifest.json
└── readme.md
```

## ⚙️ Settings

Find **Floating Viewer** in the Extensions panel (right sidebar).

| Setting | Description |
|---------|-------------|
| **Enable Floating Viewer** | Master toggle for the extension |
| **Intercept Chat Avatars** | Use floating viewer for character/user avatars |
| **Intercept Gallery Images** | Use floating viewer for gallery images |
| **Default Image Size** | Initial size as % of viewport (10-100%) |
| **Remember Position & Size** | Restore last position/size within session |
| **Enable Zoom** | Toggle scroll wheel zoom |
| **Maximum Zoom** | Max zoom level (100-500%) |
| **Free Pan** | Allow panning beyond image bounds |
| **Allow Multiple Windows** | Open multiple viewers simultaneously |
| **Maximum Instances** | Max simultaneous windows (1-10) |

## 🎮 Usage

| Action | How |
|--------|-----|
| **Open Image** | Click any avatar in chat or image in gallery |
| **Move** | Drag anywhere on the image |
| **Resize** | Drag edges or corners (aspect ratio preserved) |
| **Zoom** | Scroll wheel (zooms toward cursor) |
| **Pan** | Drag when zoomed in |
| **Close** | Click X button or press **Escape** |

## 🔧 Compatibility

- **SillyTavern**: 1.12.0+
- **Browsers**: Chrome, Firefox, Edge, Safari
- **Mobile**: iOS Safari, Android Chrome (touch-optimized)

## 📋 Planned Features

- [ ] Collision borders (prevent overlapping/off-screen)
- [ ] Z-index layering (click to bring to front)
- [ ] Snap to grid alignment
- [ ] Quick arrange layouts (side-by-side, grid) (not sure if this is a good idea)
- [ ] Minimize button
- [ ] Gallery navigation (prev/next)

## 🐛 Known Issues

None reported yet! [Open an issue](../../issues) if you find one.

## 👤 Author

**Quackified**

- 🐙 GitHub: [@Quackified](https://github.com/Quackified)
- 💬 Do you have some bread?

---

Made for [SillyTavern](https://github.com/SillyTavern/SillyTavern)  
Tested on: v1.14.0 'release' (9c9be9082)