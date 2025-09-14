// console.log('Google Drive Image Copy: Content script loaded on', window.location.href);

let lastClickedImageUrl: string | null = null;
let customMenu: HTMLElement | null = null;
let extensionValid = true;
let menuCreated = false;
let contextMenuUpdateTimeout: number | undefined;

// Extract image URL from any element
function getImageUrlFromElement(element: HTMLElement): string | null {
  // Check for direct image element
  if (element.tagName === 'IMG') {
    return (element as HTMLImageElement).src;
  }

  // Check for background images in various containers
  if (element.closest('[role="img"]')) {
    const imgElement = element.closest('[role="img"]') as HTMLElement;
    const style = window.getComputedStyle(imgElement);
    const backgroundImage = style.backgroundImage;
    if (backgroundImage && backgroundImage !== 'none') {
      return backgroundImage.slice(5, -2);
    }
  }

  // Google Drive specific selectors
  if (element.closest('.a-u-xb-j, .a-u-j, .a-u-xb, .Q5txwe')) {
    const container = element.closest('.a-u-xb-j, .a-u-j, .a-u-xb, .Q5txwe');
    const img = container?.querySelector('img') as HTMLImageElement | null;
    if (img) {
      return img.src;
    }
  }

  // Check parent elements for images
  const parentWithImage = element.closest('div');
  if (parentWithImage) {
    const img = parentWithImage.querySelector('img') as HTMLImageElement | null;
    if (img) {
      return img.src;
    }
  }

  return null;
}

// Check if there are any images on the page
function hasImagesOnPage(): boolean {
  // Check for direct IMG elements
  const images = document.querySelectorAll('img');
  for (const img of images) {
    const src = (img as HTMLImageElement).src;
    if (src && src.includes('googleusercontent.com')) {
      return true;
    }
  }

  // Check for role="img" elements with background images
  const roleImages = document.querySelectorAll('[role="img"]');
  for (const element of roleImages) {
    const style = window.getComputedStyle(element as HTMLElement);
    const backgroundImage = style.backgroundImage;
    if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('googleusercontent.com')) {
      return true;
    }
  }

  // Check Google Drive specific containers
  const driveContainers = document.querySelectorAll('.a-u-xb-j, .a-u-j, .a-u-xb, .Q5txwe');
  for (const container of driveContainers) {
    const img = container.querySelector('img') as HTMLImageElement | null;
    if (img && img.src && img.src.includes('googleusercontent.com')) {
      return true;
    }
  }

  return false;
}

// Update context menu based on image presence
function updateContextMenu() {
  const hasImages = hasImagesOnPage();

  if (hasImages && !menuCreated) {
    // Create menu
    safeSendMessage({ action: 'createContextMenu' }).catch(() => {
      // Ignore errors
    });
    menuCreated = true;
    // console.log('Context menu created due to image detection');
  } else if (!hasImages && menuCreated) {
    // Remove menu
    safeSendMessage({ action: 'removeContextMenu' }).catch(() => {
      // Ignore errors
    });
    menuCreated = false;
    // console.log('Context menu removed due to no images');
  }
}

// Check if extension context is valid
function checkExtensionContext(): boolean {
  try {
    // Try to access chrome.runtime to test if context is valid
    if (chrome.runtime && chrome.runtime.id) {
      return true;
    }
  } catch (error) {
    // console.log('Extension context is invalid, stopping script');
    extensionValid = false;
    return false;
  }
  return false;
}

// Safe chrome.runtime.sendMessage with error handling
function safeSendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!checkExtensionContext()) {
      reject(new Error('Extension context invalid'));
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'Unknown runtime error';
          console.error('Runtime error:', errorMessage);
          if (errorMessage.includes('context invalidated')) {
            extensionValid = false;
            window.location.reload();
          }
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      extensionValid = false;
      reject(error);
    }
  });
}


