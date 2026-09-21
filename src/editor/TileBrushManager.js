/**
 * TileBrushManager.js
 * 
 * 管理圖塊「確定產出 (綠色)」與「取消排除 (淺紅色)」筆刷狀態
 * 支援 1x1 至 5x5 筆刷規格、連續拖曳塗抹、歷史紀錄 (Ctrl+Z / Ctrl+Y)、統計計算與排除篩選
 */
export class TileBrushManager {
    constructor() {
        this.tool = 'pointer'; // 'pointer' | 'include' | 'exclude' | 'eraser'
        this.brushSize = 1;    // 1 to 5 (以單元格為單位)
        
        // 網格模式各單元格狀態 key: `${col}_${row}` => 'included' | 'excluded'
        // 未設定者一律視為 'default'（即確定產出）
        this.gridCellStates = new Map();

        // 智能多框模式各 Sprite 狀態 key: sprite.id => 'included' | 'excluded'
        this.spriteStates = new Map();

        // 復原與重做歷史堆疊 (History Stack)
        this.history = [{
            grid: new Map(),
            sprite: new Map()
        }];
        this.historyIndex = 0;
        this.maxHistory = 60;
        this.isStrokeActive = false;
        this.strokeHasChanges = false;

        // 監聽回調
        this.onChangeCallbacks = [];
    }

    /**
     * 註冊狀態變更回調
     */
    onChange(fn) {
        if (typeof fn === 'function') {
            this.onChangeCallbacks.push(fn);
        }
    }

    _notify() {
        for (const fn of this.onChangeCallbacks) {
            try { fn(); } catch (e) { console.error(e); }
        }
    }

    // ==========================================
    // 歷史紀錄 (Undo / Redo) 管理
    // ==========================================

    beginStroke() {
        this.isStrokeActive = true;
        this.strokeHasChanges = false;
    }

    endStroke() {
        if (!this.isStrokeActive) return;
        this.isStrokeActive = false;
        if (this.strokeHasChanges) {
            this._commitHistory('筆刷塗抹');
            this.strokeHasChanges = false;
        }
    }

