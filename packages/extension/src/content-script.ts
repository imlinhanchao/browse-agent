/**
 * Content script injected into all pages.
 * Provides a message bridge between the extension and page context.
 */

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ping') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
    });
    return false;
  }

  return false;
});
