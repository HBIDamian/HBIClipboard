const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu } = require('electron');
const path = require('path');

// For electron-store v11+ which uses ES modules, we need to use dynamic import
let Store;
const initStore = async () => {
    const { default: ElectronStore } = await import('electron-store');
    Store = ElectronStore;
};
const ClipboardMonitor = require('./clipboard-monitor');
const { getCursorPosition, hasAccessibilityPermissions, requestAccessibilityPermissions } = require('./utils/system');

class ClipboardManager {
  constructor() {
    this.store = null;
    this.clipboardHistory = [];
    this.clipboardWindow = null;
    this.startupWindow = null;
    this.monitor = null;
  }
  
  async initialize() {
    await initStore();
    this.store = new Store();
    
    // Ensure windowFollowsCursor defaults to true if not set
    if (!this.store.has('windowFollowsCursor')) {
      this.store.set('windowFollowsCursor', true);
    }
    
    this.clipboardHistory = this.store.get('clipboardHistory', []);
    this.tray = null;
    this.lastCursorPosition = null;
    this.windowCreationTime = null;
    this.isWindowInitializing = false;
    this.lastShortcutTrigger = 0;
  }

  async init() {
    // Show startup message if enabled
    await this.showStartupMessage();

    // Initialize clipboard monitoring
    this.monitor = new ClipboardMonitor();
    this.monitor.on('change', (clipboardData) => {
      this.addToHistory(clipboardData);
    });
    this.monitor.start();

    // Register global shortcut
    this.registerGlobalShortcut();

    // Setup IPC handlers
    this.setupIPC();

    // Setup system tray
    this.setupTray();

    console.log('HBIClipboard Manager initialized');
    
    // Periodic check to ensure global shortcut is still registered
    setInterval(() => {
      const isRegistered = globalShortcut.isRegistered('Option+Command+V');
      if (!isRegistered) {
        console.log('Global shortcut lost, attempting to re-register...');
        this.registerGlobalShortcut();
      }
    }, 10000); // Check every 10 seconds
  }

