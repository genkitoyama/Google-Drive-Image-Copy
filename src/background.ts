let currentImageUrl: string | null = null;

console.log('Google Drive Image Copy Extension: Background script loaded');

// Create context menu on install and startup
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "copyGDriveImage",
      title: "画像をクリップボードにコピー",
      contexts: ["all"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Context menu creation failed:', chrome.runtime.lastError);
      } else {
        console.log('Context menu created successfully');
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  createContextMenu();
});

// Also create on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  createContextMenu();
});

chrome.runtime.onMessage.addListener(async (request, sender, _sendResponse) => {
  console.log('Background received message:', request.action, request.url);

  if (request.action === 'setImageUrl') {
    currentImageUrl = request.url;
    console.log('Image URL stored:', currentImageUrl);
  } else if (request.action === 'copyImage' && request.url) {
    // Direct copy request from keyboard shortcut or custom menu
    if (sender.tab?.id) {
      console.log('Direct copy request for:', request.url);
      try {
        await copyImageToClipboard(request.url, sender.tab.id);
        console.log('Copy operation completed successfully');
      } catch (error) {
        console.error('Copy operation failed:', error);
      }
    } else {
      console.error('No tab ID available for copy operation');
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "copyGDriveImage" && tab?.id) {
    let imageUrl = info.srcUrl || currentImageUrl;

    if (!imageUrl) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getImageUrl' });
        imageUrl = response?.url;
      } catch (error) {
        console.error('Failed to get image URL:', error);
      }
    }

    if (imageUrl) {
      await copyImageToClipboard(imageUrl, tab.id);
    } else {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: '画像が見つかりませんでした'
      });
    }
  }
});

async function copyImageToClipboard(imageUrl: string, tabId: number): Promise<void> {
  console.log('Starting copy operation for URL:', imageUrl);

  try {
    // Use content script to fetch the image from within the page context
    console.log('Delegating image fetch to content script...');

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: fetchAndCopyImageInPage,
      args: [imageUrl]
    });

    console.log('Content script execution completed');
  } catch (error) {
    console.error('Failed to copy image:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: `画像のコピーに失敗しました: ${error}`
    });
  }
}

// Self-contained function to copy image in page context
function fetchAndCopyImageInPage(imageUrl: string): void {
  console.log('fetchAndCopyImageInPage called with URL:', imageUrl);

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

    // Show error message (inline function)
    const errorPopup = document.createElement('div');
    errorPopup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 999999;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    errorPopup.textContent = '画像が見つかりませんでした';
    document.body.appendChild(errorPopup);

    setTimeout(() => {
      errorPopup.remove();
    }, 3000);
    return;
  }

  console.log('Found target image element:', targetImage);

  // Try selection copy first (inline)
  const trySelectionCopy = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const selection = window.getSelection();
        if (!selection) {
          reject(new Error('No selection API'));
          return;
        }

        const range = document.createRange();
        range.selectNode(targetImage);
        selection.removeAllRanges();
        selection.addRange(range);

        const copyResult = document.execCommand('copy');
        selection.removeAllRanges();

        if (copyResult) {
          resolve();
        } else {
          reject(new Error('execCommand failed'));
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  // Show success notification (inline)
  const showSuccess = () => {
    const successPopup = document.createElement('div');
    successPopup.style.cssText = `
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

    successPopup.textContent = '画像をクリップボードにコピーしました';
    document.body.appendChild(successPopup);

    setTimeout(() => {
      successPopup.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        successPopup.remove();
        style.remove();
      }, 300);
    }, 3000);
  };

  // Show copy instructions (inline)
  const showInstructions = () => {
    // Highlight the image temporarily
    const originalBorder = targetImage.style.border;
    const originalBoxShadow = targetImage.style.boxShadow;

    targetImage.style.border = '3px solid #4CAF50';
    targetImage.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';

    // Create instruction popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 20px;
      z-index: 999999;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    popup.innerHTML = `
      <div style="margin-bottom: 15px; font-size: 18px; color: #4CAF50;">
        ✓ 画像を選択しました
      </div>
      <div style="margin-bottom: 15px; font-size: 14px; color: #333;">
        緑色の枠で囲まれた画像を<br>
        <strong>右クリック</strong> → <strong>"画像をコピー"</strong>
      </div>
      <button id="copy-done-btn" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">
        OK
      </button>
    `;

    document.body.appendChild(popup);

    // Handle OK button click
    const okButton = popup.querySelector('#copy-done-btn');
    if (okButton) {
      okButton.addEventListener('click', () => {
        targetImage.style.border = originalBorder;
        targetImage.style.boxShadow = originalBoxShadow;
        popup.remove();
      });
    }

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        targetImage.style.border = originalBorder;
        targetImage.style.boxShadow = originalBoxShadow;
        popup.remove();
      }
    }, 10000);
  };

  // Try automatic copy first, fall back to instructions
  if (navigator.userAgent.includes('Chrome')) {
    // Chrome users: show instructions directly
    showInstructions();
  } else {
    // Other browsers: try automatic copy first
    trySelectionCopy()
      .then(() => {
        console.log('Selection copy successful');
        showSuccess();
      })
      .catch(() => {
        console.log('Selection copy failed, showing instructions');
        showInstructions();
      });
  }
}

function showSuccessNotification(): void {
  const notification = document.createElement('div');
  notification.textContent = '画像をクリップボードにコピーしました';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
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
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 3000);
}