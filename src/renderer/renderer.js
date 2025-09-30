const { ipcRenderer } = require('electron');

class ClipboardUI {
    constructor() {
        this.clipboardHistory = [];
        this.filteredHistory = [];
        this.selectedIndex = -1;
        this.searchInput = document.getElementById('searchInput');
        this.clipboardList = document.getElementById('clipboardList');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadClipboardHistory();
    }

    setupEventListeners() {
        // Search functionality
        this.searchInput.addEventListener('input', () => {
            this.filterHistory();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // IPC listeners
        ipcRenderer.on('history-updated', (event, history) => {
            this.clipboardHistory = history;
            this.filterHistory();
        });

        // Notification listener
        ipcRenderer.on('show-notification', (event, notification) => {
            this.showNotification(notification.title, notification.message, notification.type);
        });

        // Focus search input when window opens
        setTimeout(() => {
            this.searchInput.focus();
        }, 100);
    }

    async loadClipboardHistory() {
        try {
            this.clipboardHistory = await ipcRenderer.invoke('get-clipboard-history');
            this.filterHistory();
            
            // Load current settings
            const currentLimit = await ipcRenderer.invoke('get-history-limit');
            const select = document.getElementById('historySizeLimit');
            if (select && currentLimit) {
                select.value = currentLimit.toString();
            }

            // Load auto-launch setting
            const autoLaunch = await ipcRenderer.invoke('get-auto-launch');
            const autoLaunchToggle = document.getElementById('autoLaunchToggle');
            if (autoLaunchToggle) {
                autoLaunchToggle.checked = autoLaunch;
            }

            // Load notifications setting
            const notificationsEnabled = await ipcRenderer.invoke('get-notifications-enabled');
            const notificationsToggle = document.getElementById('notificationsToggle');
            if (notificationsToggle) {
                notificationsToggle.checked = notificationsEnabled;
            }

            // Load window follows cursor setting
            const windowFollowsCursor = await ipcRenderer.invoke('get-window-follows-cursor');
            const windowFollowsCursorToggle = document.getElementById('windowFollowsCursorToggle');
            if (windowFollowsCursorToggle) {
                windowFollowsCursorToggle.checked = windowFollowsCursor;
            }

            // Load show startup message setting
            const showStartupMessage = await ipcRenderer.invoke('get-show-startup-message');
            const showStartupMessageToggle = document.getElementById('showStartupMessageToggle');
            if (showStartupMessageToggle) {
                showStartupMessageToggle.checked = showStartupMessage;
            }

            // Load keyboard shortcut setting
            const keyboardShortcut = await ipcRenderer.invoke('get-keyboard-shortcut');
            const keyboardShortcutSelect = document.getElementById('keyboardShortcutSelect');
            if (keyboardShortcutSelect) {
                keyboardShortcutSelect.value = keyboardShortcut;
            }


        } catch (error) {
            console.error('Error loading clipboard history and settings:', error);
        }
    }

    filterHistory() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredHistory = [...this.clipboardHistory];
        } else {
            this.filteredHistory = this.clipboardHistory.filter(item => {
                if (item.type === 'text' || item.type === 'richtext') {
                    return item.text.toLowerCase().includes(searchTerm) ||
                           item.preview.toLowerCase().includes(searchTerm);
                }
                return false; // Only filter text and rich text items
            });
        }
        
        this.selectedIndex = -1;
        this.renderHistory();
    }

