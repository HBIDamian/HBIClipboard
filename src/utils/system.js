/**
 * Get current cursor position using native Electron API
 */
async function getCursorPosition() {
  try {
    const { screen } = require('electron');
    
    // Use native Electron API - no permissions required!
    const cursorPoint = screen.getCursorScreenPoint();
    console.log('Successfully got cursor position via native Electron API:', { x: cursorPoint.x, y: cursorPoint.y });
    return { x: cursorPoint.x, y: cursorPoint.y };
  } catch (error) {
    console.log('Native cursor API failed, using screen center fallback:', error.message);
    
    // Return screen center as fallback
    const { screen } = require('electron');
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const fallbackPos = { 
        x: Math.floor(width / 2), 
        y: Math.floor(height / 2) 
      };
      console.log('Using fallback cursor position:', fallbackPos);
      return fallbackPos;
    } catch (screenError) {
      console.log('Using hardcoded fallback position');
      return { x: 100, y: 100 };
    }
  }
}

/**
 * Dummy function for backward compatibility
 */
function hasAccessibilityPermissions() {
  // Since we're using native Electron API, no permissions needed
  return true;
}

/**
 * Dummy function for backward compatibility  
 */
function requestAccessibilityPermissions() {
  // Since we're using native Electron API, no permissions needed
  return true;
}



/**
 * Get screen information where cursor is located
 */
function getCurrentScreen() {
  const { screen } = require('electron');
  const cursor = getCursorPosition();
  return screen.getDisplayNearestPoint(cursor);
}

module.exports = {
  getCursorPosition,
  getCurrentScreen,
  hasAccessibilityPermissions,
  requestAccessibilityPermissions
};