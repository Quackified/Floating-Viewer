# Floating Viewer

A SillyTavern extension that replaces the default image popup with a **draggable and resizable floating window**.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Platform](https://img.shields.io/badge/platform-SillyTavern-purple)

## ✨ Features

- **Draggable Window** – Move the image anywhere on screen
- **Resizable** – Drag edges or corners to resize (maintains aspect ratio)
- **Touch Support** – Full mobile/tablet compatibility with touch gestures
- **Intercept Modes** – Works with chat avatars and gallery images
- **Minimal UI** – Clean viewer that wraps tightly around the image
- **Hover Close Button** – Unobtrusive X button appears on hover

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
| **Intercept Chat Avatars** | Use floating viewer for character/user avatars in chat |
| **Intercept Gallery Images** | Use floating viewer for images from More → Show Gallery |

## 🎮 Usage

| Action | How |
|--------|-----|
| **Open Image** | Click any avatar in chat or image in gallery |
| **Move** | Drag anywhere on the image |
| **Resize** | Drag edges or corners (aspect ratio preserved) |
| **Close** | Click the X button (appears on hover) |

## 🔧 Compatibility

- **SillyTavern**: 1.12.0+
- **Browsers**: Chrome, Firefox, Edge, Safari
- **Mobile**: iOS Safari, Android Chrome (touch-optimized)

## 📋 Planned Features

- [ ] Download button
- [ ] Copy to clipboard
- [ ] Keyboard shortcuts (Esc to close)
- [ ] Zoom controls
- [ ] Gallery navigation (prev/next)
- [ ] Remember position/size

## 🐛 Known Issues

None reported yet! [Open an issue](../../issues) if you find one.

## 👤 Author

**Quackified**

- 🐙 GitHub: [@Quackified](https://github.com/Quackified)
- 💬 Do you have some bread?

---

Made for [SillyTavern](https://github.com/SillyTavern/SillyTavern)  
Tested on: v1.14.0 'release' (9c9be9082)