    renderHistory() {
        if (this.filteredHistory.length === 0) {
            this.clipboardList.innerHTML = `
                <div class="empty-state">
                    <p>No clipboard history found.</p>
                    ${this.searchInput.value ? '<p>Try a different search term.</p>' : '<p>Copy text, rich text, or images to get started!</p>'}
                </div>
            `;
            return;
        }

        const historyHTML = this.filteredHistory.map((item, index) => {
            return this.createItemHTML(item, index);
        }).join('');

        this.clipboardList.innerHTML = historyHTML;

        // Add click listeners
        const items = this.clipboardList.querySelectorAll('.clipboard-item');
        items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectItem(index);
            });
        });
    }

    showNotification(title, message, type = 'success') {
        const container = document.getElementById('notificationContainer');
        const titleElement = document.getElementById('notificationTitle');
        const messageElement = document.getElementById('notificationMessage');
        const iconElement = document.getElementById('notificationIcon');
        const notification = container.querySelector('.notification');
        
        // Set content
        titleElement.textContent = title;
        messageElement.textContent = message;
        
        // Set type and icon
        notification.className = 'notification';
        if (type === 'error') {
            notification.classList.add('error');
            iconElement.textContent = '⚠️';
        } else {
            iconElement.textContent = '✓';
        }
        
        // Show notification
        container.style.display = 'block';
        
        // Auto-hide after 2.5 seconds
        setTimeout(() => {
            if (container.style.display !== 'none') {
                notification.style.animation = 'slideOutNotification 0.3s ease-out forwards';
                setTimeout(() => {
                    container.style.display = 'none';
                    notification.style.animation = '';
                }, 300);
            }
        }, 2500);
    }

    createItemHTML(item, index) {
        const isSelected = index === this.selectedIndex;
        const timestamp = this.formatTimestamp(item.timestamp);
        
        let icon = '📄';
        let content = '';
        
        if (item.type === 'text') {
            icon = '📄';
            content = `<div class="item-preview">${this.escapeHtml(item.preview)}</div>`;
        } else if (item.type === 'richtext') {
            icon = '📝';
            content = `<div class="item-preview">${this.escapeHtml(item.preview)}</div>`;
        } else if (item.type === 'image') {
            icon = '🖼️';
            content = `
                <img src="${item.dataUrl}" alt="Clipboard image" class="item-image" />
                <div class="item-preview">Image</div>
            `;
        }

        return `
            <div class="clipboard-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                <div class="item-icon">${icon}</div>
                <div class="item-content">
                    ${content}
                    <div class="item-meta">
                        <span class="item-type">${item.type}</span>
                        <span class="item-timestamp">${timestamp}</span>
                    </div>
                </div>
            </div>
        `;
    }

    handleKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                // Close settings first if open, otherwise close window
                const settingsPanel = document.getElementById('settingsPanel');
                if (settingsPanel.style.display !== 'none') {
                    toggleSettings();
                } else {
                    this.closeWindow();
                }
                break;
            
            case 'ArrowDown':
                e.preventDefault();
                this.moveSelection(1);
                break;
            
            case 'ArrowUp':
                e.preventDefault();
                this.moveSelection(-1);
                break;
            
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectItem(this.selectedIndex);
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                this.moveSelection(e.shiftKey ? -1 : 1);
                break;
        }
    }

    moveSelection(direction) {
        if (this.filteredHistory.length === 0) return;
        
        this.selectedIndex += direction;
        
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.filteredHistory.length - 1;
        } else if (this.selectedIndex >= this.filteredHistory.length) {
            this.selectedIndex = 0;
        }
        
        this.updateSelectionUI();
        this.scrollToSelected();
    }

    updateSelectionUI() {
        const items = this.clipboardList.querySelectorAll('.clipboard-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    scrollToSelected() {
        if (this.selectedIndex < 0) return;
        
        const selectedItem = this.clipboardList.querySelector(`.clipboard-item[data-index="${this.selectedIndex}"]`);
        if (selectedItem) {
            selectedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    async selectItem(index) {
        if (index < 0 || index >= this.filteredHistory.length) return;
        
        const item = this.filteredHistory[index];
        
        try {
            await ipcRenderer.invoke('select-clipboard-item', item.id);
        } catch (error) {
            console.error('Error selecting clipboard item:', error);
        }
    }

    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    closeWindow() {
        ipcRenderer.invoke('close-clipboard-window');
    }


}

// Global functions for HTML event handlers
function closeWindow() {
    ipcRenderer.invoke('close-clipboard-window');
}

function toggleSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    const clipboardList = document.getElementById('clipboardList');
    
    if (settingsPanel.style.display === 'none') {
        settingsPanel.style.display = 'block';
        clipboardList.style.display = 'none';
    } else {
        settingsPanel.style.display = 'none';
        clipboardList.style.display = 'block';
    }
}

async function clearClipboardHistory() {
    const confirmed = confirm('Are you sure you want to clear all clipboard history? This action cannot be undone.');
    if (confirmed) {
        try {
            await ipcRenderer.invoke('clear-clipboard-history');
            // Hide settings and refresh the list
            toggleSettings();
        } catch (error) {
            console.error('Error clearing clipboard history:', error);
            alert('Failed to clear clipboard history. Please try again.');
        }
    }
}

async function updateHistoryLimit() {
    const select = document.getElementById('historySizeLimit');
    const limit = parseInt(select.value);
    
    if (limit && limit > 0) {
        try {
            await ipcRenderer.invoke('update-history-limit', limit);
            console.log('History limit updated to:', limit);
        } catch (error) {
            console.error('Error updating history limit:', error);
        }
    }
}

async function updateAutoLaunch() {
    const checkbox = document.getElementById('autoLaunchToggle');
    try {
        await ipcRenderer.invoke('set-auto-launch', checkbox.checked);
        console.log('Auto-launch updated to:', checkbox.checked);
    } catch (error) {
        console.error('Error updating auto-launch:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
    }
}

async function updateNotifications() {
    const checkbox = document.getElementById('notificationsToggle');
    try {
        await ipcRenderer.invoke('set-notifications-enabled', checkbox.checked);
        console.log('Notifications updated to:', checkbox.checked);
    } catch (error) {
        console.error('Error updating notifications:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
    }
}

async function updateWindowFollowsCursor() {
    const checkbox = document.getElementById('windowFollowsCursorToggle');
    try {
        await ipcRenderer.invoke('set-window-follows-cursor', checkbox.checked);
        console.log('Window follows cursor updated to:', checkbox.checked);
    } catch (error) {
        console.error('Error updating window follows cursor:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
    }
}

async function updateShowStartupMessage() {
    const checkbox = document.getElementById('showStartupMessageToggle');
    try {
        await ipcRenderer.invoke('set-show-startup-message', checkbox.checked);
        console.log('Show startup message updated to:', checkbox.checked);
    } catch (error) {
        console.error('Error updating show startup message:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
    }
}

async function updateKeyboardShortcut() {
    const select = document.getElementById('keyboardShortcutSelect');
    try {
        await ipcRenderer.invoke('set-keyboard-shortcut', select.value);
        console.log('Keyboard shortcut updated to:', select.value);
        
        // Show confirmation notification
        const ui = new ClipboardUI();
        ui.showNotification('Shortcut Updated', `New shortcut: ${select.value}`, 'success');
    } catch (error) {
        console.error('Error updating keyboard shortcut:', error);
        
        // Revert select value on error - get the current setting
        try {
            const currentShortcut = await ipcRenderer.invoke('get-keyboard-shortcut');
            select.value = currentShortcut;
        } catch (getError) {
            console.error('Error getting current shortcut:', getError);
        }
    }
}

async function closeApp() {
    const confirmed = confirm('Are you sure you want to close HBIClipboard Manager?');
    if (confirmed) {
        try {
            await ipcRenderer.invoke('quit-app');
        } catch (error) {
            console.error('Error closing app:', error);
        }
    }
}

async function closeAndResetApp() {
    const confirmed = confirm('Are you sure you want to close the app and permanently delete ALL clipboard history and settings?\n\nThis action cannot be undone!');
    if (confirmed) {
        const doubleConfirmed = confirm('This will permanently delete all your data. Are you absolutely sure?');
        if (doubleConfirmed) {
            try {
                await ipcRenderer.invoke('quit-and-reset-app');
            } catch (error) {
                console.error('Error resetting app:', error);
                alert('Failed to reset app data. Please try again.');
            }
        }
    }
}

// Initialize the UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ClipboardUI();
});