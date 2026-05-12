// ==UserScript==
// @name         抖音粉丝自动移除
// @namespace    Violentmonkey Scripts
// @version      0.4.1
// @changelog    修复表情昵称和空白昵称粉丝在列表底部被误判为无可删目标的问题；保留按非互关阈值自动触底的策略；同步将每日上限文案更新为 2500 人；
// @description  在网页版抖音粉丝弹窗中自动移除粉丝，支持暂停、批量处理和跳过相互关注
// @author       Frequenk
// @license      GPL-3.0 License
// @match        *://www.douyin.com/user/self*
// @grant        none
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/576245/%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4.user.js
// @updateURL   https://update.greasyfork.org/scripts/576245/%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4.meta.js
// ==/UserScript==

(() => {
  // src/index.js
  (function() {
    "use strict";
    const STORAGE_KEY = "douyin-fans-remover-settings";
    const PANEL_ID = "dy-fans-remover-panel";
    const CONTAINER_SELECTOR = '[data-e2e="user-fans-container"]';
    const FOOTER_SELECTOR = '[data-e2e="user-fans-footer"]';
    const SELF_PATH_PREFIX = "/user/self";
    const DEFAULT_SETTINGS = {
      delayMs: 0,
      batchSize: 5,
      collapsed: false
    };
    const AUTO_SCROLL_THRESHOLD = 15;
    const BOTTOM_SCROLL_SETTLE_DELAY_MS = 220;
    const state = {
      running: false,
      busy: false,
      timer: null,
      settings: loadSettings(),
      status: "\u7B49\u5F85\u5F00\u59CB",
      processed: 0,
      skipped: 0,
      skippedKeys: /* @__PURE__ */ new Set()
    };
    init();
    function init() {
      injectStyle();
      mountPanelIfNeeded();
      installRouteWatcher();
      window.addEventListener("beforeunload", stopLoop);
    }
    function loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
          return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed
        };
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
                top: 50%;
                right: 24px;
                transform: translateY(-50%);
                z-index: 2147483647;
                width: 280px;
                padding: 16px;
                border-radius: 16px;
                background: rgba(22, 24, 35, 0.94);
                color: #fff;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
                font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                backdrop-filter: blur(12px);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                user-select: none;
            }
            #${PANEL_ID}.dyfr-collapsed {
                width: 48px;
                height: 48px;
                padding: 0;
                right: 12px;
                border-radius: 24px;
                cursor: pointer;
                background: linear-gradient(135deg, #fe2c55, #ff6b6b);
                box-shadow: 0 8px 24px rgba(254, 44, 85, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            #${PANEL_ID} * {
                box-sizing: border-box;
            }
            #${PANEL_ID} .dyfr-ball {
                display: none;
                color: #fff;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
            }
            #${PANEL_ID}.dyfr-collapsed .dyfr-ball {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #${PANEL_ID}.dyfr-collapsed > *:not(.dyfr-ball) {
                display: none;
            }
            #${PANEL_ID} .dyfr-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            #${PANEL_ID} .dyfr-title {
                margin: 0;
                font-size: 15px;
                font-weight: 700;
                background: linear-gradient(to right, #fff, rgba(255,255,255,0.7));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            #${PANEL_ID} .dyfr-collapse-btn {
                padding: 4px 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 6px;
                color: rgba(255, 255, 255, 0.5);
                transition: all 0.2s;
                font-size: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            #${PANEL_ID} .dyfr-collapse-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #fff;
                border-color: rgba(255, 255, 255, 0.2);
            }
            #${PANEL_ID} .dyfr-row {
                margin-bottom: 12px;
            }
            #${PANEL_ID} .dyfr-actions {
                display: flex;
                gap: 8px;
            }
            #${PANEL_ID} button {
                width: 100%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                outline: none;
                font: inherit;
                cursor: pointer;
                padding: 10px 12px;
                color: #fff;
                background: rgba(255, 255, 255, 0.08);
                transition: all 0.2s;
            }
            #${PANEL_ID} button:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.15);
            }
            #${PANEL_ID} button.dyfr-primary {
                background: linear-gradient(135deg, #fe2c55, #ff6b6b);
                border-color: transparent;
                font-weight: 600;
            }
            #${PANEL_ID} button.dyfr-primary:hover:not(:disabled) {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            #${PANEL_ID} button:disabled {
                cursor: not-allowed;
                opacity: 0.4;
            }
            #${PANEL_ID} .dyfr-help {
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.45);
                font-size: 12px;
                line-height: 1.4;
            }
            #${PANEL_ID} .dyfr-status {
                padding: 10px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.8);
                white-space: pre-line;
                font-size: 12px;
                border: 1px solid rgba(255, 255, 255, 0.03);
            }
        `;
      document.head.appendChild(style);
    }
    function mountPanelIfNeeded() {
      if (!isSelfPage()) {
        removePanel();
        return;
      }
      mountPanel();
    }
    function mountPanel() {
      if (document.getElementById(PANEL_ID))
        return;
      const panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
            <div class="dyfr-ball" title="\u5C55\u5F00\u9762\u677F">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
            </div>
            <div class="dyfr-header">
                <div class="dyfr-title">\u7C89\u4E1D\u79FB\u9664</div>
                <div class="dyfr-collapse-btn" data-action="collapse" title="\u6536\u8D77\u4E3A\u5C0F\u7403">\u6536\u8D77</div>
            </div>
            <div class="dyfr-row">
                <div class="dyfr-actions">
                    <button type="button" class="dyfr-primary" data-action="start">\u5F00\u59CB</button>
                    <button type="button" data-action="pause">\u6682\u505C</button>
                </div>
            </div>
            <div class="dyfr-status" id="${PANEL_ID}-status">\u7B49\u5F85\u5F00\u59CB</div>
            <div class="dyfr-help">\u81EA\u52A8\u8DF3\u8FC7\u201C\u76F8\u4E92\u5173\u6CE8\u201D\u3002\u5E73\u53F0\u6BCF\u5929\u4E0A\u9650\u79FB\u9664\u7EA6 2500 \u4EBA\u3002</div>
        `;
      document.body.appendChild(panel);
      const startButton = panel.querySelector('[data-action="start"]');
      const pauseButton = panel.querySelector('[data-action="pause"]');
      const collapseBtn = panel.querySelector('[data-action="collapse"]');
      startButton.addEventListener("click", (e) => {
        e.stopPropagation();
        state.running = true;
        setStatus("\u5DF2\u5F00\u59CB");
        renderPanel();
        scheduleNext(0);
      });
      pauseButton.addEventListener("click", (e) => {
        e.stopPropagation();
        stopLoop();
        setStatus("\u5DF2\u6682\u505C");
        renderPanel();
      });
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.settings.collapsed = true;
        saveSettings();
        renderPanel();
      });
      panel.addEventListener("click", () => {
        if (state.settings.collapsed) {
          state.settings.collapsed = false;
          saveSettings();
          renderPanel();
        }
      });
      renderPanel();
    }
    function removePanel() {
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        panel.remove();
      }
      stopLoop();
    }
    function renderPanel() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel)
        return;
      if (state.settings.collapsed) {
        panel.classList.add("dyfr-collapsed");
      } else {
        panel.classList.remove("dyfr-collapsed");
      }
      const startButton = panel.querySelector('[data-action="start"]');
      const pauseButton = panel.querySelector('[data-action="pause"]');
      const statusNode = panel.querySelector(`#${PANEL_ID}-status`);
      if (startButton)
        startButton.disabled = state.running;
      if (pauseButton)
        pauseButton.disabled = !state.running;
      if (statusNode) {
        statusNode.textContent = `${state.status}
\u5DF2\u79FB\u9664: ${state.processed} | \u5DF2\u8DF3\u8FC7: ${state.skipped}`;
      }
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
      if (!isSelfPage()) {
        removePanel();
        return;
      }
      if (state.timer)
        clearTimeout(state.timer);
      state.timer = setTimeout(runOnce, Math.max(0, delay));
    }
    async function runOnce() {
      if (!state.running || state.busy)
        return;
      if (!isSelfPage()) {
        removePanel();
        return;
      }
      state.busy = true;
      try {
        const context = getActiveContext();
        if (!context) {
          setStatus("\u7B49\u5F85\u6253\u5F00\u201C\u7C89\u4E1D\u201D\u5F39\u7A97");
          scheduleNext(1e3);
          return;
        }
        const reachedEnd = hasNoMoreText(context);
        const loadedTargets = getLoadedTargets(context);
        if (!loadedTargets.length) {
          const moved = reachedEnd ? false : pushScrollContainerToBottom(context.scrollContainer);
          setStatus(moved ? "\u5F53\u524D\u6CA1\u6709\u5DF2\u52A0\u8F7D\u7684\u7C89\u4E1D\u9879\uFF0C\u89E6\u53D1\u4E00\u6B21\u89E6\u5E95" : "\u5F53\u524D\u6CA1\u6709\u53EF\u5904\u7406\u7684\u7C89\u4E1D\u9879");
          scheduleNext(moved ? BOTTOM_SCROLL_SETTLE_DELAY_MS : 1e3);
          return;
        }
        const visibleTargets = getVisibleTargets(context);
        if (!visibleTargets.length) {
          setStatus(reachedEnd ? "\u5DF2\u5230\u5217\u8868\u5E95\u90E8\uFF0C\u5F53\u524D\u6CA1\u6709\u53EF\u5904\u7406\u7684\u7C89\u4E1D\u9879" : "\u5F53\u524D\u6CA1\u6709\u53EF\u5904\u7406\u7684\u7C89\u4E1D\u9879");
          scheduleNext(1e3);
          return;
        }
        const visibleMutualTargets = visibleTargets.filter((target) => isMutualFollowRow(target.row));
        const loadedRemovableCount = loadedTargets.filter((target) => !isMutualFollowRow(target.row)).length;
        if (visibleMutualTargets.length > 0) {
          state.skipped += countNewSkippedKeys(visibleMutualTargets.map((target) => target.key).filter(Boolean));
        }
        if (!reachedEnd && loadedRemovableCount < AUTO_SCROLL_THRESHOLD) {
          const moved = pushScrollContainerToBottom(context.scrollContainer);
          if (moved) {
            setStatus(`\u5F53\u524D\u5DF2\u52A0\u8F7D\u7684\u975E\u4E92\u5173\u76EE\u6807\u5C11\u4E8E ${AUTO_SCROLL_THRESHOLD} \u4E2A\uFF0C\u89E6\u53D1\u4E00\u6B21\u89E6\u5E95`);
            scheduleNext(BOTTOM_SCROLL_SETTLE_DELAY_MS);
            return;
          }
        }
        const removedNames = [];
        const batchSize = clampBatchSize(state.settings.batchSize);
        let lastFailure = null;
        const batchTargets = getBatchRemovableTargets(visibleTargets, batchSize);
        if (batchTargets.length > 0) {
          const batchResult = await removeTargetsSimultaneously(batchTargets);
          if (batchResult.removedNames.length > 0) {
            removedNames.push(...batchResult.removedNames);
            state.processed += batchResult.removedNames.length;
          }
          if (!batchResult.ok && batchResult.message) {
            lastFailure = batchResult.message;
          }
        }
        if (removedNames.length > 0) {
          const mutualText = visibleMutualTargets.length > 0 ? `\uFF1B\u5F53\u524D\u53EF\u89C1\u533A\u5DF2\u8DF3\u8FC7 ${visibleMutualTargets.length} \u4E2A\u76F8\u4E92\u5173\u6CE8` : "";
          setStatus(`\u672C\u8F6E\u5DF2\u79FB\u9664 ${removedNames.length} \u4EBA\uFF1A${removedNames.join("\u3001")}${mutualText}`);
          scheduleNext(0);
          return;
        }
        if (lastFailure) {
          setStatus(lastFailure);
          scheduleNext(800);
          return;
        }
        if (visibleMutualTargets.length > 0) {
          setStatus("\u5F53\u524D\u53EF\u89C1\u533A\u57DF\u53EA\u6709\u201C\u76F8\u4E92\u5173\u6CE8\u201D\u6216\u6CA1\u6709\u53EF\u5220\u76EE\u6807");
          scheduleNext(600);
          return;
        }
        setStatus("\u5F53\u524D\u53EF\u89C1\u533A\u57DF\u6CA1\u6709\u53EF\u79FB\u9664\u7684\u76EE\u6807");
        scheduleNext(600);
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
        footer,
        scrollContainer
      };
    }
    function getVisibleTargets(context) {
      const rows = getRows(context.container);
      if (!rows.length)
        return [];
      const viewport = context.scrollContainer.getBoundingClientRect();
      return rows.map((row) => buildRowTarget(row)).filter(Boolean).filter((target) => isRowVisible(target.row, viewport)).sort((a, b) => a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top);
    }
    function getLoadedTargets(context, includeHidden = false) {
      return getRows(context.container, includeHidden).map((row) => buildRowTarget(row, includeHidden)).filter(Boolean);
    }
    function getFirstRemovableTarget(visibleTargets) {
      return visibleTargets.find((target) => !isMutualFollowRow(target.row)) || null;
    }
    function getBatchRemovableTargets(visibleTargets, batchSize) {
      return visibleTargets.filter((target) => !isMutualFollowRow(target.row)).slice(0, batchSize);
    }
    function getRows(container, includeHidden = false) {
      const directRows = Array.from(container.querySelectorAll(".i5U4dMnB")).filter((row) => findRemoveButton(row, includeHidden));
      if (directRows.length)
        return directRows;
      const fallbackRows = [];
      const seen = /* @__PURE__ */ new Set();
      for (const button of container.querySelectorAll("button")) {
        if (!isRemoveButton(button, includeHidden))
          continue;
        const row = findRowFromButton(button, container);
        if (!row || seen.has(row))
          continue;
        seen.add(row);
        fallbackRows.push(row);
      }
      return fallbackRows;
    }
    function buildRowTarget(row, includeHidden = false) {
      const removeButton = findRemoveButton(row, includeHidden);
      if (!removeButton)
        return null;
      return {
        row,
        removeButton,
        name: getUserName(row),
        key: getUserKey(row)
      };
    }
    function findRemoveButton(scope, includeHidden = false) {
      return Array.from(scope.querySelectorAll("button")).find((button) => isRemoveButton(button, includeHidden)) || null;
    }
    function isRemoveButton(button, includeHidden = false) {
      if (!button)
        return false;
      if (!includeHidden && !isVisible(button))
        return false;
      const text = normalizeText(button.innerText || button.textContent || "");
      return text.includes("\u79FB\u9664");
    }
    function findRowFromButton(button, container) {
      let node = button;
      while (node && node !== container && node !== document.body) {
        if (node.nodeType === 1) {
          if (node.querySelector('a[href*="/user/"]'))
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
    function getUserKey(row) {
      const anchor = row.querySelector('a[href*="/user/"]');
      if (anchor) {
        const href = anchor.getAttribute("href") || anchor.href || "";
        const normalizedHref = normalizeText(href);
        if (normalizedHref)
          return normalizedHref;
      }
      return getUserName(row) || "";
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
    function pushScrollContainerToBottom(scrollContainer) {
      if (!scrollContainer)
        return false;
      const nextTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      if (nextTop <= scrollContainer.scrollTop + 1)
        return false;
      scrollContainer.scrollTo({
        top: nextTop,
        behavior: "auto"
      });
      return true;
    }
    function hasNoMoreText(context) {
      const text = normalizeText(`${context.container.innerText || ""} ${context.footer.innerText || ""}`);
      return text.includes("\u6682\u65F6\u6CA1\u6709\u66F4\u591A\u4E86");
    }
    function isRowVisible(row, viewportRect) {
      if (!isVisible(row))
        return false;
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewportRect.top + 4 && rect.top < viewportRect.bottom - 4;
    }
    async function ensureConfirmVisible(removeButton, row) {
      const existing = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
      if (existing) {
        return { ok: true, state: "confirm", confirmButton: existing };
      }
      safeClick(removeButton);
      const result = await waitFor(() => {
        const confirmButton = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
        if (confirmButton) {
          return { ok: true, state: "confirm", confirmButton };
        }
        if (isRowRemoved(row)) {
          return { ok: true, state: "removed" };
        }
        return null;
      }, 1800, 80);
      return result || { ok: false, state: "missing" };
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
    async function removeTarget(target) {
      const name = target.name || "\u672A\u77E5\u7528\u6237";
      setStatus(`\u51C6\u5907\u79FB\u9664\uFF1A${name}`);
      const prepareResult = await ensureConfirmVisible(target.removeButton, target.row);
      if (!prepareResult.ok) {
        return { ok: false, message: `\u672A\u627E\u5230\u786E\u8BA4\u6309\u94AE\uFF1A${name}` };
      }
      if (prepareResult.state === "removed") {
        return { ok: true };
      }
      const confirmButton = prepareResult.confirmButton || findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
      if (!confirmButton) {
        if (isRowRemoved(target.row)) {
          return { ok: true };
        }
        return { ok: false, message: `\u786E\u8BA4\u6309\u94AE\u4E0D\u53EF\u89C1\uFF1A${name}` };
      }
      safeClick(confirmButton);
      await waitForRowRemoval(target.row, 1200, 80);
      return { ok: true };
    }
    async function removeTargetsSimultaneously(targets) {
      const targetNames = targets.map((target) => target.name || "\u672A\u77E5\u7528\u6237");
      setStatus(`\u51C6\u5907\u540C\u65F6\u79FB\u9664\uFF1A${targetNames.join("\u3001")}`);
      const directRemoved = [];
      const pendingTargets = [];
      for (const target of targets) {
        if (isRowRemoved(target.row)) {
          directRemoved.push(target.name || "\u672A\u77E5\u7528\u6237");
          continue;
        }
        const existingConfirm = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
        if (!existingConfirm) {
          safeClick(target.removeButton);
        }
        pendingTargets.push(target);
      }
      if (pendingTargets.length > 0) {
        await sleep(160);
      }
      const preparedResults = await Promise.all(
        pendingTargets.map((target) => waitForTargetReady(target))
      );
      const removedNames = [...directRemoved];
      const confirmTargets = [];
      let lastFailure = null;
      for (const result of preparedResults) {
        if (result.state === "removed") {
          removedNames.push(result.target.name || "\u672A\u77E5\u7528\u6237");
          continue;
        }
        if (result.state === "confirm") {
          confirmTargets.push(result);
          continue;
        }
        lastFailure = `\u672A\u627E\u5230\u786E\u8BA4\u6309\u94AE\uFF1A${result.target.name || "\u672A\u77E5\u7528\u6237"}`;
      }
      for (const result of confirmTargets) {
        safeClick(result.confirmButton);
      }
      if (confirmTargets.length > 0) {
        await Promise.all(confirmTargets.map((result) => waitForRowRemoval(result.target.row, 1200, 80)));
        removedNames.push(...confirmTargets.map((result) => result.target.name || "\u672A\u77E5\u7528\u6237"));
      }
      const uniqueRemovedNames = dedupeStrings(removedNames);
      return {
        ok: uniqueRemovedNames.length > 0 || !lastFailure,
        removedNames: uniqueRemovedNames,
        message: uniqueRemovedNames.length > 0 ? null : lastFailure
      };
    }
    async function waitForTargetReady(target) {
      if (isRowRemoved(target.row)) {
        return { target, state: "removed" };
      }
      const existingConfirm = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
      if (existingConfirm) {
        return { target, state: "confirm", confirmButton: existingConfirm };
      }
      const result = await waitFor(() => {
        const confirmButton = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
        if (confirmButton) {
          return { target, state: "confirm", confirmButton };
        }
        if (isRowRemoved(target.row)) {
          return { target, state: "removed" };
        }
        return null;
      }, 900, 60);
      return result || { target, state: "missing" };
    }
    function safeClick(element) {
      if (!element)
        return;
      if (typeof element.focus === "function") {
        element.focus({ preventScroll: true });
      }
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
    function clampBatchSize(value) {
      const numeric = Number(value) || 1;
      return Math.min(5, Math.max(1, Math.round(numeric)));
    }
    function isSelfPage() {
      return window.location.pathname.startsWith(SELF_PATH_PREFIX);
    }
    function installRouteWatcher() {
      let lastHref = window.location.href;
      const handleRouteChange = () => {
        const currentHref = window.location.href;
        if (currentHref === lastHref)
          return;
        lastHref = currentHref;
        mountPanelIfNeeded();
      };
      const { pushState, replaceState } = window.history;
      window.history.pushState = function(...args) {
        const result = pushState.apply(this, args);
        queueMicrotask(handleRouteChange);
        return result;
      };
      window.history.replaceState = function(...args) {
        const result = replaceState.apply(this, args);
        queueMicrotask(handleRouteChange);
        return result;
      };
      window.addEventListener("popstate", handleRouteChange);
      setInterval(handleRouteChange, 1e3);
    }
    function countNewSkippedKeys(keys) {
      let count = 0;
      for (const key of keys) {
        if (!key || state.skippedKeys.has(key))
          continue;
        state.skippedKeys.add(key);
        count += 1;
      }
      return count;
    }
    function dedupeStrings(items) {
      const seen = /* @__PURE__ */ new Set();
      const result = [];
      for (const item of items) {
        if (!item || seen.has(item))
          continue;
        seen.add(item);
        result.push(item);
      }
      return result;
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
    async function waitForRowRemoval(row, timeoutMs, intervalMs) {
      const removed = await waitFor(() => isRowRemoved(row) ? true : null, timeoutMs, intervalMs);
      return Boolean(removed);
    }
    function isRowRemoved(row) {
      return !row || !row.isConnected || !document.contains(row);
    }
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  })();
})();
