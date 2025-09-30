# HBIClipboard Manager for macOS

A modern Windows 11-style clipboard manager for macOS that runs seamlessly in your menu bar. Built with the latest Electron and Node.js technologies for optimal performance and security.

## ✨ Features

- 📋 **Smart Clipboard History**: Tracks up to 50 recent clipboard items with intelligent filtering
- 🔍 **Instant Search**: Lightning-fast search through your clipboard history
- ⌨️ **Global Hotkey**: Quick access with `Option + Command + V` from anywhere
- 🎨 **Native Theme Support**: Automatically adapts to macOS light/dark mode with no flash
- 🎯 **Cursor-Following Window**: Appears intelligently near your cursor or last input location
- 🚀 **Menu Bar Integration**: Subtle paperclip icon that fits perfectly in your menu bar
- ⚙️ **Organized Settings**: Clean, categorized settings panel for easy customization
- 💾 **Persistent Storage**: Your clipboard history survives app restarts and system reboots
- 🔒 **Privacy-First**: All data stored locally with no network connections
- ⚡ **Optimized Performance**: Minimal system resource usage with smart clipboard monitoring

## 🚀 Quick Start

### Prerequisites

- macOS 10.15+ (Catalina or later)
- Node.js 18+ (latest LTS recommended)
- Xcode Command Line Tools: `xcode-select --install`

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ClipboardManager
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Grant system permissions**:
   - **Accessibility**: System Preferences → Security & Privacy → Privacy → Accessibility
   - Add Terminal (and later Electron) to allow system control

4. **Launch the app**:
   ```bash
   npm start
   ```

### Building Distribution Package

Create a ready-to-distribute DMG file:

```bash
npm run build
```

The built app will be available in the `dist/` folder as `Clipboard Manager-1.0.0-universal.dmg`.

3. **Grant necessary permissions**:
   - **Accessibility**: Go to System Preferences → Security & Privacy → Accessibility
   - Add the Terminal app (or your terminal application) to allow it to control your computer
   - Later, when you first run the app, you may need to add Electron to this list as well

4. **Start the application**:
   ```bash
   npm start
   ```

## 💻 Usage

### Getting Started