    _commitHistory(actionName = '') {
        // 丟棄目前指標之後的所有 Redo 分支
        if (this.historyIndex < this.history.length - 1) {
            this.history.splice(this.historyIndex + 1);
        }

        // 推入目前狀態的深拷貝快照
        this.history.push({
            grid: new Map(this.gridCellStates),
            sprite: new Map(this.spriteStates),
            action: actionName
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this._notify();
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    undo() {
        if (!this.canUndo()) return false;
        this.historyIndex--;
        const snapshot = this.history[this.historyIndex];
        this.gridCellStates = new Map(snapshot.grid);
        this.spriteStates = new Map(snapshot.sprite);
        this._notify();
        return true;
    }

    redo() {
        if (!this.canRedo()) return false;
        this.historyIndex++;
        const snapshot = this.history[this.historyIndex];
        this.gridCellStates = new Map(snapshot.grid);
        this.spriteStates = new Map(snapshot.sprite);
        this._notify();
        return true;
    }

    // ==========================================
    // 工具與筆刷大小
    // ==========================================

    setTool(tool) {
        if (['pointer', 'include', 'exclude', 'eraser'].includes(tool)) {
            this.tool = tool;
            this._notify();
        }
    }

    getTool() {
        return this.tool;
    }

    setBrushSize(size) {
        const s = parseInt(size, 10);
        if (s >= 1 && s <= 5) {
            this.brushSize = s;
            this._notify();
        }
    }

    getBrushSize() {
        return this.brushSize;
    }

    // ==========================================
    // 網格單元格狀態管理
    // ==========================================

    /**
     * 取得特定網格單元格狀態
     * @returns {'default' | 'included' | 'excluded'}
     */
    getCellState(col, row) {
        const key = `${col}_${row}`;
        return this.gridCellStates.get(key) || 'default';
    }

    isCellExcluded(col, row) {
        return this.getCellState(col, row) === 'excluded';
    }

    isCellIncluded(col, row) {
        return this.getCellState(col, row) === 'included';
    }

    /**
     * 塗抹單一網格單元格
     */
    paintCell(col, row, tool = this.tool) {
        if (col < 0 || row < 0) return false;
        const key = `${col}_${row}`;
        const prevState = this.gridCellStates.get(key) || 'default';
        let targetState = 'default';

        if (tool === 'include') targetState = 'included';
        else if (tool === 'exclude') targetState = 'excluded';
        else if (tool === 'eraser') targetState = 'default';

        if (prevState === targetState) return false;

        if (targetState === 'default') {
            this.gridCellStates.delete(key);
        } else {
            this.gridCellStates.set(key, targetState);
        }

        this.strokeHasChanges = true;
        // 若非處於批次 stroke 中，則單獨 commit
        if (!this.isStrokeActive) {
            this._commitHistory('筆刷點擊');
        }
        return true;
    }

    /**
     * 計算以 (centerCol, centerRow) 為基準，依據 brushSize (1~5) 擴展的網格範圍
     */
    getBrushGridRange(centerCol, centerRow, maxCols, maxRows) {
        if (centerCol < 0 || centerRow < 0) return [];
        const size = this.brushSize;
        const half1 = Math.floor((size - 1) / 2);
        const half2 = Math.ceil((size - 1) / 2);

        const minCol = Math.max(0, centerCol - half1);
        const maxCol = Math.min(maxCols - 1, centerCol + half2);
        const minRow = Math.max(0, centerRow - half1);
        const maxRow = Math.min(maxRows - 1, centerRow + half2);

        const cells = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                cells.push({ col: c, row: r });
            }
        }
        return cells;
    }

    /**
     * 批量塗抹網格區域
     */
    paintGridArea(centerCol, centerRow, maxCols, maxRows, tool = this.tool) {
        if (tool === 'pointer') return false;
        const cells = this.getBrushGridRange(centerCol, centerRow, maxCols, maxRows);
        let changed = false;

        for (const { col, row } of cells) {
            if (this.paintCell(col, row, tool)) {
                changed = true;
            }
        }

        if (changed) {
            this._notify();
        }
        return changed;
    }

    /**
     * 清空所有標記
     */
    clearAll() {
        if (this.gridCellStates.size === 0 && this.spriteStates.size === 0) return;
        this.gridCellStates.clear();
        this.spriteStates.clear();
        this._commitHistory('重設所有標記');
    }

    /**
     * 統計目前被排除的網格數
     */
    getExcludedGridCount(totalCols, totalRows) {
        let count = 0;
        for (let r = 0; r < totalRows; r++) {
            for (let c = 0; c < totalCols; c++) {
                if (this.isCellExcluded(c, r)) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * 統計目前有效產出的網格數
     */
    getEffectiveGridCount(totalCols, totalRows) {
        const total = totalCols * totalRows;
        return Math.max(0, total - this.getExcludedGridCount(totalCols, totalRows));
    }

    // --- 智能多框模式支援 ---

    getSpriteState(spriteId) {
        return this.spriteStates.get(spriteId) || 'default';
    }

    isSpriteExcluded(spriteId) {
        return this.getSpriteState(spriteId) === 'excluded';
    }

    isSpriteIncluded(spriteId) {
        return this.getSpriteState(spriteId) === 'included';
    }

    paintSprite(spriteId, tool = this.tool) {
        if (!spriteId) return false;
        const prevState = this.spriteStates.get(spriteId) || 'default';
        let targetState = 'default';

        if (tool === 'include') targetState = 'included';
        else if (tool === 'exclude') targetState = 'excluded';
        else if (tool === 'eraser') targetState = 'default';

        if (prevState === targetState) return false;

        if (targetState === 'default') {
            this.spriteStates.delete(spriteId);
        } else {
            this.spriteStates.set(spriteId, targetState);
        }

        this._commitHistory('Sprite 標記');
        return true;
    }

    getEffectiveSpritesCount(sprites) {
        if (!Array.isArray(sprites)) return 0;
        let count = 0;
        for (const s of sprites) {
            if (!this.isSpriteExcluded(s.id)) {
                count++;
            }
        }
        return count;
    }
}
