/**
 * DistanceTransform
 * 精確 2D 歐式距離變換 (Euclidean Distance Transform, EDT)
 * 採用 Felzenszwalb & Huttenlocher 快速拋物線包絡線演算法，具有 O(N) 線性時間複雜度
 */
export class DistanceTransform {
    /**
     * 計算二值前景遮罩的歐氏距離變換 (EDT)
     * 每個前景像素的值為該像素到最近背景像素的歐氏距離 (px)
     * @param {Uint8Array} mask 0=背景, 1=前景
     * @param {number} width 影像寬度
     * @param {number} height 影像高度
     * @param {{x?: number, y?: number, width?: number, height?: number}} [region] 可選局部區域
     * @returns {Float32Array} 距離圖 (Float32Array，長度為 region 區域或全圖大小)
     */
    static compute(mask, width, height, region = null) {
        const rx = region ? Math.max(0, Math.round(region.x)) : 0;
        const ry = region ? Math.max(0, Math.round(region.y)) : 0;
        const rw = region ? Math.min(width - rx, Math.round(region.width)) : width;
        const rh = region ? Math.min(height - ry, Math.round(region.height)) : height;

        const INF = 1e9;
        // 初始化網格：前景 = INF, 背景 = 0 (平方距離)
        const dSq = new Float64Array(rw * rh);

        for (let dy = 0; dy < rh; dy++) {
            const py = ry + dy;
            const rowOffsetFull = py * width;
            const rowOffsetSub = dy * rw;

            for (let dx = 0; dx < rw; dx++) {
                const px = rx + dx;
                if (px < 0 || px >= width || py < 0 || py >= height) {
                    dSq[rowOffsetSub + dx] = 0;
                } else {
                    dSq[rowOffsetSub + dx] = (mask[rowOffsetFull + px] === 1) ? INF : 0;
                }
            }
        }

        // 階段一：對每欄 (Column) 進行 1D 距離變換
        const colF = new Float64Array(rh);
        const colD = new Float64Array(rh);
        for (let x = 0; x < rw; x++) {
            for (let y = 0; y < rh; y++) {
                colF[y] = dSq[y * rw + x];
            }
            this._dt1D(colF, colD, rh);
            for (let y = 0; y < rh; y++) {
                dSq[y * rw + x] = colD[y];
            }
        }

        // 階段二：對每列 (Row) 進行 1D 距離變換
        const rowF = new Float64Array(rw);
        const rowD = new Float64Array(rw);
        const distMap = new Float32Array(rw * rh);

        for (let y = 0; y < rh; y++) {
            const rowOffset = y * rw;
            for (let x = 0; x < rw; x++) {
                rowF[x] = dSq[rowOffset + x];
            }
            this._dt1D(rowF, rowD, rw);
            for (let x = 0; x < rw; x++) {
                distMap[rowOffset + x] = Math.sqrt(rowD[x]);
            }
        }

        return distMap;
    }

    /**
     * 1D 距離變換 (Felzenszwalb & Huttenlocher 演算法)
     * @private
     */
    static _dt1D(f, d, n) {
        const v = new Int32Array(n);
        const z = new Float64Array(n + 1);
        let k = 0;
        v[0] = 0;
        z[0] = -1e9;
        z[1] = 1e9;

        for (let q = 1; q < n; q++) {
            let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            while (s <= z[k]) {
                k--;
                s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            }
            k++;
            v[k] = q;
            z[k] = s;
            z[k + 1] = 1e9;
        }

        k = 0;
        for (let q = 0; q < n; q++) {
            while (z[k + 1] < q) {
                k++;
            }
            const dx = q - v[k];
            d[q] = dx * dx + f[v[k]];
        }
    }

    /**
     * 在距離圖中尋找顯著的局部極大值核心 (Local Maxima Peaks)
     * @param {Float32Array} distMap 
     * @param {number} width 
     * @param {number} height 
     * @param {Object} [options]
     * @param {number} [options.minDistance=12] 兩峰值間的最小間隔
     * @param {number} [options.minThreshold=3.5] 峰值最小距離門檻 (小於此值視為雜訊細枝)
     * @param {number} [options.maxPeaks=64] 最大允許返回的峰值數量
     * @returns {Array<{x: number, y: number, value: number}>}
     */
    static findLocalMaxima(distMap, width, height, options = {}) {
        const {
            minDistance = 12,
            minThreshold = 3.5,
            maxPeaks = 64
        } = options;

        const win = Math.max(2, Math.floor(minDistance / 2));
        const candidates = [];

        for (let y = win; y < height - win; y++) {
            const rowOffset = y * width;
            for (let x = win; x < width - win; x++) {
                const val = distMap[rowOffset + x];
                if (val < minThreshold) continue;

                let isMax = true;
                // 檢查周圍窗口範圍內是否為唯一局部最高點
                for (let dy = -win; dy <= win; dy++) {
                    const ny = y + dy;
                    const nOffset = ny * width;
                    for (let dx = -win; dx <= win; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const nVal = distMap[nOffset + nx];
                        if (nVal > val || (nVal === val && (dy < 0 || (dy === 0 && dx < 0)))) {
                            isMax = false;
                            break;
                        }
                    }
                    if (!isMax) break;
                }

                if (isMax) {
                    candidates.push({ x, y, value: val });
                }
            }
        }

        // 依峰值高度降序排序
        candidates.sort((a, b) => b.value - a.value);

        // 防相鄰過近抑制 (Non-Maximum Suppression)
        const filtered = [];
        const minDistanceSq = minDistance * minDistance;

        for (const cand of candidates) {
            const tooClose = filtered.some(f => {
                const dx = cand.x - f.x;
                const dy = cand.y - f.y;
                return (dx * dx + dy * dy) < minDistanceSq;
            });

            if (!tooClose) {
                filtered.push(cand);
                if (filtered.length >= maxPeaks) break;
            }
        }

        return filtered;
    }
}
