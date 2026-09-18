/**
 * GutterDetector
 * 計算水平與垂直投影輪廓 (Projection Profiles)
 * 透過零像素通道或自適應波谷 (Adaptive Valleys) 切分緊密黏連的複合 Sprite 區塊。
 */
export class GutterDetector {
    /**
     * 計算區域內的水平與垂直投影輪廓
     * @param {Uint8Array} mask 
     * @param {number} width 
     * @param {number} height 
     * @param {{x: number, y: number, width: number, height: number}} [region] 
     * @returns {{hProfile: Int32Array, vProfile: Int32Array}}
     */
    static computeProfiles(mask, width, height, region = null) {
        const rx = region ? Math.round(region.x) : 0;
        const ry = region ? Math.round(region.y) : 0;
        const rw = region ? Math.round(region.width) : width;
        const rh = region ? Math.round(region.height) : height;

        const hProfile = new Int32Array(rh);
        const vProfile = new Int32Array(rw);

        for (let dy = 0; dy < rh; dy++) {
            const py = ry + dy;
            if (py < 0 || py >= height) continue;
            const rowOffset = py * width;

            for (let dx = 0; dx < rw; dx++) {
                const px = rx + dx;
                if (px < 0 || px >= width) continue;

                if (mask[rowOffset + px] === 1) {
                    hProfile[dy]++;
                    vProfile[dx]++;
                }
            }
        }

        return { hProfile, vProfile };
    }

    /**
     * 自適應波谷檢測 (Adaptive Valley Detection - Local Minimum Prominence)
     * 能在存在雜訊、光暈、緊密多欄多列排列素材中，識別投影波形中的顯著低谷間隙
     * @param {Int32Array|Array<number>} profile 
     * @param {number} minSpan 最小區塊寬度/高度
     * @returns {Array<number>} 切割點相對座標清單
     */
    static findValleysAdaptive(profile, minSpan = 20) {
        const len = profile.length;
        if (!profile || len < minSpan * 1.8) return [];

        // 3-Tap 平滑濾波以去除單像素微小擾動
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

        if (maxP <= 2 || (maxP - minP) < 4) return [];

        // 視窗局部波谷檢測 (Local Minimum Prominence Detection)
        // 同時支援零間隙通道 (val <= 2) 與多欄多列混合下的局部顯著波谷 (drop >= 18%)
        const win = Math.max(3, Math.floor(minSpan / 5));
        const candidates = [];

        for (let i = win; i < len - win; i++) {
            const val = smoothed[i];
            let isLocalMin = true;
            for (let k = 1; k <= win; k++) {
                if (val > smoothed[i - k] || val > smoothed[i + k]) {
                    isLocalMin = false;
                    break;
                }
            }
            if (isLocalMin) {
                const lWin = Math.max(minSpan, Math.floor(minSpan * 1.5));
                let leftPeak = 0;
                for (let k = Math.max(0, i - lWin); k < i; k++) {
                    if (smoothed[k] > leftPeak) leftPeak = smoothed[k];
                }
                let rightPeak = 0;
                for (let k = i + 1; k <= Math.min(len - 1, i + lWin); k++) {
                    if (smoothed[k] > rightPeak) rightPeak = smoothed[k];
                }

                const peak = Math.min(leftPeak, rightPeak);
                const depth = peak - val;
                const drop = depth / Math.max(1, peak);

                if (val <= 2 || (depth >= 4 && drop >= 0.18)) {
                    candidates.push({ pos: i, val, depth, drop });
                }
            }
        }

        if (candidates.length === 0) return [];

        // 優先挑選絕對零值或相對深度最深的波谷，並確保彼此間隔 >= minSpan * 0.8
        candidates.sort((a, b) => {
            if ((a.val <= 2) !== (b.val <= 2)) {
                return (a.val <= 2) ? -1 : 1;
            }
            return b.drop - a.drop;
        });

        const selected = [];
        for (const c of candidates) {
            const p = c.pos;
            if (p < minSpan * 0.8 || (len - p) < minSpan * 0.8) continue;
            const tooClose = selected.some(s => Math.abs(p - s) < minSpan * 0.85);
            if (!tooClose) {
                selected.push(p);
            }
        }

        selected.sort((a, b) => a - b);
        return selected;
    }

    /**
     * 遞迴式利用投影間隙與自適應波谷切分可能粘連在一起的複合區塊
     * @param {{x: number, y: number, width: number, height: number}} box 
     * @param {Uint8Array} mask 
     * @param {number} totalWidth 
     * @param {number} totalHeight 
     * @param {Object} options
     * @param {number} [options.minSubSize=16] 
     * @param {number} [depth=0]
     * @returns {Array<{x: number, y: number, width: number, height: number}>}
     */
    static splitBoxByGutters(box, mask, totalWidth, totalHeight, options = {}, depth = 0) {
        const minSubSize = options.minSubSize || 16;

        if (depth > 12) {
            return [box];
        }
        if (box.width < minSubSize * 1.8 && box.height < minSubSize * 1.8) {
            return [box];
        }

        const { hProfile, vProfile } = this.computeProfiles(mask, totalWidth, totalHeight, box);

        // 1. 水平方向波谷切分 (若高度大於門檻，嘗試橫向切分多行)
        if (box.height >= minSubSize * 1.8) {
            const hCuts = this.findValleysAdaptive(hProfile, minSubSize);
            if (hCuts.length > 0) {
                const cuts = [0, ...hCuts, box.height];
                const results = [];
                for (let i = 0; i < cuts.length - 1; i++) {
                    const sy = cuts[i];
                    const ey = cuts[i + 1];
                    const sh = ey - sy;
                    if (sh >= minSubSize * 0.8) {
                        const subBox = {
                            x: box.x,
                            y: box.y + sy,
                            width: box.width,
                            height: sh
                        };
                        results.push(...this.splitBoxByGutters(subBox, mask, totalWidth, totalHeight, options, depth + 1));
                    }
                }
                if (results.length > 1) {
                    return results;
                }
            }
        }

        // 2. 垂直方向波谷切分 (若寬度大於門檻，嘗試縱向切分多欄)
        if (box.width >= minSubSize * 1.8) {
            const vCuts = this.findValleysAdaptive(vProfile, minSubSize);
            if (vCuts.length > 0) {
                const cuts = [0, ...vCuts, box.width];
                const results = [];
                for (let i = 0; i < cuts.length - 1; i++) {
                    const sx = cuts[i];
                    const ex = cuts[i + 1];
                    const sw = ex - sx;
                    if (sw >= minSubSize * 0.8) {
                        const subBox = {
                            x: box.x + sx,
                            y: box.y,
                            width: sw,
                            height: box.height
                        };
                        results.push(...this.splitBoxByGutters(subBox, mask, totalWidth, totalHeight, options, depth + 1));
                    }
                }
                if (results.length > 1) {
                    return results;
                }
            }
        }

        return [box];
    }
}
