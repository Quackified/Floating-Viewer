# Floating Viewer

A SillyTavern extension that replaces the default image popup with a **draggable and resizable floating window**.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Platform](https://img.shields.io/badge/platform-SillyTavern-purple)

## ✨ Features

- **Layout System (New in 2.0)** - Create custom layouts for multiple images
- **Visual Builder (New in 2.0)** - Drag & drop interface to design slot positions
- **Image Fit Modes** - Classic, Cover, Contain, Stretch, Center
- **Draggable Window** – Move the image anywhere on screen
- **Resizable** – Drag edges or corners to resize (maintains aspect ratio)
- **Zoom Controls** – Scroll wheel to zoom in/out (zooms toward cursor)
- **Pan Support** – Drag to pan around when zoomed in
- **Multi-Image** – Open multiple images in separate windows
- **Touch Support** – Full mobile/tablet compatibility

## 🏗️ Layout System (v2.0)

Turn Floating Viewer into a powerful window manager!

- **Visual Layout Builder**: Click "Open Layout Builder" in settings to design your screen.
- **Slots**: Define exact positions (X, Y, Width, Height) for up to 10 images.
- **Fit Modes**:
  - **Classic**: Window wraps tightly around the image (default).
  - **Cover**: Image fills the slot completely (crops excess).
  - **Contain**: Image fits inside the slot (letterboxed).
  - **Stretch**: Image distorts to fill the slot.
  - **Center**: Image stays original size, centered in slot.
- **Scopes**: Save layouts globally or per-theme.

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
├── layout-builder.html
├── layout-builder.js
├── manifest.json
└── readme.md
```

## ⚙️ Settings

Find **Floating Viewer** in the Extensions panel (right sidebar).

| Setting | Description |
|---------|-------------|
| **Enable Floating Viewer** | Master toggle for the extension |
| **Enable Layout System** | Turn on the new slot-based positioning system |
| **Active Layout** | Select which layout preset to use |
| **Image Fit Mode** | How images should fit into layout slots |
| **Intercept Chat Avatars** | Use floating viewer for character/user avatars |
| **Intercept Gallery Images** | Use floating viewer for gallery images |
| **Allows Multiple Windows** | Open multiple viewers simultaneously |

## 🎮 Usage

| Action | How |
|--------|-----|
| **Open Image** | Click any avatar in chat or image in gallery |
| **Move** | Drag anywhere on the image |
| **Resize** | Drag edges or corners |
| **Zoom** | Scroll wheel (zooms toward cursor) |
| **Pan** | Drag when zoomed in |
| **Close** | Click X button or press **Escape** |

## 🔧 Compatibility

- **SillyTavern**: 1.12.0+
- **Browsers**: Chrome, Firefox, Edge, Safari
- **Mobile**: iOS Safari, Android Chrome (touch-optimized)

## 📋 Planned Features

- [x] Collision borders / Keep On-Screen
- [x] Z-index layering
- [x] Snap to grid alignment
- [x] Quick arrange layouts (via Builder)
- [ ] Minimize button (Improved)
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