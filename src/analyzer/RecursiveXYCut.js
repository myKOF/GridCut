/**
 * RecursiveXYCut
 * 空間遞迴投影分割器 (Recursive XY-Cut Spatial Segmentation)
 * 核心原則：優先尋找 Sprite 之間的空隙 (Gutters) 與矩形區域，將圖集遞迴分解為候選矩形 (Candidate Rectangles)
 */
export class RecursiveXYCut {
    /**
     * 對二值前景佔用遮罩 (Occupancy Mask) 執行 Recursive XY-Cut
     * @param {Uint8Array} mask 
     * @param {number} width 
     * @param {number} height 
     * @param {Object} [options]
     * @param {number} [options.minSpriteWidth=16]
     * @param {number} [options.minSpriteHeight=16]
     * @param {number} [options.minSpriteArea=256]
     * @param {number} [options.separatorConfidence=0.20] 分割線顯著跌幅門檻
     * @param {number} [options.gutterWidth=1] 最小間隙寬度
     * @returns {{
     *   candidates: Array<{x: number, y: number, width: number, height: number, reason: string}>,
     *   gutters: Array<{orientation: 'H'|'V', x: number, y: number, length: number, confidence: number}>,
     *   globalHProfile: Int32Array,
     *   globalVProfile: Int32Array
     * }}
     */
    static segment(mask, width, height, options = {}) {
        const {
            minSpriteWidth = 16,
            minSpriteHeight = 16,
            minSpriteArea = 256,
            separatorConfidence = 0.20,
            gutterWidth = 1
        } = options;

        const allGutters = [];
        const globalProfiles = this.computeProfiles(mask, width, height, { x: 0, y: 0, width, height });

        const recursiveCut = (box, depth) => {
            if (depth > 14) {
                return [box];
            }

            // 核心原則：區塊必須至少能容納 2 個 Sprite 尺寸才具備切分意義
            const canCutH = box.height >= minSpriteHeight * 2.0;
            const canCutV = box.width >= minSpriteWidth * 2.0;

            if (!canCutH && !canCutV) {
                return [box];
            }

            const { hProfile, vProfile } = this.computeProfiles(mask, width, height, box);

            // 尋找水平與垂直候選分割線 (Separators)
            const hCuts = canCutH ? this.findSeparators(hProfile, minSpriteHeight, separatorConfidence, gutterWidth) : [];
            const vCuts = canCutV ? this.findSeparators(vProfile, minSpriteWidth, separatorConfidence, gutterWidth) : [];

            // 若兩方向皆無可信分割線，則此區域為不可分割的候選矩形
            if (hCuts.length === 0 && vCuts.length === 0) {
                return [box];
            }

            // 決定優先切割方向：
            let chooseHorizontal = false;
            if (hCuts.length > 0 && vCuts.length === 0) {
                chooseHorizontal = true;
            } else if (vCuts.length > 0 && hCuts.length === 0) {
                chooseHorizontal = false;
            } else {
                if (box.height >= box.width * 1.2) {
                    chooseHorizontal = true;
                } else if (box.width >= box.height * 1.2) {
                    chooseHorizontal = false;
                } else {
                    const bestHConf = Math.max(...hCuts.map(c => c.confidence));
                    const bestVConf = Math.max(...vCuts.map(c => c.confidence));
                    chooseHorizontal = bestHConf >= bestVConf;
                }
            }

            if (chooseHorizontal && hCuts.length > 0) {
                // 記錄 Gutter 線段 (供除錯視圖渲染)
                for (const c of hCuts) {
                    allGutters.push({
                        orientation: 'H',
                        x: box.x,
                        y: box.y + c.pos,
                        length: box.width,
                        confidence: c.confidence
                    });
                }

                // 沿水平分割線切分成多個水平帶 (Horizontal Bands)
                const cuts = [0, ...hCuts.map(c => c.pos), box.height];
                const results = [];
                for (let i = 0; i < cuts.length - 1; i++) {
                    const sy = cuts[i];
                    const ey = cuts[i + 1];
                    const sh = ey - sy;
                    if (sh >= minSpriteHeight * 0.8) {
                        const sub = {
                            x: box.x,
                            y: box.y + sy,
                            width: box.width,
                            height: sh,
                            reason: `enclosed by horizontal gutters (conf ${Math.round((hCuts[Math.min(i, hCuts.length - 1)]?.confidence || 0.8) * 100)}%)`
                        };
                        results.push(...recursiveCut(sub, depth + 1));
                    }
                }
                if (results.length > 1) return results;
            }

            if (!chooseHorizontal && vCuts.length > 0) {
                // 記錄 Gutter 線段
                for (const c of vCuts) {
                    allGutters.push({
                        orientation: 'V',
                        x: box.x + c.pos,
                        y: box.y,
                        length: box.height,
                        confidence: c.confidence
                    });
                }

                // 沿垂直分割線切分成多個垂直欄 (Vertical Columns)
                const cuts = [0, ...vCuts.map(c => c.pos), box.width];
                const results = [];
                for (let i = 0; i < cuts.length - 1; i++) {
                    const sx = cuts[i];
                    const ex = cuts[i + 1];
                    const sw = ex - sx;
                    if (sw >= minSpriteWidth * 0.8) {
                        const sub = {
                            x: box.x + sx,
                            y: box.y,
                            width: sw,
                            height: box.height,
                            reason: `enclosed by vertical gutters (conf ${Math.round((vCuts[Math.min(i, vCuts.length - 1)]?.confidence || 0.8) * 100)}%)`
                        };
                        results.push(...recursiveCut(sub, depth + 1));
                    }
                }
                if (results.length > 1) return results;
            }

            return [box];
        };

        const rawCandidates = recursiveCut({
            x: 0,
            y: 0,
            width,
            height,
            reason: 'initial full canvas'
        }, 0);

        // 依據 minSpriteArea 過濾極小候選框
        const validCandidates = rawCandidates.filter(c => c.width * c.height >= minSpriteArea * 0.5);

        return {
            candidates: validCandidates,
            gutters: allGutters,
            globalHProfile: globalProfiles.hProfile,
            globalVProfile: globalProfiles.vProfile
        };
    }

