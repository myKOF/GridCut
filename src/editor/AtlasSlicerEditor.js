/**
 * AtlasSlicerEditor
 * 專職負責 UI 預覽、互動修改、選取、拉框、移動、縮放、合併、分割與 Undo/Redo
 * 與後端 Detection 演算法完全分離。
 */
export class AtlasSlicerEditor {
    constructor(containerEl, options = {}) {
        this.container = containerEl;
        this.scaleRatio = 1.0; // 原始影像像素 / 渲染 CSS 像素
        this.sourceImage = null;
        
        // 框體清單：每項格式：
        // { id: string, x: number, y: number, width: number, height: number, confidence: number }
        // 注意：內部儲存原始影像座標 (Real Image Coordinates)，以確保縮放時無誤差
        this.sprites = [];
        this.selectedIds = new Set();

        // 歷史堆疊 (Undo / Redo)
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // 互動拖曳狀態
        this.activeDrag = null; // { type: 'move'|'resize', handle, spriteId, startPos, originalSprites }
        this.isDrawingMode = false;
        this.drawingStart = null;
        this.previewEl = null;

        // 回呼回饋
        this.onSelectionChange = options.onSelectionChange || null;
        this.onSpritesChange = options.onSpritesChange || null;
        this.onHistoryChange = options.onHistoryChange || null;

        this._initEvents();
    }

    /**
     * 設定影像來源與縮放比
     */
    setSource(sourceImg, scaleRatio = 1.0) {
        this.sourceImage = sourceImg;
        this.scaleRatio = scaleRatio;
        this.render();
    }

    setScaleRatio(ratio) {
        this.scaleRatio = ratio;
        this.render();
    }

    /**
     * 載入 Sprites 清單並重設歷史
     */
    loadSprites(sprites) {
        this.sprites = sprites.map((s, idx) => ({
            id: s.id || `sprite_${String(idx + 1).padStart(3, '0')}`,
            x: Math.round(s.x),
            y: Math.round(s.y),
            width: Math.max(2, Math.round(s.width)),
            height: Math.max(2, Math.round(s.height)),
            confidence: typeof s.confidence === 'number' ? s.confidence : 0.9,
            confidenceCategory: s.confidenceCategory || (s.confidence >= 0.8 ? 'high' : (s.confidence >= 0.5 ? 'med' : 'low')),
            confidenceBreakdown: s.confidenceBreakdown || null
        }));

        this.selectedIds.clear();
        if (this.sprites.length > 0) {
            this.selectedIds.add(this.sprites[0].id);
        }

        this.history = [];
        this.historyIndex = -1;
        this._pushHistory('初始辨識');

        this.render();
        this._notifyChanges();
    }

    /**
     * 取得目前所有 Sprite (Real Image Coordinates)
     */
    getSprites() {
        return [...this.sprites];
    }

    /**
     * 取得目前被選中的 Sprite 清單
     */
    getSelectedSprites() {
        return this.sprites.filter(s => this.selectedIds.has(s.id));
    }

