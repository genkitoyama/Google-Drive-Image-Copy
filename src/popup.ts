document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const currentTab = tabs[0];
    const statusIcon = document.querySelector('.status-icon') as HTMLElement;
    const statusText = document.querySelector('.status strong') as HTMLElement;
    const copyButton = document.getElementById('copyButton') as HTMLButtonElement;

    if (currentTab.url && currentTab.url.includes('drive.google.com')) {
      statusIcon.style.background = '#4CAF50';
      statusText.textContent = '拡張機能は有効です';
      copyButton.disabled = false;
    } else {
      statusIcon.style.background = '#FFC107';
      statusIcon.style.animation = 'none';
      statusText.textContent = 'Google Driveを開いてください';
      copyButton.disabled = true;
      copyButton.style.opacity = '0.5';
    }

    // Copy button click handler
    copyButton.addEventListener('click', async () => {
      try {
        // Get the stored image URL from content script
        const response = await chrome.tabs.sendMessage(currentTab.id!, { action: 'getImageUrl' });
        if (response?.url) {
          // Send copy request to background script
          chrome.runtime.sendMessage({
            action: 'copyImage',
            url: response.url
          });

          // Visual feedback
          copyButton.textContent = '✅ コピーしました！';
          copyButton.style.background = '#4CAF50';
          copyButton.style.color = 'white';

          setTimeout(() => {
            copyButton.textContent = '🖼️ 最後にクリックした画像をコピー';
            copyButton.style.background = 'white';
            copyButton.style.color = '#667eea';
          }, 2000);
        } else {
          copyButton.textContent = '❌ 画像を選択してください';
          setTimeout(() => {
            copyButton.textContent = '🖼️ 最後にクリックした画像をコピー';
          }, 2000);
        }
      } catch (error) {
        console.error('Copy failed:', error);
        copyButton.textContent = '❌ エラーが発生しました';
        setTimeout(() => {
          copyButton.textContent = '🖼️ 最後にクリックした画像をコピー';
        }, 2000);
      }
    });
  });
});