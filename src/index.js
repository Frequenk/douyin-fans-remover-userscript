(function () {
    'use strict';

    const STORAGE_KEY = 'douyin-fans-remover-settings';
    const PANEL_ID = 'dy-fans-remover-panel';
    const CONTAINER_SELECTOR = '[data-e2e="user-fans-container"]';
    const FOOTER_SELECTOR = '[data-e2e="user-fans-footer"]';
    const DEFAULT_SETTINGS = {
        delayMs: 0,
        batchSize: 5,
    };
    const state = {
        running: false,
        busy: false,
        timer: null,
        settings: loadSettings(),
        status: '等待开始',
        processed: 0,
        skipped: 0,
        skippedKeys: new Set(),
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
            const parsed = JSON.parse(raw);
            return {
                ...parsed,
                ...DEFAULT_SETTINGS,
            };
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
            #${PANEL_ID} button {
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
            <div class="dyfr-help">当前可见区遇到“相互关注”会自动跳过，需要你手动滚动把它们移出可见区。平台每天上限移除 2000 人。</div>
            <div class="dyfr-status" id="${PANEL_ID}-status">等待开始</div>
        `;
        document.body.appendChild(panel);

        const startButton = panel.querySelector('[data-action="start"]');
        const pauseButton = panel.querySelector('[data-action="pause"]');

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

            const visibleTargets = getVisibleTargets(context);
            if (!visibleTargets.length) {
                setStatus('当前没有可处理的粉丝项，可能已到底部');
                scheduleNext(1000);
                return;
            }

            const visibleMutualTargets = visibleTargets.filter((target) => isMutualFollowRow(target.row));
            if (visibleMutualTargets.length > 0) {
                state.skipped += countNewSkippedKeys(visibleMutualTargets.map((target) => target.key).filter(Boolean));
            }

            const removedNames = [];
            const batchSize = clampBatchSize(state.settings.batchSize);
            let lastFailure = null;
            const batchTargets = getBatchRemovableTargets(getVisibleTargets(context), batchSize);
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
                const mutualText = visibleMutualTargets.length > 0
                    ? `；当前可见区已跳过 ${visibleMutualTargets.length} 个相互关注`
                    : '';
                setStatus(`本轮已移除 ${removedNames.length} 人：${removedNames.join('、')}${mutualText}`);
                scheduleNext(0);
                return;
            }

            if (lastFailure) {
                setStatus(lastFailure);
                scheduleNext(800);
                return;
            }

            if (visibleMutualTargets.length > 0) {
                setStatus(`当前可见区域只有“相互关注”或没有可删目标，请手动滚动后继续`);
                scheduleNext(600);
                return;
            }

            setStatus('当前可见区域没有可移除的目标');
            scheduleNext(600);
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

    function getVisibleTargets(context) {
        const rows = getRows(context.container);
        if (!rows.length) return [];

        const viewport = context.scrollContainer.getBoundingClientRect();
        return rows
            .map((row) => buildRowTarget(row))
            .filter(Boolean)
            .filter((target) => isRowVisible(target.row, viewport))
            .sort((a, b) => a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top);
    }

    function getFirstRemovableTarget(visibleTargets) {
        return visibleTargets.find((target) => !isMutualFollowRow(target.row)) || null;
    }

    function getBatchRemovableTargets(visibleTargets, batchSize) {
        return visibleTargets
            .filter((target) => !isMutualFollowRow(target.row))
            .slice(0, batchSize);
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
            key: getUserKey(row),
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

    function getUserKey(row) {
        const anchor = row.querySelector('a[href*="/user/"]');
        if (anchor) {
            const href = anchor.getAttribute('href') || anchor.href || '';
            const normalizedHref = normalizeText(href);
            if (normalizedHref) return normalizedHref;
        }
        return getUserName(row) || '';
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

    async function ensureConfirmVisible(removeButton, row) {
        const existing = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
        if (existing) {
            return { ok: true, state: 'confirm', confirmButton: existing };
        }

        safeClick(removeButton);
        const result = await waitFor(() => {
            const confirmButton = findVisibleConfirm(row) || findVisibleConfirm(removeButton);
            if (confirmButton) {
                return { ok: true, state: 'confirm', confirmButton };
            }
            if (isRowRemoved(row)) {
                return { ok: true, state: 'removed' };
            }
            return null;
        }, 1800, 80);

        return result || { ok: false, state: 'missing' };
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

    async function removeTarget(target) {
        const name = target.name || '未知用户';
        setStatus(`准备移除：${name}`);

        const prepareResult = await ensureConfirmVisible(target.removeButton, target.row);
        if (!prepareResult.ok) {
            return { ok: false, message: `未找到确认按钮：${name}` };
        }

        if (prepareResult.state === 'removed') {
            return { ok: true };
        }

        const confirmButton = prepareResult.confirmButton
            || findVisibleConfirm(target.row)
            || findVisibleConfirm(target.removeButton);
        if (!confirmButton) {
            if (isRowRemoved(target.row)) {
                return { ok: true };
            }
            return { ok: false, message: `确认按钮不可见：${name}` };
        }

        safeClick(confirmButton);
        await waitForRowRemoval(target.row, 1200, 80);
        return { ok: true };
    }

    async function removeTargetsSimultaneously(targets) {
        const targetNames = targets.map((target) => target.name || '未知用户');
        setStatus(`准备同时移除：${targetNames.join('、')}`);

        const directRemoved = [];
        const pendingTargets = [];

        for (const target of targets) {
            if (isRowRemoved(target.row)) {
                directRemoved.push(target.name || '未知用户');
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
            if (result.state === 'removed') {
                removedNames.push(result.target.name || '未知用户');
                continue;
            }
            if (result.state === 'confirm') {
                confirmTargets.push(result);
                continue;
            }
            lastFailure = `未找到确认按钮：${result.target.name || '未知用户'}`;
        }

        for (const result of confirmTargets) {
            safeClick(result.confirmButton);
        }

        if (confirmTargets.length > 0) {
            await Promise.all(confirmTargets.map((result) => waitForRowRemoval(result.target.row, 1200, 80)));
            removedNames.push(...confirmTargets.map((result) => result.target.name || '未知用户'));
        }

        const uniqueRemovedNames = dedupeStrings(removedNames);
        return {
            ok: uniqueRemovedNames.length > 0 || !lastFailure,
            removedNames: uniqueRemovedNames,
            message: uniqueRemovedNames.length > 0 ? null : lastFailure,
        };
    }

    async function waitForTargetReady(target) {
        if (isRowRemoved(target.row)) {
            return { target, state: 'removed' };
        }

        const existingConfirm = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
        if (existingConfirm) {
            return { target, state: 'confirm', confirmButton: existingConfirm };
        }

        const result = await waitFor(() => {
            const confirmButton = findVisibleConfirm(target.row) || findVisibleConfirm(target.removeButton);
            if (confirmButton) {
                return { target, state: 'confirm', confirmButton };
            }
            if (isRowRemoved(target.row)) {
                return { target, state: 'removed' };
            }
            return null;
        }, 900, 60);

        return result || { target, state: 'missing' };
    }

    function safeClick(element) {
        if (!element) return;

        if (typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
        }

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

    function clampBatchSize(value) {
        const numeric = Number(value) || 1;
        return Math.min(5, Math.max(1, Math.round(numeric)));
    }

    function countNewSkippedKeys(keys) {
        let count = 0;
        for (const key of keys) {
            if (!key || state.skippedKeys.has(key)) continue;
            state.skippedKeys.add(key);
            count += 1;
        }
        return count;
    }

    function dedupeStrings(items) {
        const seen = new Set();
        const result = [];
        for (const item of items) {
            if (!item || seen.has(item)) continue;
            seen.add(item);
            result.push(item);
        }
        return result;
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