    /**
     * 選取單一或多個 Sprite
     */
    select(id, multi = false) {
        if (!multi) {
            this.selectedIds.clear();
        }
        if (id) {
            if (multi && this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.add(id);
            }
        }
        this.renderSelectionStyles();
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedSprites());
        }
    }

    selectAll() {
        this.selectedIds = new Set(this.sprites.map(s => s.id));
        this.renderSelectionStyles();
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedSprites());
        }
    }

    clearSelection() {
        this.selectedIds.clear();
        this.renderSelectionStyles();
        if (this.onSelectionChange) {
            this.onSelectionChange([]);
        }
    }

    /**
     * 新增 Sprite 框 (Real Pixels)
     */
    addRegion(x, y, width, height) {
        const id = `sprite_${String(this.sprites.length + 1).padStart(3, '0')}`;
        const newSprite = {
            id,
            x: Math.round(Math.max(0, x)),
            y: Math.round(Math.max(0, y)),
            width: Math.round(Math.max(4, width)),
            height: Math.round(Math.max(4, height)),
            confidence: 1.0
        };

        this.sprites.push(newSprite);
        this.selectedIds.clear();
        this.selectedIds.add(id);

        this._pushHistory('手動新增框體');
        this.render();
        this._notifyChanges();
    }

    /**
     * 刪除指定或目前選中的 Sprite
     */
    deleteSelected() {
        if (this.selectedIds.size === 0) return;

        this.sprites = this.sprites.filter(s => !this.selectedIds.has(s.id));
        this.selectedIds.clear();
        if (this.sprites.length > 0) {
            this.selectedIds.add(this.sprites[0].id);
        }

        this._pushHistory('刪除框體');
        this.render();
        this._notifyChanges();
    }

    deleteSprite(id) {
        this.sprites = this.sprites.filter(s => s.id !== id);
        this.selectedIds.delete(id);
        if (this.selectedIds.size === 0 && this.sprites.length > 0) {
            this.selectedIds.add(this.sprites[0].id);
        }

        this._pushHistory('刪除單一框體');
        this.render();
        this._notifyChanges();
    }

    /**
     * 合併選中的多個 Sprite 框為一個
     */
    mergeSelected() {
        if (this.selectedIds.size <= 1) return;

        const selected = this.getSelectedSprites();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const s of selected) {
            if (s.x < minX) minX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.x + s.width > maxX) maxX = s.x + s.width;
            if (s.y + s.height > maxY) maxY = s.y + s.height;
        }

        const mergedSprite = {
            id: selected[0].id,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            confidence: 0.95
        };

        // 移除非第一個選中項目
        this.sprites = this.sprites.filter(s => !this.selectedIds.has(s.id));
        this.sprites.push(mergedSprite);
        this.selectedIds.clear();
        this.selectedIds.add(mergedSprite.id);

        this._pushHistory('合併選中框體');
        this.render();
        this._notifyChanges();
    }

    /**
     * 分割選中框體
     * @param {'horizontal'|'vertical'|'auto'} direction 
     */
    splitSelected(direction = 'horizontal') {
        const selected = this.getSelectedSprites();
        if (selected.length === 0) return;

        const newSprites = [];
        let didSplit = false;

        for (const s of selected) {
            if (direction === 'horizontal' || (direction === 'auto' && s.height >= s.width)) {
                // 水平切成上下兩半
                const halfH = Math.floor(s.height / 2);
                if (halfH >= 4) {
                    newSprites.push({
                        ...s,
                        id: s.id + '_t',
                        height: halfH
                    });
                    newSprites.push({
                        ...s,
                        id: s.id + '_b',
                        y: s.y + halfH,
                        height: s.height - halfH
                    });
                    didSplit = true;
                } else {
                    newSprites.push(s);
                }
            } else {
                // 垂直切成左右兩半
                const halfW = Math.floor(s.width / 2);
                if (halfW >= 4) {
                    newSprites.push({
                        ...s,
                        id: s.id + '_l',
                        width: halfW
                    });
                    newSprites.push({
                        ...s,
                        id: s.id + '_r',
                        x: s.x + halfW,
                        width: s.width - halfW
                    });
                    didSplit = true;
                } else {
                    newSprites.push(s);
                }
            }
        }

        if (didSplit) {
            this.sprites = this.sprites.filter(s => !this.selectedIds.has(s.id)).concat(newSprites);
            this.selectedIds.clear();
            newSprites.forEach(ns => this.selectedIds.add(ns.id));

            this._pushHistory(`分割框體 (${direction})`);
            this.render();
            this._notifyChanges();
        }
    }

    /**
     * 移動選中框體 (Real Image Coordinates)
     */
    nudgeSelected(dx, dy) {
        if (this.selectedIds.size === 0) return;
        const maxW = this.sourceImage ? (this.sourceImage.naturalWidth || this.sourceImage.width) : Infinity;
        const maxH = this.sourceImage ? (this.sourceImage.naturalHeight || this.sourceImage.height) : Infinity;

        for (const s of this.sprites) {
            if (this.selectedIds.has(s.id)) {
                s.x = Math.max(0, Math.min(maxW - s.width, s.x + dx));
                s.y = Math.max(0, Math.min(maxH - s.height, s.y + dy));
            }
        }

        this.render();
        this._notifyChanges(false);
    }

    /**
     * 更新指定 Sprite 屬性
     */
    updateSprite(id, props) {
        const s = this.sprites.find(item => item.id === id);
        if (!s) return;

        if (typeof props.x === 'number') s.x = Math.round(props.x);
        if (typeof props.y === 'number') s.y = Math.round(props.y);
        if (typeof props.width === 'number') s.width = Math.round(Math.max(2, props.width));
        if (typeof props.height === 'number') s.height = Math.round(Math.max(2, props.height));

        this.render();
        this._notifyChanges(false);
    }

    commitManualChange(actionName = '屬性調整') {
        this._pushHistory(actionName);
        this._notifyChanges(true);
    }

    // ==========================================
    // 歷史紀錄 (Undo / Redo)
    // ==========================================

    _pushHistory(actionName) {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const snapshot = {
            action: actionName,
            sprites: JSON.parse(JSON.stringify(this.sprites)),
            selectedIds: Array.from(this.selectedIds)
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        if (this.onHistoryChange) {
            this.onHistoryChange({
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                lastAction: actionName
            });
        }
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    undo() {
        if (!this.canUndo()) return;
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        this.sprites = JSON.parse(JSON.stringify(state.sprites));
        this.selectedIds = new Set(state.selectedIds);
        this.render();
        this._notifyChanges();
        if (this.onHistoryChange) {
            this.onHistoryChange({ canUndo: this.canUndo(), canRedo: this.canRedo(), lastAction: state.action });
        }
    }

    redo() {
        if (!this.canRedo()) return;
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        this.sprites = JSON.parse(JSON.stringify(state.sprites));
        this.selectedIds = new Set(state.selectedIds);
        this.render();
        this._notifyChanges();
        if (this.onHistoryChange) {
            this.onHistoryChange({ canUndo: this.canUndo(), canRedo: this.canRedo(), lastAction: state.action });
        }
    }

    // ==========================================
    // DOM 繪製與視覺反饋
    // ==========================================

    render() {
        if (!this.container) return;

        // 清除舊的 .auto-box
        this.container.querySelectorAll('.auto-box').forEach(el => el.remove());

        const ratio = this.scaleRatio || 1.0;

        this.sprites.forEach((s) => {
            const el = document.createElement('div');
            el.className = 'auto-box';
            el.dataset.id = s.id;

            // 信心度色彩指示 (Confidence)
            // 高 Confidence (>0.8) -> 綠框
            // 中 Confidence (0.5~0.8) -> 黃框
            // 低 Confidence (<0.5) -> 紅框
            if (s.confidence >= 0.8) {
                el.classList.add('confidence-high');
            } else if (s.confidence >= 0.5) {
                el.classList.add('confidence-med');
            } else {
                el.classList.add('confidence-low');
            }

            if (this.selectedIds.has(s.id)) {
                el.classList.add('selected');
            }

            // CSS 座標 = 原始影像座標 / ratio
            const cx = s.x / ratio;
            const cy = s.y / ratio;
            const cw = s.width / ratio;
            const ch = s.height / ratio;

            el.style.left = `${cx}px`;
            el.style.top = `${cy}px`;
            el.style.width = `${cw}px`;
            el.style.height = `${ch}px`;

            // Badge 顯示 ID, 寬高與信心度
            const badge = document.createElement('div');
            badge.className = 'box-badge';
            const confPct = Math.round((s.confidence || 0.9) * 100);
            badge.innerHTML = `<span>${s.id}</span> <span class="badge-dim">${s.width}×${s.height}</span> <span class="badge-conf">${confPct}%</span>`;
            el.appendChild(badge);

            // 單框刪除按鈕
            const delBtn = document.createElement('button');
            delBtn.className = 'box-delete-btn';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.title = '刪除此框 (Delete)';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSprite(s.id);
            });
            el.appendChild(delBtn);

            // 8 個縮放手柄
            const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
            handles.forEach(h => {
                const handle = document.createElement('div');
                handle.className = `box-handle box-handle-${h}`;
                handle.dataset.handle = h;
                el.appendChild(handle);
            });

            // 點選與拖曳事件
            el.addEventListener('mousedown', (e) => this._onBoxMouseDown(e, s.id));
            el.addEventListener('touchstart', (e) => this._onBoxMouseDown(e, s.id), { passive: false });

            this.container.appendChild(el);
        });

        this.renderSelectionStyles();
    }

    renderSelectionStyles() {
        if (!this.container) return;
        this.container.querySelectorAll('.auto-box').forEach(el => {
            const id = el.dataset.id;
            if (this.selectedIds.has(id)) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }

    setDrawingMode(enabled) {
        this.isDrawingMode = enabled;
        if (this.container) {
            this.container.style.cursor = enabled ? 'crosshair' : 'default';
        }
    }

    // ==========================================
    // 互動事件監聽
    // ==========================================

    _initEvents() {
        if (!this.container) return;

        // 手動拉框畫新 Sprite
        this.previewEl = document.getElementById('drawingBoxPreview') || document.createElement('div');
        this.previewEl.className = 'drawing-box-preview';
        this.previewEl.style.display = 'none';
        if (!this.previewEl.parentElement) {
            this.container.appendChild(this.previewEl);
        }

        const onPointerDown = (e) => {
            if (!this.isDrawingMode) return;
            const target = e.target;
            if (target.classList.contains('box-handle') || target.closest('.box-delete-btn')) return;

            const rect = this.container.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.drawingStart = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };

            this.previewEl.style.display = 'block';
            this.previewEl.style.left = `${this.drawingStart.x}px`;
            this.previewEl.style.top = `${this.drawingStart.y}px`;
            this.previewEl.style.width = '0px';
            this.previewEl.style.height = '0px';

            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (this.activeDrag) {
                this._handleDragMove(e);
                return;
            }

            if (!this.isDrawingMode || !this.drawingStart) return;

            const rect = this.container.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const curX = clientX - rect.left;
            const curY = clientY - rect.top;

            const left = Math.min(this.drawingStart.x, curX);
            const top = Math.min(this.drawingStart.y, curY);
            const w = Math.abs(curX - this.drawingStart.x);
            const h = Math.abs(curY - this.drawingStart.y);

            this.previewEl.style.left = `${left}px`;
            this.previewEl.style.top = `${top}px`;
            this.previewEl.style.width = `${w}px`;
            this.previewEl.style.height = `${h}px`;
        };

        const onPointerUp = () => {
            if (this.activeDrag) {
                this._finishDrag();
                return;
            }

            if (this.isDrawingMode && this.drawingStart) {
                const w = parseFloat(this.previewEl.style.width) || 0;
                const h = parseFloat(this.previewEl.style.height) || 0;
                const left = parseFloat(this.previewEl.style.left) || 0;
                const top = parseFloat(this.previewEl.style.top) || 0;

                this.drawingStart = null;
                this.previewEl.style.display = 'none';

                if (w > 8 && h > 8) {
                    const ratio = this.scaleRatio || 1.0;
                    this.addRegion(left * ratio, top * ratio, w * ratio, h * ratio);
                }
            }
        };

        this.container.addEventListener('mousedown', onPointerDown);
        this.container.addEventListener('touchstart', onPointerDown, { passive: false });

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('touchmove', onPointerMove, { passive: false });

        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchend', onPointerUp);
    }

    _onBoxMouseDown(e, spriteId) {
        if (this.isDrawingMode) return;
        if (e.target.closest('.box-delete-btn')) return;

        const isMulti = e.shiftKey || e.ctrlKey;
        if (!this.selectedIds.has(spriteId)) {
            this.select(spriteId, isMulti);
        } else if (isMulti) {
            this.select(spriteId, true);
        }

        const target = e.target;
        const handle = target.dataset.handle;
        const type = handle ? 'resize' : 'move';

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 記錄拖曳開始狀態
        const sprite = this.sprites.find(s => s.id === spriteId);
        if (!sprite) return;

        this.activeDrag = {
            type,
            handle,
            spriteId,
            startX: clientX,
            startY: clientY,
            startSprite: { ...sprite },
            didMove: false
        };

        e.stopPropagation();
        e.preventDefault();
    }

    _handleDragMove(e) {
        if (!this.activeDrag) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dxCss = clientX - this.activeDrag.startX;
        const dyCss = clientY - this.activeDrag.startY;

        const ratio = this.scaleRatio || 1.0;
        const dxReal = dxCss * ratio;
        const dyReal = dyCss * ratio;

        if (Math.abs(dxCss) > 2 || Math.abs(dyCss) > 2) {
            this.activeDrag.didMove = true;
        }

        const sprite = this.sprites.find(s => s.id === this.activeDrag.spriteId);
        if (!sprite) return;

        const init = this.activeDrag.startSprite;
        const maxW = this.sourceImage ? (this.sourceImage.naturalWidth || this.sourceImage.width) : 10000;
        const maxH = this.sourceImage ? (this.sourceImage.naturalHeight || this.sourceImage.height) : 10000;

        if (this.activeDrag.type === 'move') {
            sprite.x = Math.round(Math.max(0, Math.min(maxW - init.width, init.x + dxReal)));
            sprite.y = Math.round(Math.max(0, Math.min(maxH - init.height, init.y + dyReal)));
        } else if (this.activeDrag.type === 'resize') {
            const h = this.activeDrag.handle;
            let nx = init.x, ny = init.y, nw = init.width, nh = init.height;

            if (h.includes('e')) nw = Math.max(4, init.width + dxReal);
            if (h.includes('s')) nh = Math.max(4, init.height + dyReal);
            if (h.includes('w')) {
                const candW = init.width - dxReal;
                if (candW >= 4) {
                    nx = init.x + dxReal;
                    nw = candW;
                }
            }
            if (h.includes('n')) {
                const candH = init.height - dyReal;
                if (candH >= 4) {
                    ny = init.y + dyReal;
                    nh = candH;
                }
            }

            sprite.x = Math.round(Math.max(0, nx));
            sprite.y = Math.round(Math.max(0, ny));
            sprite.width = Math.round(Math.min(maxW - sprite.x, nw));
            sprite.height = Math.round(Math.min(maxH - sprite.y, nh));
        }

        // 直接同步 DOM 節點位置提升拖曳效能
        this._syncBoxDOM(sprite);
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedSprites());
        }
    }

    _finishDrag() {
        if (!this.activeDrag) return;

        if (this.activeDrag.didMove) {
            this._pushHistory(this.activeDrag.type === 'move' ? '移動框體' : '縮放框體');
            this._notifyChanges();
        }

        this.activeDrag = null;
    }

    _syncBoxDOM(sprite) {
        const el = this.container.querySelector(`.auto-box[data-id="${sprite.id}"]`);
        if (!el) return;

        const ratio = this.scaleRatio || 1.0;
        el.style.left = `${sprite.x / ratio}px`;
        el.style.top = `${sprite.y / ratio}px`;
        el.style.width = `${sprite.width / ratio}px`;
        el.style.height = `${sprite.height / ratio}px`;

        const badge = el.querySelector('.box-badge');
        if (badge) {
            const confPct = Math.round((sprite.confidence || 0.9) * 100);
            badge.innerHTML = `<span>${sprite.id}</span> <span class="badge-dim">${sprite.width}×${sprite.height}</span> <span class="badge-conf">${confPct}%</span>`;
        }
    }

    _notifyChanges(pushHistory = false) {
        if (this.onSpritesChange) {
            this.onSpritesChange(this.sprites);
        }
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedSprites());
        }
    }
}