// Create custom context menu
function createCustomMenu() {
  // Remove existing menu if any
  if (customMenu) {
    customMenu.remove();
  }

  customMenu = document.createElement('div');
  customMenu.id = 'gdrive-image-copy-menu';
  // Create menu structure without inline event handlers
  const menuContainer = document.createElement('div');
  menuContainer.style.cssText = `
    position: fixed;
    background: #1a73e8;
    color: white;
    border: 2px solid #1a73e8;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3);
    padding: 4px 0;
    z-index: 999999;
    display: none;
    min-width: 220px;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
  `;

  const copyButton = document.createElement('div');
  copyButton.id = 'copy-image-btn';
  copyButton.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: white;
    transition: background 0.2s;
    border-radius: 4px;
    margin: 2px;
  `;
  copyButton.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    🚀 画像をコピー
  `;

  // Add a header to distinguish this menu
  const menuHeader = document.createElement('div');
  menuHeader.style.cssText = `
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    margin-bottom: 2px;
  `;
  menuHeader.textContent = '🌐 Chrome拡張機能';

  // Add hover effects with JavaScript
  copyButton.addEventListener('mouseenter', () => {
    copyButton.style.background = 'rgba(255, 255, 255, 0.2)';
  });
  copyButton.addEventListener('mouseleave', () => {
    copyButton.style.background = 'transparent';
  });

  menuContainer.appendChild(menuHeader);
  menuContainer.appendChild(copyButton);
  customMenu.appendChild(menuContainer);

  document.body.appendChild(customMenu);

  // Add click handler for copy button
  copyButton.addEventListener('click', (e) => {
    e.stopPropagation();

    if (lastClickedImageUrl) {
      // console.log('Custom menu copy triggered:', lastClickedImageUrl);
      // Process image copy directly in content script
      copyImageDirectly(lastClickedImageUrl);

      // Show feedback
      copyButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#4CAF50">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
        処理中...
      `;

      setTimeout(() => {
        hideCustomMenu();
      }, 500);
    }
  });

  return customMenu;
}

function showCustomMenu(x: number, y: number) {
  if (!customMenu) {
    createCustomMenu();
  }

  // Reset button text to original state
  const copyButton = customMenu?.querySelector('#copy-image-btn') as HTMLElement;
  if (copyButton) {
    copyButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      画像をコピー
    `;
  }

  const menu = customMenu?.querySelector('div') as HTMLElement;
  if (menu) {
    // Check if Google Drive's native menu exists and position accordingly
    const existingMenu = document.querySelector('[data-menu-trigger], [role="menu"], .a-b-e');
    let offsetX = x;
    let offsetY = y;

    if (existingMenu) {
      const existingRect = existingMenu.getBoundingClientRect();
      // Position our menu to the right or below the existing menu
      if (existingRect.width > 0 && existingRect.height > 0) {
        offsetX = existingRect.right + 10; // 10px gap to the right
        offsetY = existingRect.top;
        // console.log('Positioning custom menu next to existing menu');
      } else {
        // If we can't detect the existing menu, use a safe offset
        offsetX = x + 150; // Standard offset to the right
        // console.log('Using standard offset for custom menu');
      }
    } else {
      // No existing menu detected, use small offset to be safe
      offsetX = x + 150;
      // console.log('No existing menu detected, using safe offset');
    }

    menu.style.display = 'block';
    menu.style.left = `${offsetX}px`;
    menu.style.top = `${offsetY}px`;

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      // If right side is off-screen, try positioning to the left of original click
      menu.style.left = `${x - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }

    // Final check - make sure it's still visible
    const finalRect = menu.getBoundingClientRect();
    if (finalRect.left < 0) {
      menu.style.left = '10px';
    }
    if (finalRect.top < 0) {
      menu.style.top = '10px';
    }
  }
}

function hideCustomMenu() {
  const menu = customMenu?.querySelector('div') as HTMLElement;
  if (menu) {
    menu.style.display = 'none';
  }
}

// Hide menu when clicking elsewhere
document.addEventListener('click', () => {
  hideCustomMenu();
});

document.addEventListener('contextmenu', (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const imageUrl = getImageUrlFromElement(target);

  // console.log('Right-click detected on element:', target.tagName, target.className);


  if (imageUrl) {
    lastClickedImageUrl = imageUrl;
    // console.log('Sending image URL to background:', imageUrl);

    // Show custom menu with offset to avoid overlapping Google Drive's menu
    setTimeout(() => {
      showCustomMenu(e.pageX, e.pageY);
    }, 50); // Small delay to let Google Drive's menu appear first

    // Don't prevent default to allow Google Drive's menu to show too
  } else {
    // console.log('No image found at click location');
    // Try to find any visible image on the page
    document.querySelectorAll('img');
    // console.log(`Found ${document.querySelectorAll('img').length} images on page`);
  }
}, true);

// Handle messages from extension with error checking
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    try {
      if (!extensionValid || !checkExtensionContext()) {
        sendResponse({ error: 'Extension context invalid' });
        return true;
      }

      if (request.action === 'getImageUrl') {
        sendResponse({ url: lastClickedImageUrl });
      } else if (request.action === 'showNotification') {
        // Handle error messages from background script
        showImprovedErrorMessage(request.message, lastClickedImageUrl || undefined);
        sendResponse({ success: true });
      }
      return true;
    } catch (error) {
      console.error('Error handling message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({ error: errorMessage });
      return true;
    }
  });
}

// Direct image copy function (no background communication needed)
function copyImageDirectly(imageUrl: string): void {
  // console.log('copyImageDirectly called with URL:', imageUrl);

  // Find the image element
  const images = document.querySelectorAll('img');
  let targetImage: HTMLImageElement | null = null;

  for (const img of images) {
    if ((img as HTMLImageElement).src === imageUrl) {
      targetImage = img as HTMLImageElement;
      break;
    }
  }

  if (!targetImage) {
    console.error('Could not find image element with URL:', imageUrl);
    showImprovedErrorMessage('画像が見つかりませんでした', imageUrl);
    return;
  }

  // console.log('Found target image element:', targetImage);

  // Try automatic copy methods first
  tryAutomaticCopy(targetImage)
    .then(() => {
      // console.log('Automatic copy successful, verifying clipboard...');
      // Verify clipboard contents
      verifyClipboardContent()
        .then((hasImage) => {
          if (hasImage) {
            // console.log('Clipboard verification successful - image data found');
            showSuccessMessage();
          } else {
            // console.log('Clipboard verification failed - no image data found');
            throw new Error('No image data in clipboard');
          }
        })
        .catch(() => {
          // console.log('Clipboard verification failed');
          // Show improved error message instead of instructions
          showImprovedErrorMessage('クリップボードの確認に失敗しました', imageUrl);
        });
    })
    .catch((error) => {
      console.error('Automatic copy failed:', error.message);
      // Show improved error message with retry option
      showImprovedErrorMessage(error.message, imageUrl);
    });
}

// Show copy instructions
function showCopyInstructions(img: HTMLImageElement): void {
  // Highlight the image temporarily
  const originalBorder = img.style.border;
  const originalBoxShadow = img.style.boxShadow;

  img.style.border = '3px solid #f44336';
  img.style.boxShadow = '0 0 10px rgba(244, 67, 54, 0.5)';

  // Create instruction popup
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #f44336;
    border-radius: 8px;
    padding: 20px;
    z-index: 999999;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;

  popup.innerHTML = `
    <div style="margin-bottom: 15px; font-size: 18px; color: #f44336;">
      ⚠️ コピーに失敗しました
    </div>
    <div style="margin-bottom: 15px; font-size: 14px; color: #333;">
      自動コピーに失敗しました。<br>
      赤色の枠で囲まれた画像を<br>
      <strong>右クリック</strong> → <strong>"画像をコピー"</strong>
    </div>
    <div style="margin-bottom: 15px; font-size: 12px; color: #666; border: 1px solid #ddd; padding: 8px; border-radius: 4px; background: #f9f9f9;">
      <strong>ヒント:</strong> Google Driveのメニューから「画像をコピー」を選択してください。<br>
      それでも失敗する場合は、画像の共有設定を「リンクを知っている全員が閲覧可」に変更してください。
    </div>
    <button id="copy-done-btn" style="
      background: #f44336;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 8px;
    ">
      理解しました
    </button>
    <button id="copy-retry-btn" style="
      background: #2196F3;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">
      再試行
    </button>
  `;

  document.body.appendChild(popup);

  // Handle OK button click
  const okButton = popup.querySelector('#copy-done-btn');
  if (okButton) {
    okButton.addEventListener('click', () => {
      img.style.border = originalBorder;
      img.style.boxShadow = originalBoxShadow;
      popup.remove();
    });
  }

  // Handle retry button click
  const retryButton = popup.querySelector('#copy-retry-btn');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      // console.log('Retrying automatic copy...');
      tryAutomaticCopy(img)
        .then(() => {
          img.style.border = originalBorder;
          img.style.boxShadow = originalBoxShadow;
          popup.remove();
          showSuccessMessage();
        })
        .catch(() => {
          // console.log('Retry failed, keeping instructions visible');
          // Keep the popup open for another attempt
        });
    });
  }

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (popup.parentNode) {
      img.style.border = originalBorder;
      img.style.boxShadow = originalBoxShadow;
      popup.remove();
    }
  }, 10000);
}

// Simplified automatic copy using only the working method
function tryAutomaticCopy(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve, reject) => {
    // console.log('Trying automatic copy...');
    const imageUrl = img.src;
    // console.log('Original image URL:', imageUrl);

    // Use only the working Google Drive URL format
    const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) {
      reject(new Error('Could not extract Google Drive file ID'));
      return;
    }

    const fileId = fileIdMatch[1];
    const workingUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    // console.log('Using working URL format:', workingUrl);

    fetch(workingUrl, {
      mode: 'cors',
      credentials: 'include'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.blob();
      })
      .then((blob) => {
        // console.log(`Fetch successful, got ${blob.type} blob`);
        if (!blob || blob.size === 0) {
          throw new Error('Empty blob received');
        }
        // Convert any image format to PNG for clipboard compatibility
        return convertBlobToPng(blob);
      })
      .then((pngBlob) => {
        // console.log('Converted to PNG, copying to clipboard');
        const item = new ClipboardItem({ 'image/png': pngBlob });
        return navigator.clipboard.write([item]);
      })
      .then(() => {
        // console.log('Clipboard write successful');
        console.log('Image copied to clipboard successfully');
        resolve();
      })
      .catch((error) => {
        console.error('Copy failed:', error.message);
        reject(error);
      });
  });
}


// Convert any image blob to PNG for clipboard compatibility
function convertBlobToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    // console.log(`Converting ${blob.type} (${blob.size} bytes) to PNG...`);

    // If already PNG, return as-is
    if (blob.type === 'image/png') {
      // console.log('Already PNG, no conversion needed');
      resolve(blob);
      return;
    }

    // For non-PNG images, try to convert
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Try to avoid CORS issues

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      // console.log('Canvas context not available, trying direct blob approach');
      // Fallback: try to use the original blob with PNG mime type
      const pngBlob = new Blob([blob], { type: 'image/png' });
      resolve(pngBlob);
      return;
    }

    let objectUrl: string;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onload = () => {
      try {
        // console.log(`Image loaded: ${img.naturalWidth}x${img.naturalHeight}`);

        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;

        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image on canvas
        ctx.drawImage(img, 0, 0);

        // Convert canvas to PNG blob
        canvas.toBlob((pngBlob) => {
          cleanup();
          if (pngBlob && pngBlob.size > 0) {
            // console.log(`Successfully converted to PNG: ${pngBlob.size} bytes`);
            resolve(pngBlob);
          } else {
            // console.log('PNG conversion failed, trying fallback');
            // Fallback approach
            const fallbackBlob = new Blob([blob], { type: 'image/png' });
            resolve(fallbackBlob);
          }
        }, 'image/png', 0.9);

      } catch (error) {
        cleanup();
        // console.log(`Canvas drawing failed: ${error}, using fallback`);
        // Fallback: change mime type to PNG
        const fallbackBlob = new Blob([blob], { type: 'image/png' });
        resolve(fallbackBlob);
      }
    };

    img.onerror = () => {
      cleanup();
      // console.log('Image load failed, using fallback approach');
      // Fallback: change mime type to PNG
      const fallbackBlob = new Blob([blob], { type: 'image/png' });
      resolve(fallbackBlob);
    };

    try {
      // Create object URL from blob
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;

      // Timeout fallback
      setTimeout(() => {
        if (!img.complete) {
          cleanup();
          // console.log('Image load timeout, using fallback');
          const fallbackBlob = new Blob([blob], { type: 'image/png' });
          resolve(fallbackBlob);
        }
      }, 5000);

    } catch (error) {
      // console.log(`Object URL creation failed: ${error}, using fallback`);
      const fallbackBlob = new Blob([blob], { type: 'image/png' });
      resolve(fallbackBlob);
    }
  });
}

// Verify that image data is actually in clipboard
function verifyClipboardContent(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      // console.log('Clipboard read API not available');
      resolve(false);
      return;
    }

    navigator.clipboard.read()
      .then((items) => {
        // console.log('Clipboard items found:', items.length);

        for (const item of items) {
          // console.log('Clipboard item types:', item.types);

          // Check if any item contains image data
          const hasImageType = item.types.some(type => type.startsWith('image/'));
          if (hasImageType) {
            // console.log('Image type found in clipboard');
            resolve(true);
            return;
          }
        }

        // console.log('No image types found in clipboard');
        resolve(false);
      })
      .catch(() => {
        // console.log('Clipboard read failed:', error.message);
        // If we can't read clipboard, assume success to avoid false negatives
        resolve(true);
      });
  });
}

// Show success message
function showSuccessMessage(): void {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 999999;
    font-size: 14px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  popup.textContent = '画像をクリップボードにコピーしました';
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      popup.remove();
      style.remove();
    }, 300);
  }, 3000);
}

// Error types for better categorization
type ErrorType = 'SHARING_PERMISSION' | 'NETWORK_ERROR' | 'CLIPBOARD_ERROR' | 'IMAGE_NOT_FOUND' | 'GENERAL_ERROR';

interface ErrorInfo {
  type: ErrorType;
  message: string;
  details: string;
  solution: string;
  canRetry: boolean;
}

// Get error type based on error message
function getErrorType(error: string): ErrorType {
  if (error.includes('403') || error.includes('Forbidden') || error.includes('unauthorized')) {
    return 'SHARING_PERMISSION';
  }
  if (error.includes('network') || error.includes('fetch') || error.includes('HTTP')) {
    return 'NETWORK_ERROR';
  }
  if (error.includes('clipboard') || error.includes('Clipboard')) {
    return 'CLIPBOARD_ERROR';
  }
  if (error.includes('not found') || error.includes('見つかりません')) {
    return 'IMAGE_NOT_FOUND';
  }
  return 'GENERAL_ERROR';
}

// Get detailed error information
function getErrorInfo(errorMessage: string): ErrorInfo {
  const errorType = getErrorType(errorMessage);

  switch (errorType) {
    case 'SHARING_PERMISSION':
      return {
        type: 'SHARING_PERMISSION',
        message: '共有設定エラー',
        details: 'この画像はプライベート設定のため、コピーできません。',
        solution: '画像の共有設定を「リンクを知っている全員が閲覧可」に変更してください。',
        canRetry: false
      };

    case 'NETWORK_ERROR':
      return {
        type: 'NETWORK_ERROR',
        message: 'ネットワークエラー',
        details: 'インターネット接続またはサーバーに問題があります。',
        solution: 'ネットワーク接続を確認して、もう一度お試しください。それでも失敗する場合は、画像の共有設定を「リンクを知っている全員が閲覧可」に変更してください。',
        canRetry: true
      };

    case 'CLIPBOARD_ERROR':
      return {
        type: 'CLIPBOARD_ERROR',
        message: 'クリップボード権限エラー',
        details: 'ブラウザのクリップボード権限が無効になっています。',
        solution: 'chrome://settings/content/clipboard でGoogle Driveを「許可」に設定してください。また、画像の共有設定が「リンクを知っている全員が閲覧可」になっているかも確認してください。',
        canRetry: true
      };

    case 'IMAGE_NOT_FOUND':
      return {
        type: 'IMAGE_NOT_FOUND',
        message: '画像が見つかりません',
        details: '選択された画像を読み込めませんでした。',
        solution: 'ページを再読み込みするか、別の画像をお試しください。または、画像の共有設定を「リンクを知っている全員が閲覧可」に変更してください。',
        canRetry: true
      };

    default:
      return {
        type: 'GENERAL_ERROR',
        message: 'コピーに失敗しました',
        details: '予期しないエラーが発生しました。',
        solution: '手動でのコピーをお試しください。また、画像の共有設定を「リンクを知っている全員が閲覧可」に変更することで解決する場合があります。',
        canRetry: true
      };
  }
}

// Show improved error message with detailed information and actions
function showImprovedErrorMessage(errorMessage: string, imageUrl?: string): void {
  const errorInfo = getErrorInfo(errorMessage);

  // Remove any existing error popups
  const existingError = document.querySelector('.gdrive-error-popup');
  if (existingError) {
    existingError.remove();
  }

  const popup = document.createElement('div');
  popup.className = 'gdrive-error-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #f44336;
    border-radius: 12px;
    padding: 24px;
    z-index: 999999;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    max-width: 450px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    animation: errorSlideIn 0.3s ease-out;
  `;

  // Add error animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes errorSlideIn {
      from {
        opacity: 0;
        transform: translate(-50%, -60%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    @keyframes errorShake {
      0%, 100% { transform: translate(-50%, -50%) translateX(0); }
      25% { transform: translate(-50%, -50%) translateX(-5px); }
      75% { transform: translate(-50%, -50%) translateX(5px); }
    }
  `;
  document.head.appendChild(style);

  // Error icon based on type
  const getErrorIcon = (type: ErrorType): string => {
    switch (type) {
      case 'SHARING_PERMISSION': return '🔒';
      case 'NETWORK_ERROR': return '🌐';
      case 'CLIPBOARD_ERROR': return '📋';
      case 'IMAGE_NOT_FOUND': return '🖼️';
      default: return '⚠️';
    }
  };

  popup.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
      <span style="font-size: 24px; margin-right: 12px;">${getErrorIcon(errorInfo.type)}</span>
      <h3 style="margin: 0; color: #f44336; font-size: 18px;">${errorInfo.message}</h3>
    </div>

    <div style="margin-bottom: 16px; color: #5f6368; font-size: 14px; line-height: 1.5;">
      ${errorInfo.details}
    </div>

    <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #1a73e8;">
      <div style="font-weight: 500; color: #1a73e8; margin-bottom: 4px;">💡 解決方法:</div>
      <div style="color: #5f6368; font-size: 13px; line-height: 1.4;">
        ${errorInfo.solution}
      </div>
    </div>

    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      ${errorInfo.canRetry && imageUrl ? `
        <button id="retry-btn" style="
          background: #1a73e8;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        ">もう一度試す</button>
      ` : ''}

      ${errorInfo.type === 'SHARING_PERMISSION' ? `
        <button id="help-sharing-btn" style="
          background: #34a853;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">設定方法を見る</button>
      ` : ''}

      <button id="close-error-btn" style="
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
      ">閉じる</button>
    </div>
  `;

  document.body.appendChild(popup);

  // Add button event listeners
  const retryBtn = popup.querySelector('#retry-btn');
  if (retryBtn && imageUrl) {
    retryBtn.addEventListener('click', () => {
      popup.remove();
      style.remove();
      // console.log('Retrying image copy:', imageUrl);
      copyImageDirectly(imageUrl);
    });

    // Add hover effect
    retryBtn.addEventListener('mouseenter', () => {
      (retryBtn as HTMLElement).style.background = '#1557b0';
    });
    retryBtn.addEventListener('mouseleave', () => {
      (retryBtn as HTMLElement).style.background = '#1a73e8';
    });
  }

  const helpSharingBtn = popup.querySelector('#help-sharing-btn');
  if (helpSharingBtn) {
    helpSharingBtn.addEventListener('click', () => {
      popup.remove();
      style.remove();
      showSharingHelpDialog();
    });

    // Add hover effect
    helpSharingBtn.addEventListener('mouseenter', () => {
      (helpSharingBtn as HTMLElement).style.background = '#2d8f47';
    });
    helpSharingBtn.addEventListener('mouseleave', () => {
      (helpSharingBtn as HTMLElement).style.background = '#34a853';
    });
  }

  const closeBtn = popup.querySelector('#close-error-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      popup.style.animation = 'errorSlideIn 0.2s ease-out reverse';
      setTimeout(() => {
        popup.remove();
        style.remove();
      }, 200);
    });

    // Add hover effect
    closeBtn.addEventListener('mouseenter', () => {
      (closeBtn as HTMLElement).style.background = '#f1f3f4';
    });
    closeBtn.addEventListener('mouseleave', () => {
      (closeBtn as HTMLElement).style.background = '#f8f9fa';
    });
  }

  // Auto-close after 10 seconds (except for sharing permission errors)
  if (errorInfo.type !== 'SHARING_PERMISSION') {
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.animation = 'errorSlideIn 0.2s ease-out reverse';
        setTimeout(() => {
          popup.remove();
          style.remove();
        }, 200);
      }
    }, 10000);
  }
}

