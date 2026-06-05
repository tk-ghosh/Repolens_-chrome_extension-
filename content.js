// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getRepoInfo') {
    const match = window.location.href.match(/github\.com\/([^/]+)\/([^/?#]+)/);
    if (match) {
      sendResponse({ owner: match[1], repo: match[2].replace(/\/?$/, '') });
    } else {
      sendResponse(null);
    }
  }
  return true;
});