  async showStartupMessage() {
    const showStartupMessage = this.store.get('showStartupMessage', true);
    
    if (!showStartupMessage) {
      console.log('Startup message disabled in settings');
      return;
    }

    console.log('Showing startup message');
    
    // Detect system theme for consistent styling
    const { nativeTheme } = require('electron');
    const isDarkTheme = nativeTheme.shouldUseDarkColors;
    const backgroundColor = isDarkTheme ? '#202020' : '#f8f8f8';
    
    this.startupWindow = new BrowserWindow({
      width: 550,
      height: 480,
      alwaysOnTop: true,
      center: true,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      backgroundColor: backgroundColor,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.startupWindow.loadFile(path.join(__dirname, 'renderer', 'startup.html'));

    this.startupWindow.once('ready-to-show', () => {
      this.startupWindow.show();
      console.log('Startup message shown');
    });

    // Auto-close after 15 seconds
    setTimeout(() => {
      if (this.startupWindow && !this.startupWindow.isDestroyed()) {
        this.startupWindow.close();
        this.startupWindow = null;
      }
    }, 15000);
  }

  registerGlobalShortcut() {
    const shortcut = this.store.get('keyboardShortcut', 'Option+Command+V');
    
    // First, unregister any existing shortcuts
    globalShortcut.unregisterAll();
    
    const success = globalShortcut.register(shortcut, async () => {
      try {
        const now = Date.now();
        console.log(`Global shortcut triggered at ${now}`);
        
        // Debounce shortcut triggers (prevent rapid-fire)
        if (now - this.lastShortcutTrigger < 300) {
          console.log('Shortcut triggered too quickly, ignoring...');
          return;
        }
        this.lastShortcutTrigger = now;
        
        console.log('Processing global shortcut...');
        await this.showClipboardWindow();
        console.log('Global shortcut processing completed');
      } catch (error) {
        console.error('Error handling global shortcut:', error);
      }
    });

    if (!success) {
      console.error('Failed to register global shortcut');
      // Try again after a short delay
      setTimeout(() => {
        console.log('Retrying global shortcut registration...');
        this.registerGlobalShortcut();
      }, 1000);
    } else {
      console.log(`Global shortcut ${shortcut} registered successfully`);
      
      // Verify registration
      const isRegistered = globalShortcut.isRegistered(shortcut);
      console.log(`Shortcut verification: ${isRegistered ? 'confirmed' : 'failed'}`);
    }
  }



  setupTray() {
    const { nativeImage } = require('electron');
    
    // Try to load the white paperclip tray icon
    const iconPath = path.join(__dirname, '../assets/paperclip-tray.png');
    let trayIcon;
    
    try {
      if (require('fs').existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
        // Ensure the icon is properly sized for the menu bar
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
        console.log('Loaded paperclip tray icon successfully');
      } else {
        console.log('paperclip-tray.png not found, using fallback');
        // Create a simple icon with the paperclip emoji as fallback
        trayIcon = nativeImage.createEmpty();
      }
    } catch (error) {
      console.log('Could not load tray icon, using fallback:', error);
      trayIcon = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(trayIcon);
    
    // Only set emoji title if we couldn't load the actual icon
    if (trayIcon.isEmpty()) {
      this.tray.setTitle('📎');
    }
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open HBIClipboard Manager',
        click: () => {
          this.showClipboardWindow(true); // Force top right positioning
        }
      },
      {
        label: 'Clear History',
        click: async () => {
          this.clipboardHistory = [];
          this.store.set('clipboardHistory', []);
          console.log('Clipboard history cleared from tray menu');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);
    
    // Don't set context menu by default - we'll handle clicks manually
    this.tray.setToolTip('HBIClipboard Manager - Option+Cmd+V');
    
    // Left click - open HBIClipboard Manager in top right (always)
    this.tray.on('click', () => {
      this.showClipboardWindow(true); // Force top right positioning
    });
    
    // Right click - show context menu
    this.tray.on('right-click', () => {
      this.tray.popUpContextMenu(contextMenu);
    });
  }

  async showClipboardWindow(forceTopRight = false) {
    try {
      console.log('Attempting to show clipboard window...', forceTopRight ? '(forced top right)' : '');
      
      // Prevent multiple simultaneous window creations
      if (this.isWindowInitializing) {
        console.log('Window already initializing, skipping...');
        return;
      }
      
      this.isWindowInitializing = true;
      
      // Get cursor position for window positioning (unless forcing top right)
      if (!forceTopRight) {
        try {
          this.lastCursorPosition = await getCursorPosition();
        } catch (error) {
          console.log('Failed to get cursor position, using fallback');
          this.lastCursorPosition = { x: 100, y: 100 };
        }
        console.log('Cursor position:', this.lastCursorPosition);
      }
      
      // Always create a fresh window for consistency
      if (this.clipboardWindow) {
        console.log('Destroying existing window to create fresh one...');
        this.destroyClipboardWindow();
      }

      // Create window at calculated position
      const { x, y } = this.calculateWindowPosition(forceTopRight);
      console.log('Window position:', { x, y });
      
      // Detect system theme to prevent flashing
      const { nativeTheme } = require('electron');
      const isDarkTheme = nativeTheme.shouldUseDarkColors;
      const backgroundColor = isDarkTheme ? '#202020' : '#f8f8f8';
      console.log('Detected theme:', isDarkTheme ? 'dark' : 'light', 'using background:', backgroundColor);
      
      this.clipboardWindow = new BrowserWindow({
        width: 400,
        height: 500,
        x,
        y,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        backgroundColor: backgroundColor,
        show: false, // Don't show until ready
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      // Set up ready-to-show handler BEFORE loading
      this.clipboardWindow.once('ready-to-show', () => {
        console.log('Window ready-to-show event fired');
        this.clipboardWindow.show();
        this.clipboardWindow.focus();
      });

      await this.clipboardWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
      
      console.log('Clipboard window created and loaded successfully');
      
      // Mark creation time and clear initialization flag
      this.windowCreationTime = Date.now();
      this.isWindowInitializing = false;
      
      // Fallback: Show window if ready-to-show didn't fire
      setTimeout(() => {
        if (this.clipboardWindow && !this.clipboardWindow.isVisible()) {
          console.log('Fallback: showing window manually');
          this.clipboardWindow.show();
          this.clipboardWindow.focus();
        }
      }, 100);
      
      // Handle window blur (destroy when clicking outside)
      this.clipboardWindow.on('blur', () => {
        // Prevent immediate destruction after creation
        const timeSinceCreation = Date.now() - this.windowCreationTime;
        if (timeSinceCreation < 500) {
          console.log('Ignoring blur event - window just created');
          return;
        }
        
        console.log('Window blur detected');
        
        // Small delay to prevent accidental closes
        setTimeout(() => {
          if (this.clipboardWindow && !this.clipboardWindow.isFocused() && !this.clipboardWindow.isDestroyed()) {
            console.log('Window lost focus, destroying...');
            this.destroyClipboardWindow();
          } else if (this.clipboardWindow) {
            console.log('Window still focused or destroyed, keeping alive');
          }
        }, 200);
      });

      this.clipboardWindow.on('closed', () => {
        this.clipboardWindow = null;
        this.isWindowInitializing = false;
      });

      // Window will be shown via ready-to-show event handler above

    } catch (error) {
      console.error('Error showing clipboard window:', error);
      this.isWindowInitializing = false;
      // Clean up if window creation failed
      if (this.clipboardWindow) {
        this.clipboardWindow.destroy();
        this.clipboardWindow = null;
      }
    }
  }

  hideClipboardWindow() {
    if (this.clipboardWindow) {
      this.clipboardWindow.hide();
    }
  }

  destroyClipboardWindow() {
    if (this.clipboardWindow) {
      console.log('Destroying clipboard window...');
      this.clipboardWindow.destroy();
      this.clipboardWindow = null;
      this.isWindowInitializing = false;
      this.windowCreationTime = null;
    }
  }

  calculateWindowPosition(forceTopRight = false) {
    const cursor = this.lastCursorPosition;
    const windowFollowsCursor = this.store.get('windowFollowsCursor', true);
    
    // If window doesn't follow cursor or top right is forced, position in top right
    if (!windowFollowsCursor || forceTopRight) {
      console.log('Using top right positioning');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const { x: displayX, y: displayY } = primaryDisplay.workArea;
      return {
        x: displayX + width - 400 - 20, // 20px margin from right edge (400px wide window)
        y: displayY + 20 // 20px margin from top
      };
    }
    
    // Fallback to center of screen if cursor position is invalid
    if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
      console.log('Invalid cursor position, using screen center');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      return {
        x: Math.floor(width / 2 - 200), // Center horizontally (400px wide window)
        y: Math.floor(height / 2 - 250) // Center vertically (500px tall window)
      };
    }
    
    const displays = screen.getAllDisplays();
    const currentDisplay = screen.getDisplayNearestPoint(cursor);
    
    console.log('Display info:', {
      cursor: cursor,
      currentDisplay: currentDisplay.bounds,
      scaleFactor: currentDisplay.scaleFactor
    });
    
    // Position window near cursor, but ensure it stays on screen
    let x = cursor.x + 10;
    let y = cursor.y - 250; // Above cursor
    
    console.log('Initial position calculation:', { x, y });
    
    // Adjust if window would go off-screen
    if (x + 400 > currentDisplay.bounds.x + currentDisplay.bounds.width) {
      x = cursor.x - 410; // To the left of cursor
      console.log('Adjusted x to left of cursor:', x);
    }
    
    if (y < currentDisplay.bounds.y) {
      y = cursor.y + 10; // Below cursor
      console.log('Adjusted y to below cursor:', y);
    }
    
    // Final safety check - ensure coordinates are within display bounds
    x = Math.max(currentDisplay.bounds.x, Math.min(x, currentDisplay.bounds.x + currentDisplay.bounds.width - 400));
    y = Math.max(currentDisplay.bounds.y, Math.min(y, currentDisplay.bounds.y + currentDisplay.bounds.height - 500));
    
    console.log('Final position after bounds check:', { x, y });
    return { x, y };
  }

  addToHistory(clipboardData) {
    // Remove duplicate if exists
    this.clipboardHistory = this.clipboardHistory.filter(item => {
      if (item.type !== clipboardData.type) return true;
      if (item.type === 'text' || item.type === 'richtext') {
        return item.text !== clipboardData.text;
      } else if (item.type === 'image') {
        // For images, compare the dataUrl since buffers are harder to compare
        return item.dataUrl !== clipboardData.dataUrl;
      }
      return true;
    });
    
    // Add to beginning of array
    const newItem = {
      ...clipboardData,
      timestamp: Date.now(),
      id: Date.now().toString()
    };
    
    // Special handling for image buffers to ensure they're stored properly
    if (newItem.type === 'image' && newItem.imageBuffer) {
      console.log('Storing image item, buffer type:', typeof newItem.imageBuffer);
      console.log('Is Buffer:', Buffer.isBuffer(newItem.imageBuffer));
      
      // Convert buffer to a format that electron-store can handle
      if (Buffer.isBuffer(newItem.imageBuffer)) {
        // Store as base64 string to avoid serialization issues
        newItem.imageBufferBase64 = newItem.imageBuffer.toString('base64');
        delete newItem.imageBuffer; // Remove original buffer
        console.log('Converted buffer to base64, length:', newItem.imageBufferBase64.length);
      }
    }
    
    this.clipboardHistory.unshift(newItem);
    
    // Limit history size (use configured limit or default to 50)
    const historyLimit = this.store.get('historyLimit', 50);
    if (this.clipboardHistory.length > historyLimit) {
      this.clipboardHistory = this.clipboardHistory.slice(0, historyLimit);
    }
    
    // Save to persistent storage
    this.store.set('clipboardHistory', this.clipboardHistory);
    
    // Update window if open
    if (this.clipboardWindow) {
      this.clipboardWindow.webContents.send('history-updated', this.clipboardHistory);
    }
  }

  setupIPC() {
    ipcMain.handle('get-clipboard-history', () => {
      return this.clipboardHistory;
    });

    ipcMain.handle('get-history-limit', () => {
      return this.store.get('historyLimit', 50);
    });

    ipcMain.handle('select-clipboard-item', async (event, itemId) => {
      const item = this.clipboardHistory.find(h => h.id === itemId);
      if (!item) return;

      // Move item to top of history
      this.clipboardHistory = this.clipboardHistory.filter(h => h.id !== itemId);
      this.clipboardHistory.unshift(item);
      this.store.set('clipboardHistory', this.clipboardHistory);

      // Set clipboard content
      if (item.type === 'text' || item.type === 'richtext') {
        console.log('Setting text to clipboard:', item.text.substring(0, 50) + '...');
        clipboard.writeText(item.text);
        
        // Show in-window notification (if enabled)
        const notificationsEnabled = this.store.get('notificationsEnabled', true);
        if (notificationsEnabled) {
          const textPreview = item.text.length > 50 ? item.text.substring(0, 50) + '...' : item.text;
          const notificationTitle = item.type === 'richtext' ? 'Rich Text Copied' : 'Text Copied';
          if (this.clipboardWindow) {
            this.clipboardWindow.webContents.send('show-notification', {
              title: notificationTitle,
              message: `"${textPreview}" is ready to paste`,
              type: 'success'
            });
          }
        }
      } else if (item.type === 'image') {
        console.log('Setting image to clipboard...');
        console.log('Item has imageBufferBase64:', !!item.imageBufferBase64);
        console.log('Item has imageBuffer:', !!item.imageBuffer);
        
        let buffer = null;
        
        // Try to get buffer from different possible formats
        if (item.imageBufferBase64) {
          console.log('Using base64 buffer, length:', item.imageBufferBase64.length);
          buffer = Buffer.from(item.imageBufferBase64, 'base64');
        } else if (item.imageBuffer) {
          console.log('Using direct buffer, size:', item.imageBuffer ? item.imageBuffer.length : 'undefined');
          buffer = item.imageBuffer;
          
          // Ensure buffer is actually a Buffer
          if (!Buffer.isBuffer(buffer)) {
            console.log('Converting imageBuffer data to Buffer...');
            if (buffer && buffer.data) {
              // Handle case where buffer was serialized as {type: 'Buffer', data: [...]}
              buffer = Buffer.from(buffer.data);
            } else if (Array.isArray(buffer)) {
              // Handle case where buffer was serialized as array
              buffer = Buffer.from(buffer);
            } else {
              console.error('Cannot convert imageBuffer to Buffer:', typeof buffer);
              return;
            }
          }
        } else {
          console.error('No image buffer found for item:', item.id);
          return;
        }
        
        try {
          // Convert buffer back to NativeImage
          const { nativeImage } = require('electron');
          const image = nativeImage.createFromBuffer(buffer);
          console.log('Created NativeImage, isEmpty:', image.isEmpty());
          
          if (image.isEmpty()) {
            console.error('Created NativeImage is empty');
            return;
          }
          
          clipboard.writeImage(image);
          
          // Verify the image was set correctly
          const verifyImage = clipboard.readImage();
          console.log('Clipboard image verification - isEmpty:', verifyImage.isEmpty());
          
          // Show in-window notification (if enabled)
          const notificationsEnabled = this.store.get('notificationsEnabled', true);
          if (notificationsEnabled && this.clipboardWindow) {
            this.clipboardWindow.webContents.send('show-notification', {
              title: 'Image Copied',
              message: 'Image is ready to paste',
              type: 'success'
            });
          }
        } catch (error) {
          console.error('Error setting image to clipboard:', error);
          // Show error notification (if enabled)
          const notificationsEnabled = this.store.get('notificationsEnabled', true);
          if (notificationsEnabled && this.clipboardWindow) {
            this.clipboardWindow.webContents.send('show-notification', {
              title: 'Error',
              message: 'Failed to copy image to clipboard',
              type: 'error'
            });
          }
        }
      }

      // Delay window destruction to show notification
      setTimeout(() => {
        this.destroyClipboardWindow();
      }, 2800); // Slightly longer than notification display time

      console.log('Item set to clipboard and ready for pasting');
    });

    ipcMain.handle('close-clipboard-window', () => {
      this.destroyClipboardWindow();
    });

    ipcMain.handle('clear-clipboard-history', () => {
      console.log('Clearing clipboard history...');
      this.clipboardHistory = [];
      this.store.set('clipboardHistory', []);
      
      // Update window if open
      if (this.clipboardWindow) {
        this.clipboardWindow.webContents.send('history-updated', this.clipboardHistory);
      }
      
      console.log('Clipboard history cleared');
      return true;
    });

    ipcMain.handle('update-history-limit', (event, limit) => {
      console.log('Updating history limit to:', limit);
      
      // Truncate current history if needed
      if (this.clipboardHistory.length > limit) {
        this.clipboardHistory = this.clipboardHistory.slice(0, limit);
        this.store.set('clipboardHistory', this.clipboardHistory);
        
        // Update window if open
        if (this.clipboardWindow) {
          this.clipboardWindow.webContents.send('history-updated', this.clipboardHistory);
        }
      }
      
      // Store the new limit (we can use this in addToHistory later)
      this.store.set('historyLimit', limit);
      console.log('History limit updated');
      return true;
    });

    // Auto-launch settings
    ipcMain.handle('get-auto-launch', () => {
      return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('set-auto-launch', (event, enabled) => {
      console.log('Setting auto-launch:', enabled);
      // Use correct path for packaged app
      let launchPath = process.execPath;
      if (!app.isPackaged) {
        // In development, use Electron binary
        launchPath = process.argv[0];
      }
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: launchPath
      });
      return true;
    });

    // Notification settings
    ipcMain.handle('get-notifications-enabled', () => {
      return this.store.get('notificationsEnabled', true);
    });

    ipcMain.handle('set-notifications-enabled', (event, enabled) => {
      console.log('Setting notifications enabled:', enabled);
      this.store.set('notificationsEnabled', enabled);
      return true;
    });

    // Window position settings
    ipcMain.handle('get-window-follows-cursor', () => {
      return this.store.get('windowFollowsCursor', true);
    });

    ipcMain.handle('set-window-follows-cursor', (event, enabled) => {
      console.log('Setting window follows cursor:', enabled);
      this.store.set('windowFollowsCursor', enabled);
      return true;
    });

    // Startup message settings
    ipcMain.handle('get-show-startup-message', () => {
      return this.store.get('showStartupMessage', true);
    });

    ipcMain.handle('set-show-startup-message', (event, enabled) => {
      console.log('Setting show startup message:', enabled);
      this.store.set('showStartupMessage', enabled);
      return true;
    });

    // Keyboard shortcut handlers
    ipcMain.handle('get-keyboard-shortcut', () => {
      return this.store.get('keyboardShortcut', 'Option+Command+V');
    });

    ipcMain.handle('set-keyboard-shortcut', (event, shortcut) => {
      console.log('Setting keyboard shortcut:', shortcut);
      const oldShortcut = this.store.get('keyboardShortcut', 'Option+Command+V');
      
      try {
        // Unregister old shortcut
        globalShortcut.unregister(oldShortcut);
        
        // Register new shortcut
        const success = globalShortcut.register(shortcut, () => {
          console.log('Global shortcut triggered:', shortcut);
          this.showClipboardWindow();
        });
        
        if (success) {
          this.store.set('keyboardShortcut', shortcut);
          console.log('Successfully registered new shortcut:', shortcut);
          return true;
        } else {
          // Re-register old shortcut if new one failed
          globalShortcut.register(oldShortcut, () => {
            console.log('Global shortcut triggered:', oldShortcut);
            this.showClipboardWindow();
          });
          throw new Error('Failed to register new shortcut');
        }
      } catch (error) {
        console.error('Error updating keyboard shortcut:', error);
        throw error;
      }
    });

    // App control handlers
    ipcMain.handle('quit-app', () => {
      console.log('Quit app requested from settings');
      app.quit();
    });

    ipcMain.handle('quit-and-reset-app', () => {
      console.log('Quit and reset app requested from settings');
      
      try {
        // Clear all stored data
        this.store.clear();
        console.log('All app data cleared');
        
        // Clear clipboard history
        this.clipboardHistory = [];
        
        // Quit the app
        app.quit();
      } catch (error) {
        console.error('Error resetting app data:', error);
        throw error;
      }
    });
  }

  

  cleanup() {
    if (this.monitor) {
      this.monitor.stop();
    }
    this.destroyClipboardWindow();
    if (this.startupWindow && !this.startupWindow.isDestroyed()) {
      this.startupWindow.close();
    }
    globalShortcut.unregisterAll();
  }
}

// App event handlers
let clipboardManager;

app.whenReady().then(async () => {
  // Hide app from dock on macOS - it will only appear in menu bar
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  clipboardManager = new ClipboardManager();
  await clipboardManager.initialize();
  await clipboardManager.init();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  // The app should keep running in the background (menu bar only)
  // Do nothing - let the app continue running
});

app.on('before-quit', () => {
  if (clipboardManager) {
    clipboardManager.cleanup();
  }
});

app.on('activate', () => {
  // Re-create window if needed on macOS
});