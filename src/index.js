(function () {
    'use strict';

    const STORAGE_KEY = 'douyin-fans-remover-settings';
    const PANEL_ID = 'dy-fans-remover-panel';
    const CONTAINER_SELECTOR = '[data-e2e="user-fans-container"]';
    const FOOTER_SELECTOR = '[data-e2e="user-fans-footer"]';
    const DEFAULT_SETTINGS = {
        delayMs: 0,
    };
    const state = {
        running: false,
        busy: false,
        timer: null,
        settings: loadSettings(),
        status: '等待开始',
        processed: 0,
        skipped: 0,
    };

    init();

    function init() {
        injectStyle();
        mountPanel();
        window.addEventListener('beforeunload', stopLoop);
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch (error) {
            console.warn('[抖音粉丝自动移除] 读取配置失败', error);
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    }

    function injectStyle() {
        if (document.getElementById(`${PANEL_ID}-style`)) return;
        const style = document.createElement('style');
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
        if (document.getElementById(PANEL_ID)) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="dyfr-title">抖音粉丝自动移除</div>
            <div class="dyfr-row">
                <div class="dyfr-actions">
                    <button type="button" class="dyfr-primary" data-action="start">开始</button>
                    <button type="button" data-action="pause">暂停</button>
                </div>
            </div>
            <div class="dyfr-row">
                <label class="dyfr-label" for="${PANEL_ID}-delay">执行间隔</label>
                <input id="${PANEL_ID}-delay" type="number" min="0" step="0.1" placeholder="0 表示立即执行">
                <div class="dyfr-help">单位：秒。脚本会自动跳过当前可见第一项中的“相互关注”用户。</div>
            </div>
            <div class="dyfr-status" id="${PANEL_ID}-status">等待开始</div>
        `;
        document.body.appendChild(panel);

        const startButton = panel.querySelector('[data-action="start"]');
        const pauseButton = panel.querySelector('[data-action="pause"]');
        const delayInput = panel.querySelector(`#${PANEL_ID}-delay`);

        delayInput.value = String(state.settings.delayMs / 1000);

        startButton.addEventListener('click', () => {
            state.running = true;
            setStatus('已开始');
            renderPanel();
            scheduleNext(0);
        });

        pauseButton.addEventListener('click', () => {
            stopLoop();
            setStatus('已暂停');
            renderPanel();
        });

        delayInput.addEventListener('change', () => {
            const seconds = Math.max(0, Number(delayInput.value) || 0);
            state.settings.delayMs = Math.round(seconds * 1000);
            saveSettings();
            delayInput.value = String(seconds);
            setStatus(`执行间隔已设置为 ${seconds} 秒`);
        });

        renderPanel();
    }

    function renderPanel() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;

        const startButton = panel.querySelector('[data-action="start"]');
        const pauseButton = panel.querySelector('[data-action="pause"]');
        const statusNode = panel.querySelector(`#${PANEL_ID}-status`);

        startButton.disabled = state.running;
        pauseButton.disabled = !state.running;
        statusNode.textContent = `${state.status}\n已移除: ${state.processed} | 已跳过: ${state.skipped}`;
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
        if (!state.running) return;
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(runOnce, Math.max(0, delay));
    }

    async function runOnce() {
        if (!state.running || state.busy) return;
        state.busy = true;

        try {
            const context = getActiveContext();
            if (!context) {
                setStatus('等待打开“粉丝”弹窗');
                scheduleNext(1000);
                return;
            }

            const target = getFirstVisibleTarget(context);
            if (!target) {
                setStatus('当前没有可处理的粉丝项，可能已到底部');
                scheduleNext(1000);
                return;
            }

            const name = target.name || '未知用户';

            if (isMutualFollowRow(target.row)) {
                const moved = scrollPastRow(context.scrollContainer, target);
                state.skipped += 1;
                setStatus(moved ? `跳过相互关注：${name}` : `相互关注命中但无法继续滚动：${name}`);
                scheduleNext(moved ? Math.max(120, state.settings.delayMs) : 1000);
                return;
            }

            setStatus(`准备移除：${name}`);
            const armed = await ensureConfirmVisible(target.removeButton, target.row);
            if (!armed) {
                setStatus(`未找到确认按钮：${name}`);
                scheduleNext(800);
                return;
            }

            const confirmButton = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
            if (!confirmButton) {
                setStatus(`确认按钮不可见：${name}`);
                scheduleNext(800);
                return;
            }

            safeClick(confirmButton);
            state.processed += 1;
            setStatus(`已移除：${name}`);
            await sleep(350);
            scheduleNext(state.settings.delayMs);
        } catch (error) {
            console.error('[抖音粉丝自动移除] 执行失败', error);
            setStatus(`执行异常：${error.message || error}`);
            scheduleNext(1200);
        } finally {
            state.busy = false;
        }
    }

    function getActiveContext() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        const footer = document.querySelector(FOOTER_SELECTOR);
        if (!container || !footer || !isVisible(container)) return null;

        const scrollContainer = findScrollContainer(container);
        return {
            container,
            scrollContainer,
        };
    }

    function getFirstVisibleTarget(context) {
        const rows = getRows(context.container);
        if (!rows.length) return null;

        const viewport = context.scrollContainer.getBoundingClientRect();
        const visibleRows = rows
            .map((row) => buildRowTarget(row))
            .filter(Boolean)
            .filter((target) => isRowVisible(target.row, viewport))
            .sort((a, b) => a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top);

        return visibleRows[0] || null;
    }

    function getRows(container) {
        const directRows = Array.from(container.querySelectorAll('.i5U4dMnB'))
            .filter((row) => findRemoveButton(row));
        if (directRows.length) return directRows;

        const fallbackRows = [];
        const seen = new Set();
        for (const button of container.querySelectorAll('button')) {
            if (!isRemoveButton(button)) continue;
            const row = findRowFromButton(button, container);
            if (!row || seen.has(row)) continue;
            seen.add(row);
            fallbackRows.push(row);
        }
        return fallbackRows;
    }

    function buildRowTarget(row) {
        const removeButton = findRemoveButton(row);
        if (!removeButton) return null;
        return {
            row,
            removeButton,
            name: getUserName(row),
        };
    }

    function findRemoveButton(scope) {
        return Array.from(scope.querySelectorAll('button')).find((button) => isRemoveButton(button)) || null;
    }

    function isRemoveButton(button) {
        if (!button || !isVisible(button)) return false;
        const text = normalizeText(button.innerText || button.textContent || '');
        return text.includes('移除');
    }

    function findRowFromButton(button, container) {
        let node = button;
        while (node && node !== container && node !== document.body) {
            if (node.nodeType === 1) {
                const hasUserAnchor = Array.from(node.querySelectorAll('a[href*="/user/"]'))
                    .some((anchor) => normalizeText(anchor.innerText || '').length > 0);
                if (hasUserAnchor) return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function getUserName(row) {
        const anchors = Array.from(row.querySelectorAll('a[href*="/user/"]'));
        for (const anchor of anchors) {
            const text = normalizeText(anchor.innerText || anchor.textContent || '');
            if (text) return text;
        }

        const image = row.querySelector('img[alt]');
        if (image) {
            return normalizeText((image.getAttribute('alt') || '').replace(/头像$/, ''));
        }

        return '';
    }

    function findScrollContainer(container) {
        let node = container;
        while (node && node !== document.body) {
            const style = window.getComputedStyle(node);
            const overflowY = style.overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 20) {
                return node;
            }
            node = node.parentElement;
        }
        return container;
    }

    function isRowVisible(row, viewportRect) {
        if (!isVisible(row)) return false;
        const rect = row.getBoundingClientRect();
        return rect.bottom > viewportRect.top + 4 && rect.top < viewportRect.bottom - 4;
    }

    function scrollPastRow(scrollContainer, target) {
        const before = scrollContainer.scrollTop;
        const step = getScrollStep(target);
        scrollContainer.scrollBy({ top: step, behavior: 'auto' });
        return scrollContainer.scrollTop !== before;
    }

    function getScrollStep(target) {
        const rect = target.row.getBoundingClientRect();
        const nextRow = getNextRow(target.row);
        if (nextRow) {
            const delta = nextRow.getBoundingClientRect().top - rect.top;
            if (delta > 30) return delta;
        }
        return Math.max(Math.round(rect.height || target.removeButton.getBoundingClientRect().height || 88), 60);
    }

    function getNextRow(row) {
        let next = row.nextElementSibling;
        while (next) {
            if (findRemoveButton(next)) return next;
            next = next.nextElementSibling;
        }
        return null;
    }

    async function ensureConfirmVisible(removeButton, row) {
        const existing = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
        if (existing) return true;

        safeClick(removeButton);
        const confirmButton = await waitFor(() => findVisibleConfirm(row) || findVisibleConfirm(removeButton), 2500, 120);
        return Boolean(confirmButton);
    }

    function findVisibleConfirm(scope) {
        if (!scope) return null;
        const candidates = scope.querySelectorAll('span, div, button');
        for (const node of candidates) {
            const text = normalizeText(node.innerText || node.textContent || '');
            if (text === '确认移除' && isVisible(node)) {
                return node;
            }
        }
        return null;
    }

    function safeClick(element) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const options = {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
        };

        if (typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
        }

        const PointerCtor = window.PointerEvent || window.MouseEvent;
        element.dispatchEvent(new PointerCtor('pointerdown', options));
        element.dispatchEvent(new MouseEvent('mousedown', options));
        element.dispatchEvent(new PointerCtor('pointerup', options));
        element.dispatchEvent(new MouseEvent('mouseup', options));

        if (typeof element.click === 'function') {
            element.click();
        }
    }

    function isMutualFollowRow(row) {
        return Array.from(row.querySelectorAll('button')).some((button) => {
            const text = normalizeText(button.innerText || button.textContent || '');
            return text.includes('相互关注');
        });
    }

    function normalizeText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
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