1. **Launch**: Run `npm start` or launch from Applications folder
2. **Background Operation**: App runs silently in your menu bar (look for 📎 icon)
3. **Copy Anything**: Copy text, images, or rich content as usual (`⌘+C`)
4. **Access History**: Press `Option + Command + V` from anywhere to open clipboard
5. **Select & Paste**: Click any item or use keyboard navigation to paste

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌥ + ⌘ + V` | Open clipboard history window |
| `↑/↓` or `Tab/Shift+Tab` | Navigate through items |
| `Enter` | Select and paste current item |
| `Escape` | Close clipboard window |
| `⌘ + F` | Focus search box |

### 🎯 Smart Features

**Intelligent Positioning**: The clipboard window appears near your cursor or last text input location, automatically adjusting if there's insufficient screen space.

**Instant Search**: Type in the search box to filter clipboard items in real-time. Searches through both visible text and rich content.

**Auto-Reordering**: Recently used items automatically move to the top for quick access.

**Smart Pasting**: 
1. Sets selected content to system clipboard
2. Returns focus to your previous application  
3. Automatically triggers paste (`⌘+V`)
4. Seamlessly continues your workflow

**Content Filtering**: Automatically ignores file paths and system clipboard noise while preserving your important content.

## 📄 Supported Content Types

| Type | Status | Description |
|------|--------|-------------|
| 📝 **Plain Text** | ✅ Full Support | Regular text, code snippets, terminal output |
| 🎨 **Rich Text** | ✅ Full Support | Formatted text from apps like Notes, Word, web browsers |
| 🖼️ **Images** | ✅ Full Support | PNG, JPEG, screenshots, copied images from any app |
| 📁 **Files/Folders** | 🚫 Filtered Out | Intentionally ignored to reduce clipboard noise |
| 🔗 **URLs** | ✅ As Text | Treated as text content, special handling planned |

## ⚙️ Settings & Customization

Access the settings panel by clicking the gear icon in the clipboard window:

### 📋 Clipboard Settings
- **History Limit**: Adjust maximum stored items (default: 50)
- **Auto-clear**: Set automatic cleanup intervals
- **Content Filtering**: Control what gets saved

### 📻 Shortcuts
- **Global Hotkey**: Customize your activation shortcut
- **Quick Actions**: Set up frequently used combinations

### �️ Appearance  
- **Theme**: Auto-sync with macOS or set manual preference
- **Window Position**: Choose cursor-following or fixed positioning
- **Animations**: Control window transitions and effects

### 🚪 Startup
- **Launch at Login**: Auto-start with macOS
- **Menu Bar Icon**: Show/hide the paperclip icon
- **Notifications**: Control system notifications

## 🛠️ Development

### Tech Stack

- **Electron 35.7.5**: Latest secure version with native APIs
- **Node.js 18+**: Modern JavaScript runtime
- **electron-store 11.0.0**: Secure local data persistence
- **electron-builder 26.0.12**: Advanced packaging and distribution

### Project Architecture

```
ClipboardManager/
├── src/
│   ├── main.js              # Main Electron process & app lifecycle
│   ├── clipboard-monitor.js # Smart clipboard monitoring with spam prevention
│   ├── utils/
│   │   └── system.js        # Native system utilities (cursor, permissions)
│   └── renderer/
│       ├── index.html       # Modern UI with organized settings
│       ├── styles.css       # Windows 11-inspired design system
│       └── renderer.js      # Event handling & UI interactions
├── build/                   # Build configuration & assets
├── dist/                    # Generated distribution files
├── package.json             # Dependencies & scripts
└── README.md               # This file
```


### Recent Updates ✨

- **Security Hardening**: Updated all dependencies, eliminated 0 vulnerabilities
- **Performance**: Reduced clipboard monitoring spam with intelligent state tracking  
- **UI Polish**: Organized settings into logical sections with emoji navigation
- **Native APIs**: Migrated from nut-js to Electron's built-in cursor positioning
- **Modern Packaging**: Updated to latest electron-builder with improved signing

## 🔧 Troubleshooting

### System Permissions

**Accessibility Access Required**
```bash
System Preferences → Security & Privacy → Privacy → Accessibility
```
- Add Terminal (for development)
- Add Electron/HBIClipboard Manager (after first launch)
- Restart app after granting permissions

### Common Issues

| Problem | Solution |
|---------|----------|
| **Global shortcut conflicts** | Another app using `⌥⌘V` - try changing hotkey in settings |
| **Window not appearing** | Check Activity Monitor for multiple instances, restart app |
| **Paste not working** | Some apps block programmatic paste - try manual `⌘V` |
| **High CPU usage** | Restart app to reset clipboard monitoring |
| **App won't start** | Ensure Node.js 18+, run `npm install`, check terminal errors |

### Performance Notes

- **Clipboard Monitoring**: Intelligent 500ms polling with spam prevention
- **Memory Usage**: Automatically manages history size (50 item limit)
- **CPU Impact**: Minimal - optimized for background operation
- **Storage**: Local-only with secure electron-store encryption

## 🔒 Privacy & Security

### Security First Design
- **🏠 Local Only**: All data stored locally on your machine, never transmitted
- **🚫 No Network**: Zero network requests or external communications  
- **🔐 Encrypted Storage**: Uses Electron's secure storage with OS-level encryption
- **⏰ Auto-Cleanup**: Configurable retention limits (default: 50 items)
- **🛡️ Latest Dependencies**: All packages updated to latest secure versions
- **🔍 Vulnerability-Free**: Regular security audits with 0 known vulnerabilities

### Data Handling
- **Temporary Content**: Only clipboard data is stored, no personal information
- **Smart Filtering**: Ignores system files and sensitive paths automatically
- **User Control**: Full control over what gets saved via settings
- **Clean Uninstall**: Complete data removal when app is uninstalled

## 📋 System Requirements

- **macOS**: 10.15 (Catalina) or later
- **Memory**: 50MB RAM typical usage
- **Storage**: ~200MB for app + minimal data storage
- **Permissions**: Accessibility access for global shortcuts and pasting

## 🤝 Contributing

We welcome contributions! Here's how to get involved:

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `npm install`
4. Make your changes
5. Test thoroughly: `npm start`
6. Submit a pull request

### Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 🔥 High | Custom hotkey configuration | Planned |
| 🔥 High | Multi-monitor cursor detection | In Progress |
| 📋 Medium | URL preview and handling | Planned |  
| 📋 Medium | Import/export clipboard history | Planned |
| 💡 Low | Clipboard item categories/tags | Ideas |
| 💡 Low | Advanced search with regex | Ideas |

## 📄 License

MIT License - see [LICENSE](LICENSE) file for full details.

---

**Made with ❤️ for macOS productivity**  
*A modern clipboard manager that just works™*