    /**
     * 計算區域內水平與垂直投影輪廓
     */
    static computeProfiles(mask, totalWidth, totalHeight, region) {
        const rx = Math.max(0, Math.round(region.x));
        const ry = Math.max(0, Math.round(region.y));
        const rw = Math.min(totalWidth - rx, Math.round(region.width));
        const rh = Math.min(totalHeight - ry, Math.round(region.height));

        const hProfile = new Int32Array(rh);
        const vProfile = new Int32Array(rw);

        for (let dy = 0; dy < rh; dy++) {
            const py = ry + dy;
            const rowOffset = py * totalWidth;
            for (let dx = 0; dx < rw; dx++) {
                const px = rx + dx;
                if (mask[rowOffset + px] === 1) {
                    hProfile[dy]++;
                    vProfile[dx]++;
                }
            }
        }

        return { hProfile, vProfile };
    }

    /**
     * 在投影波形中尋找具有顯著置信度的分割線 (Separators)
     * 支援：
     * 1. Empty Runs (完全透明 / 零背景連續帶，絕對優先)
     * 2. Adaptive Prominence Valleys (多欄多行疊加下的全域/局部顯著波谷)
     * @param {Int32Array} profile 
     * @param {number} minSpan 最小 Sprite 尺寸
     * @param {number} minDrop 最小相對波谷跌幅門檻
     * @param {number} gutterWidth 最小間隙寬度
     * @returns {Array<{pos: number, confidence: number, val: number}>}
     */
    static findSeparators(profile, minSpan = 16, minDrop = 0.20, gutterWidth = 1) {
        const len = profile.length;
        if (!profile || len < minSpan * 2) return [];

        // 3-Tap 平滑濾波以去除微小隨機噪聲
        const smoothed = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            const p0 = i > 0 ? profile[i - 1] : profile[i];
            const p1 = profile[i];
            const p2 = i < len - 1 ? profile[i + 1] : profile[i];
            smoothed[i] = (p0 + 2 * p1 + p2) * 0.25;
        }