// Show sharing help dialog
function showSharingHelpDialog(): void {
  const helpDialog = document.createElement('div');
  helpDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #1a73e8;
    border-radius: 12px;
    padding: 24px;
    z-index: 999999;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;

  helpDialog.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <span style="font-size: 24px; margin-right: 12px;">🔧</span>
      <h3 style="margin: 0; color: #1a73e8; font-size: 18px;">共有設定の変更方法</h3>
    </div>

    <div style="margin-bottom: 20px; color: #5f6368; font-size: 14px; line-height: 1.6;">
      画像をコピーするには、ファイルの共有設定を変更する必要があります：
    </div>

    <ol style="color: #5f6368; font-size: 14px; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
      <li>Google Driveで画像ファイルを右クリック</li>
      <li>「共有」をクリック</li>
      <li>「制限付き」をクリック</li>
      <li>「リンクを知っている全員」を選択</li>
      <li>「閲覧者」権限を選択</li>
      <li>「完了」をクリック</li>
    </ol>

    <div style="padding: 12px; background: #e8f0fe; border-radius: 8px; margin-bottom: 20px;">
      <div style="color: #1a73e8; font-weight: 500; margin-bottom: 4px;">📍 確認方法:</div>
      <div style="color: #5f6368; font-size: 13px;">
        ファイル名の下に🔗アイコンまたは🌍アイコンが表示されていればOKです
      </div>
    </div>

    <div style="text-align: right;">
      <button id="help-close-btn" style="
        background: #1a73e8;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">理解しました</button>
    </div>
  `;

  document.body.appendChild(helpDialog);

  const closeBtn = helpDialog.querySelector('#help-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      helpDialog.remove();
    });
  }
}

// Legacy function for backward compatibility
function showErrorMessage(message: string): void {
  showImprovedErrorMessage(message);
}

// Initialize context menu state on page load
function initializeContextMenu() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(updateContextMenu, 1000);
    });
  } else {
    setTimeout(updateContextMenu, 1000);
  }

  // Monitor DOM changes for dynamic content
  const observer = new MutationObserver(() => {
    // Debounce the update to avoid excessive calls
    clearTimeout(contextMenuUpdateTimeout);
    contextMenuUpdateTimeout = setTimeout(updateContextMenu, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class']
  });
}

// Start monitoring
initializeContextMenu();

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  extensionValid = false;
  if (customMenu) {
    customMenu.remove();
  }
  // Remove context menu when leaving page
  if (menuCreated) {
    safeSendMessage({ action: 'removeContextMenu' }).catch(() => {
      // Ignore errors
    });
  }
});