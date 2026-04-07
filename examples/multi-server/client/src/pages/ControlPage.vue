<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info';
}

// ── Route ──────────────────────────────────────────────────────────────────────

const route = useRoute();
const router = useRouter();
const instanceId = computed(() => route.params.id as string);

// ── Auth state ─────────────────────────────────────────────────────────────────

const secretKey = `ba-secret-${instanceId.value}`;
const secret = ref(sessionStorage.getItem(secretKey) ?? '');
const authenticated = ref(!!secret.value);
const secretInput = ref('');
const authError = ref('');
const authLoading = ref(false);

async function handleAuth() {
  if (!secretInput.value.trim()) return;
  authLoading.value = true;
  authError.value = '';
  try {
    const res = await fetch(`/api/instances/${instanceId.value}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretInput.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      authError.value = '密钥错误，请重试';
      return;
    }
    secret.value = secretInput.value.trim();
    sessionStorage.setItem(secretKey, secret.value);
    authenticated.value = true;
    await init();
  } catch {
    authError.value = '验证失败，请检查网络连接';
  } finally {
    authLoading.value = false;
  }
}

function logout() {
  sessionStorage.removeItem(secretKey);
  secret.value = '';
  authenticated.value = false;
  secretInput.value = '';
}

// ── API helper ─────────────────────────────────────────────────────────────────

async function api(endpoint: string, options: { method?: string; body?: Record<string, unknown> } = {}) {
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const res = await fetch(`/api/instances/${instanceId.value}/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Secret': secret.value,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Authentication failed');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// ── Browser state ──────────────────────────────────────────────────────────────

const connected = ref(false);
const tabs = ref<TabInfo[]>([]);
const selectedTabId = ref<number | null>(null);
const urlInput = ref('');
const screenshotSrc = ref('');
const screenshotWidth = ref(0);
const screenshotHeight = ref(0);
const isLoading = ref(false);
const toolbarInfo = ref('Ready');

// Auto-refresh
const autoRefresh = ref(false);
const refreshInterval = ref('2000');
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let statusTimer: ReturnType<typeof setInterval> | null = null;

// Keyboard input
const inputMode = ref<'type' | 'key'>('type');
const textInput = ref('');
const specialKeys = [
  { key: 'Enter', label: 'Enter' },
  { key: 'Escape', label: 'Esc' },
  { key: 'Backspace', label: '⌫' },
  { key: 'Tab', label: 'Tab' },
  { key: 'ArrowUp', label: '↑' },
  { key: 'ArrowDown', label: '↓' },
  { key: 'ArrowLeft', label: '←' },
  { key: 'ArrowRight', label: '→' },
  { key: 'Home', label: 'Home' },
  { key: 'End', label: 'End' },
  { key: 'PageUp', label: 'PgUp' },
  { key: 'PageDown', label: 'PgDn' },
];

// Screenshot
const screenshotImg = ref<HTMLImageElement | null>(null);
const contentArea = ref<HTMLElement | null>(null);
const cursorInfo = ref<{ x: number; y: number; px: number; py: number } | null>(null);
let lastScrollTargetSelector: string | null = null;

// Toast
const toasts = ref<Toast[]>([]);
let toastId = 0;

function toast(msg: string, type: Toast['type'] = 'info') {
  const id = toastId++;
  toasts.value.push({ id, msg, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3000);
}

// ── Status polling ─────────────────────────────────────────────────────────────

async function pollStatus() {
  try {
    const s = await api('status');
    connected.value = s.connected;
    if (s.connected && tabs.value.length === 0) {
      await refreshTabs();
    }
  } catch {
    connected.value = false;
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

async function refreshTabs() {
  try {
    const result = await api('tabs');
    tabs.value = result.tabs ?? [];
    if (!selectedTabId.value || !tabs.value.find((t) => t.id === selectedTabId.value)) {
      const active = tabs.value.find((t) => t.active) ?? tabs.value[0];
      if (active) await selectTab(active.id, false);
    }
  } catch (e: any) {
    toast('获取标签页失败: ' + e.message, 'error');
  }
}

async function selectTab(tabId: number, activate = true) {
  selectedTabId.value = tabId;
  const tab = tabs.value.find((t) => t.id === tabId);
  if (tab) urlInput.value = tab.url;
  if (activate) {
    try {
      await api('activateTab', { body: { tabId } });
    } catch (e: any) {
      toast('切换标签页失败: ' + e.message, 'error');
    }
  }
  await takeScreenshot();
}

async function closeTab(tabId: number) {
  try {
    await api('closeTab', { body: { tabId } });
    toast('标签页已关闭', 'success');
    await refreshTabs();
  } catch (e: any) {
    toast('关闭标签页失败: ' + e.message, 'error');
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────

async function navigateTo(url: string) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
    urlInput.value = url;
  }
  isLoading.value = true;
  toolbarInfo.value = '导航到 ' + url + '...';
  try {
    const result = await api('navigate', { body: { url, waitForLoad: true } });
    if (result.tabId) selectedTabId.value = result.tabId;
    toast('已导航: ' + (result.title ?? url), 'success');
    await refreshTabs();
    await takeScreenshot();
  } catch (e: any) {
    toast('导航失败: ' + e.message, 'error');
  } finally {
    isLoading.value = false;
    toolbarInfo.value = 'Ready';
  }
}

async function reloadPage() {
  if (!selectedTabId.value) return;
  isLoading.value = true;
  toolbarInfo.value = '重新加载...';
  try {
    await api('evaluate', { body: { expression: 'location.reload()', tabId: selectedTabId.value } });
    await new Promise((r) => setTimeout(r, 1500));
    await refreshTabs();
    await takeScreenshot();
  } catch (e: any) {
    toast('重新加载失败: ' + e.message, 'error');
  } finally {
    isLoading.value = false;
    toolbarInfo.value = 'Ready';
  }
}

async function goBack() {
  if (!selectedTabId.value) return;
  try {
    await api('evaluate', { body: { expression: 'history.back()', tabId: selectedTabId.value } });
    await new Promise((r) => setTimeout(r, 1000));
    await refreshTabs();
    await takeScreenshot();
  } catch (e: any) {
    toast('后退失败: ' + e.message, 'error');
  }
}

async function goForward() {
  if (!selectedTabId.value) return;
  try {
    await api('evaluate', { body: { expression: 'history.forward()', tabId: selectedTabId.value } });
    await new Promise((r) => setTimeout(r, 1000));
    await refreshTabs();
    await takeScreenshot();
  } catch (e: any) {
    toast('前进失败: ' + e.message, 'error');
  }
}

async function openNewTab() {
  const url = prompt('输入要打开的网址:', 'https://example.com');
  if (url) await navigateTo(url);
}

// ── Screenshot ─────────────────────────────────────────────────────────────────

async function takeScreenshot() {
  if (!connected.value || !selectedTabId.value) return;
  try {
    const result = await api('screenshotVisible', {
      body: { tabId: selectedTabId.value, format: 'jpeg', quality: 80 },
    });
    const fmt = result.format ?? 'jpeg';
    screenshotSrc.value = `data:image/${fmt};base64,${result.data}`;
    await screenshotImg.value?.decode().catch(() => {});
    screenshotWidth.value = result.width ?? screenshotImg.value?.naturalWidth ?? 0;
    screenshotHeight.value = result.height ?? screenshotImg.value?.naturalHeight ?? 0;
    const tab = tabs.value.find((t) => t.id === selectedTabId.value);
    if (tab) urlInput.value = tab.url;
    toolbarInfo.value = `${screenshotWidth.value}×${screenshotHeight.value} — ${new Date().toLocaleTimeString()}`;
  } catch (e: any) {
    if (!autoRefresh.value) toast('截图失败: ' + e.message, 'error');
  }
}

// ── Click simulation ───────────────────────────────────────────────────────────

function getPageCoords(e: MouseEvent) {
  const img = screenshotImg.value!;
  const rect = img.getBoundingClientRect();
  const natW = img.naturalWidth || screenshotWidth.value || rect.width;
  const natH = img.naturalHeight || screenshotHeight.value || rect.height;
  const scaleX = natW / rect.width;
  const scaleY = natH / rect.height;
  return {
    px: (e.clientX - rect.left) * scaleX,
    py: (e.clientY - rect.top) * scaleY,
    imgX: e.clientX - rect.left,
    imgY: e.clientY - rect.top,
  };
}

async function simulateClick(pageX: number, pageY: number) {
  if (!selectedTabId.value) return;
  toolbarInfo.value = `点击 (${Math.round(pageX)}, ${Math.round(pageY)})...`;
  try {
    const code = `
(function() {
  function getScrollableAncestor(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      const s = window.getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }
  function getDomPath(el) {
    if (!el) return null;
    if (el.id) return '#' + el.id;
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let name = el.nodeName.toLowerCase();
      if (el.className) name += '.' + Array.from(el.classList).join('.');
      let sib = el, idx = 1;
      while ((sib = sib.previousElementSibling)) if (sib.nodeName === el.nodeName) idx++;
      name += ':nth-of-type(' + idx + ')';
      path.unshift(name);
      el = el.parentElement;
    }
    return path.length ? path.join('>') : null;
  }
  const dpr = window.devicePixelRatio || 1;
  const x = ${Math.round(pageX)} / dpr;
  const y = ${Math.round(pageY)} / dpr;
  const el = document.elementFromPoint(x, y);
  if (!el) return { clicked: false };
  const scrollable = getScrollableAncestor(el);
  const scrollSelector = getDomPath(scrollable);
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  if (typeof el.focus === 'function') el.focus();
  const link = el.closest('a[href],button,input[type=button],input[type=submit],input[type=reset]');
  if (link) { link.click(); return { clicked: true, tag: el.tagName, navigated: link.href, scrollSelector }; }
  return { clicked: true, tag: el.tagName, text: (el.textContent || '').slice(0, 100), scrollSelector };
})()`.trim();
    const result = await api('evaluate', { body: { expression: code, tabId: selectedTabId.value } });
    if (result.result?.scrollSelector) lastScrollTargetSelector = result.result.scrollSelector;
    else lastScrollTargetSelector = null;
    if (result.result?.navigated) toast('导航到: ' + result.result.navigated, 'success');
    await new Promise((r) => setTimeout(r, 500));
    await refreshTabs();
    await takeScreenshot();
    toolbarInfo.value = 'Ready';
  } catch (e: any) {
    toast('点击失败: ' + e.message, 'error');
    toolbarInfo.value = 'Ready';
  }
}

function onImgClick(e: MouseEvent) {
  e.preventDefault();
  const { px, py } = getPageCoords(e);
  simulateClick(px, py);
}

function onImgMouseMove(e: MouseEvent) {
  if (!screenshotWidth.value) return;
  const { px, py, imgX, imgY } = getPageCoords(e);
  cursorInfo.value = { x: imgX + 12, y: imgY - 24, px, py };
}

function onImgMouseLeave() {
  cursorInfo.value = null;
}

// ── Scroll ─────────────────────────────────────────────────────────────────────

let scrollThrottled = false;

async function scrollPage(deltaY: number) {
  if (!selectedTabId.value) return;
  // Pass selector via a self-invoking function argument to avoid string injection risks.
  // JSON.stringify safely escapes the selector, but using a parameter is cleaner.
  const selectorArg = lastScrollTargetSelector
    ? `document.querySelector(${JSON.stringify(lastScrollTargetSelector)})`
    : 'null';
  const code = `(function(el, dy){ if(el) el.scrollTop += dy; else window.scrollBy(0, dy); })(${selectorArg}, ${Number(deltaY)})`;
  try {
    await api('evaluate', { body: { expression: code, tabId: selectedTabId.value } });
    await takeScreenshot();
  } catch (e: any) {
    toast('滚动失败: ' + e.message, 'error');
  }
}

async function scrollToEdge(edge: 'top' | 'bottom') {
  if (!selectedTabId.value) return;
  const code =
    edge === 'top'
      ? 'window.scrollTo(0, 0)'
      : 'window.scrollTo(0, document.body.scrollHeight)';
  try {
    await api('evaluate', { body: { expression: code, tabId: selectedTabId.value } });
    await takeScreenshot();
  } catch (e: any) {
    toast('滚动失败: ' + e.message, 'error');
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (scrollThrottled || !selectedTabId.value) return;
  scrollThrottled = true;
  scrollPage(Math.round(e.deltaY)).finally(() => { scrollThrottled = false; });
}

// ── Keyboard input ─────────────────────────────────────────────────────────────

async function sendText() {
  if (!selectedTabId.value || !textInput.value) return;
  const escaped = JSON.stringify(textInput.value);
  const code = `
(function(){
  const el = document.activeElement;
  if (!el) return { typed: false };
  const text = ${escaped};
  if (el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return { typed: true };
  }
  if ('value' in el) {
    const s = el.selectionStart || el.value.length;
    const end = el.selectionEnd || el.value.length;
    el.value = el.value.slice(0, s) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = s + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { typed: true };
  }
  return { typed: false };
})()`.trim();
  try {
    await api('evaluate', { body: { expression: code, tabId: selectedTabId.value } });
    textInput.value = '';
    await takeScreenshot();
  } catch (e: any) {
    toast('输入失败: ' + e.message, 'error');
  }
}

async function sendKey(keyName: string) {
  if (!selectedTabId.value) return;
  const code = `
(function(){
  const el = document.activeElement || document.body;
  const opts = { key: ${JSON.stringify(keyName)}, code: ${JSON.stringify(keyName)}, bubbles: true, cancelable: true };
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup', opts));
})()`.trim();
  try {
    await api('evaluate', { body: { expression: code, tabId: selectedTabId.value } });
    await new Promise((r) => setTimeout(r, 300));
    await takeScreenshot();
  } catch (e: any) {
    toast('按键失败: ' + e.message, 'error');
  }
}

// ── Auto-refresh ───────────────────────────────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  if (!autoRefresh.value) return;
  const interval = parseInt(refreshInterval.value, 10);
  refreshTimer = setInterval(() => {
    if (connected.value && selectedTabId.value && !isLoading.value) takeScreenshot();
  }, interval);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function getFavicon(url: string) {
  try {
    return `https://www.google.com/s2/favicons?sz=16&domain=${new URL(url).hostname}`;
  } catch {
    return '';
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

async function init() {
  await pollStatus();
  statusTimer = setInterval(pollStatus, 3000);
}

onMounted(async () => {
  if (authenticated.value) await init();
});

onUnmounted(() => {
  stopAutoRefresh();
  if (statusTimer) clearInterval(statusTimer);
});
</script>

<template>
  <!-- ── Auth gate ─────────────────────────────────────────── -->
  <div
    v-if="!authenticated"
    class="min-h-screen bg-[#0f1117] flex items-center justify-center"
  >
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🔒</div>
        <h1 class="text-xl font-bold text-[#e1e4eb]">控制页面访问验证</h1>
        <p class="text-sm text-[#8b8fa3] mt-1">请输入实例密钥以继续</p>
      </div>
      <form
        class="bg-[#1a1d27] border border-[#2a2e3a] rounded-xl p-6 space-y-4"
        @submit.prevent="handleAuth"
      >
        <div>
          <label class="block text-sm text-[#8b8fa3] mb-1">密钥</label>
          <input
            v-model="secretInput"
            type="password"
            placeholder="输入实例密钥"
            autofocus
            class="w-full bg-[#0f1117] border border-[#2a2e3a] rounded-lg px-3 py-2.5 text-sm text-[#e1e4eb] font-mono outline-none focus:border-[#6c8cff] transition-colors"
          />
        </div>
        <p v-if="authError" class="text-sm text-[#f87171]">{{ authError }}</p>
        <button
          type="submit"
          :disabled="authLoading || !secretInput"
          class="w-full py-2.5 bg-[#6c8cff] hover:bg-[#5a7aee] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {{ authLoading ? '验证中…' : '进入控制台' }}
        </button>
        <button
          type="button"
          class="w-full py-2 text-sm text-[#8b8fa3] hover:text-[#e1e4eb] transition-colors"
          @click="router.push('/')"
        >
          ← 返回首页
        </button>
      </form>
    </div>
  </div>

  <!-- ── Main browser control panel ──────────────────────── -->
  <div
    v-else
    class="flex flex-col h-screen bg-[#11111b] text-[#cdd6f4] overflow-hidden"
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  >
    <!-- Tab bar -->
    <div class="flex items-center bg-[#181825] border-b border-[#313244] min-h-10 flex-shrink-0">
      <div class="flex flex-1 overflow-x-auto pt-1.5 pb-0 px-1.5 gap-0.5 scrollbar-none">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[220px] border border-transparent rounded-t-lg cursor-pointer text-xs transition-colors relative',
            tab.id === selectedTabId
              ? 'bg-[#313244] text-[#cdd6f4] border-[#313244]'
              : 'bg-[#1e1e2e] text-[#6c7086] hover:bg-[#282838]',
          ]"
          :title="tab.url"
          @click="selectTab(tab.id)"
        >
          <img
            :src="getFavicon(tab.url)"
            class="w-3.5 h-3.5 rounded flex-shrink-0"
            @error="($event.target as HTMLImageElement).style.display='none'"
          />
          <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {{ tab.title || 'Untitled' }}
          </span>
          <button
            class="w-4.5 h-4.5 flex items-center justify-center rounded hover:bg-red-500/20 hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 transition-all text-sm"
            style="opacity: 0; transition: opacity .15s"
            @mouseenter="($event.target as HTMLElement).style.opacity = '1'"
            @mouseleave="($event.target as HTMLElement).style.opacity = '0'"
            @click.stop="closeTab(tab.id)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="flex items-center gap-1 px-2 flex-shrink-0">
        <button
          class="w-7 h-7 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded transition-colors text-base"
          title="新建标签页"
          @click="openNewTab"
        >+</button>
        <button
          class="w-7 h-7 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded transition-colors"
          title="刷新标签列表"
          @click="refreshTabs"
        >↻</button>
        <button
          class="w-7 h-7 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded transition-colors text-xs"
          title="退出登录"
          @click="logout"
        >🔓</button>
      </div>
    </div>

    <!-- Address bar -->
    <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181825] border-b border-[#313244] flex-shrink-0">
      <button
        class="w-7.5 h-7.5 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded-md transition-colors"
        title="后退"
        @click="goBack"
      >←</button>
      <button
        class="w-7.5 h-7.5 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded-md transition-colors"
        title="前进"
        @click="goForward"
      >→</button>
      <button
        class="w-7.5 h-7.5 flex items-center justify-center text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#282838] rounded-md transition-colors"
        title="重新加载"
        @click="reloadPage"
      >↺</button>
      <input
        v-model="urlInput"
        type="text"
        class="flex-1 px-3 py-1.5 bg-[#11111b] border border-[#313244] rounded-full text-[#cdd6f4] text-sm outline-none focus:border-[#89b4fa] transition-colors"
        placeholder="输入网址..."
        @keydown.enter="navigateTo(urlInput.trim())"
      />
      <div class="flex items-center gap-1.5 px-2 text-xs flex-shrink-0">
        <span
          :class="['w-2 h-2 rounded-full', connected ? 'bg-[#a6e3a1]' : 'bg-[#f38ba8]']"
        />
        <span class="text-[#6c7086]">{{ connected ? '已连接' : '未连接' }}</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-2.5 py-1 bg-[#181825] border-b border-[#313244] flex-shrink-0 text-xs text-[#6c7086]">
      <span class="flex-1 truncate">{{ toolbarInfo }}</span>
      <label class="flex items-center gap-1 cursor-pointer select-none">
        <input
          v-model="autoRefresh"
          type="checkbox"
          class="accent-[#89b4fa]"
          @change="startAutoRefresh"
        />
        自动刷新
      </label>
      <select
        v-model="refreshInterval"
        class="bg-[#11111b] border border-[#313244] text-[#cdd6f4] rounded px-1 py-0.5 text-xs"
        @change="startAutoRefresh"
      >
        <option value="1000">1s</option>
        <option value="2000">2s</option>
        <option value="5000">5s</option>
      </select>
      <button class="px-2 py-0.5 hover:bg-[#282838] rounded transition-colors" title="截图" @click="takeScreenshot">📷</button>
      <button class="px-2 py-0.5 hover:bg-[#282838] rounded transition-colors" title="向上滚动" @click="scrollPage(-300)">↑</button>
      <button class="px-2 py-0.5 hover:bg-[#282838] rounded transition-colors" title="向下滚动" @click="scrollPage(300)">↓</button>
      <button class="px-2 py-0.5 hover:bg-[#282838] rounded transition-colors" title="滚到顶部" @click="scrollToEdge('top')">⇈</button>
      <button class="px-2 py-0.5 hover:bg-[#282838] rounded transition-colors" title="滚到底部" @click="scrollToEdge('bottom')">⇊</button>
    </div>

    <!-- Content area -->
    <div
      ref="contentArea"
      class="flex-1 overflow-auto flex bg-[#11111b] relative"
    >
      <!-- Loading overlay -->
      <div
        v-show="isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 pointer-events-none"
      >
        <div class="w-8 h-8 border-2 border-[#89b4fa]/30 border-t-[#89b4fa] rounded-full animate-spin" />
      </div>

      <!-- Placeholder when no screenshot -->
      <div
        v-if="!screenshotSrc"
        class="flex flex-col items-center justify-center gap-4 m-auto text-[#6c7086]"
      >
        <span class="text-5xl opacity-30">🌐</span>
        <span class="text-sm">
          {{ connected ? '点击「截图」按钮捕获当前页面' : '等待扩展连接…' }}
        </span>
        <button
          v-if="connected"
          class="px-4 py-2 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] rounded-lg text-sm transition-colors"
          @click="takeScreenshot"
        >
          截图
        </button>
      </div>

      <!-- Screenshot viewer -->
      <div
        v-else
        class="relative inline-block cursor-crosshair m-auto"
        @wheel.prevent="onWheel"
      >
        <img
          ref="screenshotImg"
          :src="screenshotSrc"
          class="block max-w-full max-h-full object-contain select-none"
          draggable="false"
          @click="onImgClick"
          @mousemove="onImgMouseMove"
          @mouseleave="onImgMouseLeave"
        />
        <!-- Cursor tooltip -->
        <div
          v-if="cursorInfo"
          class="absolute pointer-events-none bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono"
          :style="{ left: cursorInfo.x + 'px', top: cursorInfo.y + 'px' }"
        >
          {{ Math.round(cursorInfo.px) }}, {{ Math.round(cursorInfo.py) }}
        </div>
      </div>
    </div>

    <!-- Input panel -->
    <div class="flex-shrink-0 bg-[#181825] border-t border-[#313244] px-3 py-2">
      <div class="flex items-center gap-2 mb-2">
        <button
          :class="[
            'px-3 py-1 text-xs rounded transition-colors',
            inputMode === 'type' ? 'bg-[#313244] text-[#cdd6f4]' : 'text-[#6c7086] hover:text-[#cdd6f4]',
          ]"
          @click="inputMode = 'type'"
        >
          文字输入
        </button>
        <button
          :class="[
            'px-3 py-1 text-xs rounded transition-colors',
            inputMode === 'key' ? 'bg-[#313244] text-[#cdd6f4]' : 'text-[#6c7086] hover:text-[#cdd6f4]',
          ]"
          @click="inputMode = 'key'"
        >
          快捷键
        </button>
      </div>

      <div v-if="inputMode === 'type'" class="flex gap-2">
        <input
          v-model="textInput"
          type="text"
          placeholder="输入文字发送到浏览器焦点元素..."
          class="flex-1 bg-[#11111b] border border-[#313244] rounded-lg px-3 py-1.5 text-sm text-[#cdd6f4] outline-none focus:border-[#89b4fa] transition-colors"
          @keydown.enter="sendText"
        />
        <button
          class="px-4 py-1.5 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] text-sm rounded-lg transition-colors"
          @click="sendText"
        >
          发送
        </button>
      </div>

      <div v-else class="flex flex-wrap gap-1.5">
        <button
          v-for="k in specialKeys"
          :key="k.key"
          class="px-2.5 py-1 text-xs bg-[#313244] hover:bg-[#414558] text-[#cdd6f4] rounded transition-colors font-mono"
          @click="sendKey(k.key)"
        >
          {{ k.label }}
        </button>
      </div>
    </div>

    <!-- Toast notifications -->
    <div class="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
      <transition-group name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[
            'px-4 py-2.5 rounded-lg text-sm shadow-lg max-w-xs',
            t.type === 'success' ? 'bg-[#a6e3a1]/20 border border-[#a6e3a1]/40 text-[#a6e3a1]'
            : t.type === 'error' ? 'bg-[#f38ba8]/20 border border-[#f38ba8]/40 text-[#f38ba8]'
            : 'bg-[#89b4fa]/20 border border-[#89b4fa]/40 text-[#89b4fa]',
          ]"
        >
          {{ t.msg }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { scrollbar-width: none; }

.toast-enter-active,
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
