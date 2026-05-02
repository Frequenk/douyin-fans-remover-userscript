// ==UserScript==
// @name         抖音粉丝自动移除
// @namespace    https://github.com/frequenk
// @version      0.1.2
// @description  在网页版抖音粉丝弹窗中自动移除粉丝，支持暂停、手动执行间隔和自动跳过相互关注
// @author       Frequenk
// @license      GPL-3.0 License
// @match        *://www.douyin.com/user/self*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  // src/index.js
  (function() {
    "use strict";
    const STORAGE_KEY = "douyin-fans-remover-settings";
    const PANEL_ID = "dy-fans-remover-panel";
    const CONTAINER_SELECTOR = '[data-e2e="user-fans-container"]';
    const FOOTER_SELECTOR = '[data-e2e="user-fans-footer"]';
    const DEFAULT_SETTINGS = {
      delayMs: 0
    };
    const state = {
      running: false,
      busy: false,
      timer: null,
      settings: loadSettings(),
      status: "\u7B49\u5F85\u5F00\u59CB",
      processed: 0,
      skipped: 0
    };
    init();
    function init() {
      injectStyle();
      mountPanel();
      window.addEventListener("beforeunload", stopLoop);
    }
    function loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
          return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch (error) {
        console.warn("[\u6296\u97F3\u7C89\u4E1D\u81EA\u52A8\u79FB\u9664] \u8BFB\u53D6\u914D\u7F6E\u5931\u8D25", error);
        return { ...DEFAULT_SETTINGS };
      }
    }
    function saveSettings() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    }
    function injectStyle() {
      if (document.getElementById(`${PANEL_ID}-style`))
        return;
      const style = document.createElement("style");
      style.id = `${PANEL_ID}-style`;
      style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                top: 120px;
                right: 24px;
                z-index: 2147483647;
                width: 280px;
                padding: 14px;
                border-radius: 14px;
                background: rgba(22, 24, 35, 0.94);
                color: #fff;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
                font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                backdrop-filter: blur(10px);
            }
            #${PANEL_ID} * {
                box-sizing: border-box;
            }
            #${PANEL_ID} .dyfr-title {
                margin: 0 0 10px;
                font-size: 15px;
                font-weight: 700;
            }
            #${PANEL_ID} .dyfr-row {
                margin-bottom: 10px;
            }
            #${PANEL_ID} .dyfr-label {
                display: block;
                margin-bottom: 6px;
                color: rgba(255, 255, 255, 0.82);
            }
            #${PANEL_ID} .dyfr-actions {
                display: flex;
                gap: 8px;
            }
            #${PANEL_ID} button,
            #${PANEL_ID} input {
                width: 100%;
            }
            #${PANEL_ID} button {
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                outline: none;
                font: inherit;
                cursor: pointer;
                padding: 9px 12px;
                color: #fff;
                background: rgba(255, 255, 255, 0.12);
            }
            #${PANEL_ID} button.dyfr-primary {
                background: linear-gradient(135deg, #fe2c55, #ff6b6b);
                border-color: transparent;
            }
            #${PANEL_ID} button:disabled {
                cursor: not-allowed;
                opacity: 0.55;
            }
            #${PANEL_ID} input {
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                outline: none;
                font: inherit;
                padding: 8px 10px;
                color: #fff;
                background: rgba(255, 255, 255, 0.08);
            }
            #${PANEL_ID} input[type="number"]::-webkit-outer-spin-button,
            #${PANEL_ID} input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #${PANEL_ID} .dyfr-help {
                margin-top: 6px;
                color: rgba(255, 255, 255, 0.6);
                font-size: 12px;
            }
            #${PANEL_ID} .dyfr-status {
                padding: 8px 10px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.88);
                white-space: pre-line;
            }
        `;
      document.head.appendChild(style);
    }
    function mountPanel() {
      if (document.getElementById(PANEL_ID))
        return;
      const panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
            <div class="dyfr-title">\u6296\u97F3\u7C89\u4E1D\u81EA\u52A8\u79FB\u9664</div>
            <div class="dyfr-row">
                <div class="dyfr-actions">
                    <button type="button" class="dyfr-primary" data-action="start">\u5F00\u59CB</button>
                    <button type="button" data-action="pause">\u6682\u505C</button>
                </div>
            </div>
            <div class="dyfr-row">
                <label class="dyfr-label" for="${PANEL_ID}-delay">\u6267\u884C\u95F4\u9694</label>
                <input id="${PANEL_ID}-delay" type="number" min="0" step="0.1" placeholder="0 \u8868\u793A\u7ACB\u5373\u6267\u884C">
                <div class="dyfr-help">\u5355\u4F4D\uFF1A\u79D2\u3002\u811A\u672C\u4F1A\u81EA\u52A8\u8DF3\u8FC7\u5F53\u524D\u53EF\u89C1\u7B2C\u4E00\u9879\u4E2D\u7684\u201C\u76F8\u4E92\u5173\u6CE8\u201D\u7528\u6237\u3002</div>
            </div>
            <div class="dyfr-status" id="${PANEL_ID}-status">\u7B49\u5F85\u5F00\u59CB</div>
        `;
      document.body.appendChild(panel);
      const startButton = panel.querySelector('[data-action="start"]');
      const pauseButton = panel.querySelector('[data-action="pause"]');
      const delayInput = panel.querySelector(`#${PANEL_ID}-delay`);
      delayInput.value = String(state.settings.delayMs / 1e3);
      startButton.addEventListener("click", () => {
        state.running = true;
        setStatus("\u5DF2\u5F00\u59CB");
        renderPanel();
        scheduleNext(0);
      });
      pauseButton.addEventListener("click", () => {
        stopLoop();
        setStatus("\u5DF2\u6682\u505C");
        renderPanel();
      });
      delayInput.addEventListener("change", () => {
        const seconds = Math.max(0, Number(delayInput.value) || 0);
        state.settings.delayMs = Math.round(seconds * 1e3);
        saveSettings();
        delayInput.value = String(seconds);
        setStatus(`\u6267\u884C\u95F4\u9694\u5DF2\u8BBE\u7F6E\u4E3A ${seconds} \u79D2`);
      });
      renderPanel();
    }
    function renderPanel() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel)
        return;
      const startButton = panel.querySelector('[data-action="start"]');
      const pauseButton = panel.querySelector('[data-action="pause"]');
      const statusNode = panel.querySelector(`#${PANEL_ID}-status`);
      startButton.disabled = state.running;
      pauseButton.disabled = !state.running;
      statusNode.textContent = `${state.status}
\u5DF2\u79FB\u9664: ${state.processed} | \u5DF2\u8DF3\u8FC7: ${state.skipped}`;
    }
    function setStatus(message) {
      state.status = message;
      renderPanel();
    }
    function stopLoop() {
      state.running = false;
      state.busy = false;
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }
    function scheduleNext(delay) {
      if (!state.running)
        return;
      if (state.timer)
        clearTimeout(state.timer);
      state.timer = setTimeout(runOnce, Math.max(0, delay));
    }
    async function runOnce() {
      if (!state.running || state.busy)
        return;
      state.busy = true;
      try {
        const context = getActiveContext();
        if (!context) {
          setStatus("\u7B49\u5F85\u6253\u5F00\u201C\u7C89\u4E1D\u201D\u5F39\u7A97");
          scheduleNext(1e3);
          return;
        }
        const target = getFirstVisibleTarget(context);
        if (!target) {
          setStatus("\u5F53\u524D\u6CA1\u6709\u53EF\u5904\u7406\u7684\u7C89\u4E1D\u9879\uFF0C\u53EF\u80FD\u5DF2\u5230\u5E95\u90E8");
          scheduleNext(1e3);
          return;
        }
        const name = target.name || "\u672A\u77E5\u7528\u6237";
        if (isMutualFollowRow(target.row)) {
          const moved = scrollPastRow(context.scrollContainer, target);
          state.skipped += 1;
          setStatus(moved ? `\u8DF3\u8FC7\u76F8\u4E92\u5173\u6CE8\uFF1A${name}` : `\u76F8\u4E92\u5173\u6CE8\u547D\u4E2D\u4F46\u65E0\u6CD5\u7EE7\u7EED\u6EDA\u52A8\uFF1A${name}`);
          scheduleNext(moved ? Math.max(120, state.settings.delayMs) : 1e3);
          return;
        }
        setStatus(`\u51C6\u5907\u79FB\u9664\uFF1A${name}`);
        const armed = await ensureConfirmVisible(target.removeButton, target.row);
        if (!armed) {
          setStatus(`\u672A\u627E\u5230\u786E\u8BA4\u6309\u94AE\uFF1A${name}`);
          scheduleNext(800);
          return;
        }
        const confirmButton = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
        if (!confirmButton) {
          setStatus(`\u786E\u8BA4\u6309\u94AE\u4E0D\u53EF\u89C1\uFF1A${name}`);
          scheduleNext(800);
          return;
        }
        safeClick(confirmButton);
        state.processed += 1;
        setStatus(`\u5DF2\u79FB\u9664\uFF1A${name}`);
        await sleep(350);
        scheduleNext(state.settings.delayMs);
      } catch (error) {
        console.error("[\u6296\u97F3\u7C89\u4E1D\u81EA\u52A8\u79FB\u9664] \u6267\u884C\u5931\u8D25", error);
        setStatus(`\u6267\u884C\u5F02\u5E38\uFF1A${error.message || error}`);
        scheduleNext(1200);
      } finally {
        state.busy = false;
      }
    }
    function getActiveContext() {
      const container = document.querySelector(CONTAINER_SELECTOR);
      const footer = document.querySelector(FOOTER_SELECTOR);
      if (!container || !footer || !isVisible(container))
        return null;
      const scrollContainer = findScrollContainer(container);
      return {
        container,
        scrollContainer
      };
    }
    function getFirstVisibleTarget(context) {
      const rows = getRows(context.container);
      if (!rows.length)
        return null;
      const viewport = context.scrollContainer.getBoundingClientRect();
      const visibleRows = rows.map((row) => buildRowTarget(row)).filter(Boolean).filter((target) => isRowVisible(target.row, viewport)).sort((a, b) => a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top);
      return visibleRows[0] || null;
    }
    function getRows(container) {
      const directRows = Array.from(container.querySelectorAll(".i5U4dMnB")).filter((row) => findRemoveButton(row));
      if (directRows.length)
        return directRows;
      const fallbackRows = [];
      const seen = /* @__PURE__ */ new Set();
      for (const button of container.querySelectorAll("button")) {
        if (!isRemoveButton(button))
          continue;
        const row = findRowFromButton(button, container);
        if (!row || seen.has(row))
          continue;
        seen.add(row);
        fallbackRows.push(row);
      }
      return fallbackRows;
    }
    function buildRowTarget(row) {
      const removeButton = findRemoveButton(row);
      if (!removeButton)
        return null;
      return {
        row,
        removeButton,
        name: getUserName(row)
      };
    }
    function findRemoveButton(scope) {
      return Array.from(scope.querySelectorAll("button")).find((button) => isRemoveButton(button)) || null;
    }
    function isRemoveButton(button) {
      if (!button || !isVisible(button))
        return false;
      const text = normalizeText(button.innerText || button.textContent || "");
      return text.includes("\u79FB\u9664");
    }
    function findRowFromButton(button, container) {
      let node = button;
      while (node && node !== container && node !== document.body) {
        if (node.nodeType === 1) {
          const hasUserAnchor = Array.from(node.querySelectorAll('a[href*="/user/"]')).some((anchor) => normalizeText(anchor.innerText || "").length > 0);
          if (hasUserAnchor)
            return node;
        }
        node = node.parentElement;
      }
      return null;
    }
    function getUserName(row) {
      const anchors = Array.from(row.querySelectorAll('a[href*="/user/"]'));
      for (const anchor of anchors) {
        const text = normalizeText(anchor.innerText || anchor.textContent || "");
        if (text)
          return text;
      }
      const image = row.querySelector("img[alt]");
      if (image) {
        return normalizeText((image.getAttribute("alt") || "").replace(/头像$/, ""));
      }
      return "";
    }
    function findScrollContainer(container) {
      let node = container;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 20) {
          return node;
        }
        node = node.parentElement;
      }
      return container;
    }
    function isRowVisible(row, viewportRect) {
      if (!isVisible(row))
        return false;
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewportRect.top + 4 && rect.top < viewportRect.bottom - 4;
    }
    function scrollPastRow(scrollContainer, target) {
      const before = scrollContainer.scrollTop;
      const step = getScrollStep(target);
      scrollContainer.scrollBy({ top: step, behavior: "auto" });
      return scrollContainer.scrollTop !== before;
    }
    function getScrollStep(target) {
      const rect = target.row.getBoundingClientRect();
      const nextRow = getNextRow(target.row);
      if (nextRow) {
        const delta = nextRow.getBoundingClientRect().top - rect.top;
        if (delta > 30)
          return delta;
      }
      return Math.max(Math.round(rect.height || target.removeButton.getBoundingClientRect().height || 88), 60);
    }
    function getNextRow(row) {
      let next = row.nextElementSibling;
      while (next) {
        if (findRemoveButton(next))
          return next;
        next = next.nextElementSibling;
      }
      return null;
    }
    async function ensureConfirmVisible(removeButton, row) {
      const existing = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
      if (existing)
        return true;
      safeClick(removeButton);
      const confirmButton = await waitFor(() => findVisibleConfirm(row) || findVisibleConfirm(removeButton), 2500, 120);
      return Boolean(confirmButton);
    }
    function findVisibleConfirm(scope) {
      if (!scope)
        return null;
      const candidates = scope.querySelectorAll("span, div, button");
      for (const node of candidates) {
        const text = normalizeText(node.innerText || node.textContent || "");
        if (text === "\u786E\u8BA4\u79FB\u9664" && isVisible(node)) {
          return node;
        }
      }
      return null;
    }
    function safeClick(element) {
      if (!element)
        return;
      const rect = element.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
      if (typeof element.focus === "function") {
        element.focus({ preventScroll: true });
      }
      const PointerCtor = window.PointerEvent || window.MouseEvent;
      element.dispatchEvent(new PointerCtor("pointerdown", options));
      element.dispatchEvent(new MouseEvent("mousedown", options));
      element.dispatchEvent(new PointerCtor("pointerup", options));
      element.dispatchEvent(new MouseEvent("mouseup", options));
      if (typeof element.click === "function") {
        element.click();
      }
    }
    function isMutualFollowRow(row) {
      return Array.from(row.querySelectorAll("button")).some((button) => {
        const text = normalizeText(button.innerText || button.textContent || "");
        return text.includes("\u76F8\u4E92\u5173\u6CE8");
      });
    }
    function normalizeText(text) {
      return String(text || "").replace(/\s+/g, " ").trim();
    }
    function isVisible(element) {
      if (!element || !element.isConnected)
        return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function waitFor(checker, timeoutMs, intervalMs) {
      return new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
          const result = checker();
          if (result) {
            clearInterval(timer);
            resolve(result);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            clearInterval(timer);
            resolve(null);
          }
        }, intervalMs);
      });
    }
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  })();
})();