        let maxP = 0, minP = Infinity;
        for (let i = 0; i < len; i++) {
            if (smoothed[i] > maxP) maxP = smoothed[i];
            if (smoothed[i] < minP) minP = smoothed[i];
        }

        if (maxP <= 2) return [];

        // 動態範圍檢查：若區域內最大值與最小值差異不足 30%，說明內部均勻，不存在顯著 Gutter
        const rng = maxP - minP;
        if (rng < Math.max(6, maxP * 0.30)) return [];

        // 1. 優先尋找 Empty Runs (數值為 0 或極近 0 的完全背景通道)
        const emptySeparators = [];
        let inZeroRun = false;
        let zeroStart = 0;
        const zeroThresh = Math.max(1, maxP * 0.03);

        for (let i = 0; i < len; i++) {
            if (smoothed[i] <= zeroThresh) {
                if (!inZeroRun) {
                    inZeroRun = true;
                    zeroStart = i;
                }
            } else {
                if (inZeroRun) {
                    inZeroRun = false;
                    const runLen = i - zeroStart;
                    if (runLen >= gutterWidth) {
                        const mid = Math.floor((zeroStart + i) / 2);
                        emptySeparators.push({
                            pos: mid,
                            confidence: 1.0,
                            val: smoothed[mid]
                        });
                    }
                }
            }
        }
        if (inZeroRun) {
            const runLen = len - zeroStart;
            if (runLen >= gutterWidth) {
                const mid = Math.floor((zeroStart + len) / 2);
                emptySeparators.push({
                    pos: mid,
                    confidence: 1.0,
                    val: smoothed[mid]
                });
            }
        }

        // 若存在絕對 Empty Gutter，以此為唯一黃金標準
        if (emptySeparators.length > 0) {
            const selected = [];
            const spanThresh = minSpan * 0.8;
            for (const cand of emptySeparators) {
                const p = cand.pos;
                if (p < spanThresh || (len - p) < spanThresh) continue;
                if (!selected.some(s => Math.abs(p - s.pos) < spanThresh)) {
                    selected.push(cand);
                }
            }
            if (selected.length > 0) {
                selected.sort((a, b) => a.pos - b.pos);
                return selected;
            }
        }

        // 2. 自適應顯著波谷 (Adaptive Valleys)
        const valleyThresh = minP + rng * Math.min(0.35, Math.max(0.15, minDrop * 1.5));
        const valleySeparators = [];
        let inValley = false;
        let minVal = Infinity;
        let minPos = 0;

        for (let i = 0; i < len; i++) {
            const val = smoothed[i];
            if (val <= valleyThresh) {
                if (!inValley) {
                    inValley = true;
                    minVal = val;
                    minPos = i;
                } else if (val < minVal) {
                    minVal = val;
                    minPos = i;
                }
            } else {
                if (inValley) {
                    inValley = false;
                    const conf = Math.max(0.4, 1.0 - (minVal / Math.max(1, maxP)));
                    valleySeparators.push({ pos: minPos, confidence: conf, val: minVal });
                }
            }
        }
        if (inValley) {
            const conf = Math.max(0.4, 1.0 - (minVal / Math.max(1, maxP)));
            valleySeparators.push({ pos: minPos, confidence: conf, val: minVal });
        }

        if (valleySeparators.length === 0) return [];

        // 依據 minSpan * 0.8 進行非極大值間隙抑制 (NMS)
        const selected = [];
        const spanThresh = minSpan * 0.8;

        for (const cand of valleySeparators) {
            const p = cand.pos;
            if (p < spanThresh || (len - p) < spanThresh) continue;
            const tooClose = selected.some(s => Math.abs(p - s.pos) < spanThresh);
            if (!tooClose) {
                selected.push(cand);
            }
        }

        selected.sort((a, b) => a.pos - b.pos);
        return selected;
    }
}
