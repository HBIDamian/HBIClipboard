const { clipboard } = require('electron');
const EventEmitter = require('events');

class ClipboardMonitor extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.lastClipboardContent = '';
    this.lastClipboardImage = null;
    this.pollInterval = null;
    this.lastFormatsKey = '';
    this.lastContainedFiles = false;
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastClipboardContent = clipboard.readText();
    this.lastClipboardImage = clipboard.readImage();
    
    // Poll clipboard every 500ms
    this.pollInterval = setInterval(() => {
      this.checkClipboard();
    }, 500);
    
    console.log('Clipboard monitoring started');
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    console.log('Clipboard monitoring stopped');
  }

  checkClipboard() {
    try {
      const currentText = clipboard.readText();
      const currentImage = clipboard.readImage();
      
      // Check if clipboard contains files/folders (which we want to ignore)
      const containsFiles = this.containsFiles();
      if (containsFiles) {
        // Only log when files state changes from false to true
        if (!this.lastContainedFiles) {
          console.log('Ignoring clipboard content: contains files/folders');
          this.lastContainedFiles = true;
        }
        return;
      }
      
      // Reset files state when clipboard no longer contains files
      if (this.lastContainedFiles) {
        this.lastContainedFiles = false;
      }
      
      // Check for text changes (including rich text)
      if (currentText && currentText !== this.lastClipboardContent) {
        this.lastClipboardContent = currentText;
        
        // Check if this is rich text (HTML content)
        const isRichText = this.isRichText(currentText);
        
        this.emit('change', {
          type: isRichText ? 'richtext' : 'text',
          text: currentText,
          preview: this.createTextPreview(currentText),
          isRichText: isRichText
        });
        return;
      }
      
      // Check for image changes
      if (!currentImage.isEmpty() && !this.imagesEqual(currentImage, this.lastClipboardImage)) {
        this.lastClipboardImage = currentImage;
        
        try {
          const imageBuffer = currentImage.toPNG();
          console.log('Created image buffer, size:', imageBuffer.length);
          
          this.emit('change', {
            type: 'image',
            imageBuffer: imageBuffer, // Store as buffer for persistence
            preview: 'Image',
            dataUrl: this.imageToDataUrl(currentImage)
          });
        } catch (error) {
          console.error('Error creating image buffer:', error);
        }
        return;
      }
      
    } catch (error) {
      console.error('Error checking clipboard:', error);
    }
  }

  createTextPreview(text) {
    if (!text) return '';
    
    // Remove extra whitespace and newlines
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long
    if (cleaned.length > 100) {
      return cleaned.substring(0, 97) + '...';
    }
    
    return cleaned;
  }

  imageToDataUrl(image) {
    try {
      const buffer = image.toPNG();
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error) {
      console.error('Error converting image to data URL:', error);
      return null;
    }
  }

  imagesEqual(img1, img2) {
    if (!img1 || !img2) return false;
    if (img1.isEmpty() && img2.isEmpty()) return true;
    if (img1.isEmpty() || img2.isEmpty()) return false;
    
    try {
      const buffer1 = img1.toPNG();
      const buffer2 = img2.toPNG();
      return buffer1.equals(buffer2);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if clipboard contains files or folders
   */
  containsFiles() {
    try {
      // Check for file paths (common indicators)
      const formats = clipboard.availableFormats();
      
      // Only log when formats change to avoid spam
      const formatsKey = formats.sort().join(',');
      if (this.lastFormatsKey !== formatsKey) {
        console.log('Available clipboard formats:', formats);
        this.lastFormatsKey = formatsKey;
      }
      
      // Common file/folder clipboard formats to ignore
      const fileFormats = [
        'text/uri-list',
        'application/x-moz-file',
        'Files',
        'NSFilenamesPboardType',
        'public.file-url',
        'CorePasteboardFlavorType 0x6675726C', // file URL
        'dyn.ah62d4rv4gu8yc6durvwwa3xmrvw1gkdusm1044pxqyuha2pxsvw0e55bsmwca7d3sbwu', // Finder items
      ];
      
      // Check if any file formats are present
      const hasFileFormats = formats.some(format => 
        fileFormats.some(fileFormat => 
          format.toLowerCase().includes(fileFormat.toLowerCase()) ||
          fileFormat.toLowerCase().includes(format.toLowerCase())
        )
      );
      
      if (hasFileFormats) {
        return true;
      }
      
      // Additional check: if text looks like file paths
      const text = clipboard.readText();
      if (text) {
        // Check for file path patterns
        const filePathPatterns = [
          /^\/[^\/\n]+.*\.([\w]+)$/m, // Unix file paths
          /^[A-Z]:\\.*\.([\w]+)$/m,   // Windows file paths
          /^file:\/\/\//m,            // File URLs
        ];
        
        const isFilePath = filePathPatterns.some(pattern => pattern.test(text));
        if (isFilePath) {
          console.log('Text appears to be file path:', text.substring(0, 100));
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for files:', error);
      return false;
    }
  }

  /**
   * Check if text content is rich text (HTML)
   */
  isRichText(text) {
    if (!text) return false;
    
    // Simple heuristics to detect HTML/rich text
    const htmlPatterns = [
      /<[^>]+>/,                    // HTML tags
      /&[a-zA-Z]+;/,               // HTML entities
      /\{\\rtf1/,                  // RTF format
      /\{\\colortbl/,              // RTF color table
    ];
    
    return htmlPatterns.some(pattern => pattern.test(text));
  }
}

module.exports = ClipboardMonitor;