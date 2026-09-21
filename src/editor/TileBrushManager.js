/**
 * TileBrushManager.js
 * 
 * 管理圖塊「確定產出 (淺綠色)」與「取消排除 (淺紅色)」筆刷狀態
 * 支援 1x1 至 5x5 筆刷規格、連續拖曳塗抹、統計計算與排除篩選
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

        if (tool === 'include') {
            this.gridCellStates.set(key, 'included');
            return true;
        } else if (tool === 'exclude') {
            this.gridCellStates.set(key, 'excluded');
            return true;
        } else if (tool === 'eraser') {
            if (this.gridCellStates.has(key)) {
                this.gridCellStates.delete(key);
                return true;
            }
        }
        return false;
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
        this.gridCellStates.clear();
        this.spriteStates.clear();
        this._notify();
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
        if (tool === 'include') {
            this.spriteStates.set(spriteId, 'included');
            this._notify();
            return true;
        } else if (tool === 'exclude') {
            this.spriteStates.set(spriteId, 'excluded');
            this._notify();
            return true;
        } else if (tool === 'eraser') {
            if (this.spriteStates.has(spriteId)) {
                this.spriteStates.delete(spriteId);
                this._notify();
                return true;
            }
        }
        return false;
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
