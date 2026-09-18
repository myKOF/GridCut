import { DistanceTransform } from './DistanceTransform.js';

/**
 * WatershedSegmenter
 * 基於標記控制分水嶺演算法 (Marker-Controlled Watershed)
 * 專為解決不規則外型、斜向相碰、相互沾黏 (Touching Sprites) 之精密分割
 */
export class WatershedSegmenter {
    /**
     * 對特定區塊或複合物件執行分水嶺沾黏分離
     * @param {{x: number, y: number, width: number, height: number}} box 
     * @param {Uint8Array} mask 全圖二值遮罩 (0=背景, 1=前景)
     * @param {number} imgWidth 
     * @param {number} imgHeight 
     * @param {Object} [options]
     * @param {number} [options.minPeakDistance=14] 兩物件核心間的最小間隔
     * @param {number} [options.minPeakThreshold=4.0] 核心最小距離門檻
     * @param {number} [options.minSubSize=16] 切分後子圖最小尺寸
     * @returns {Array<{x: number, y: number, width: number, height: number}>} 切分出的子框清單 (若無法分離則返回 [box])
     */
    static separateTouchingSprites(box, mask, imgWidth, imgHeight, options = {}) {
        const {
            minPeakDistance = 14,
            minPeakThreshold = 4.0,
            minSubSize = 16
        } = options;

        const bx = Math.max(0, Math.round(box.x));
        const by = Math.max(0, Math.round(box.y));
        const bw = Math.min(imgWidth - bx, Math.round(box.width));
        const bh = Math.min(imgHeight - by, Math.round(box.height));

        // 若尺寸過小，不需進行分水嶺分離
        if (bw < minSubSize * 1.5 && bh < minSubSize * 1.5) {
            return [box];
        }

        // 1. 計算該局部區域之歐氏距離變換 (EDT)
        const distMap = DistanceTransform.compute(mask, imgWidth, imgHeight, { x: bx, y: by, width: bw, height: bh });

        // 2. 尋找局部極大值核心 (Seed Markers)
        const peaks = DistanceTransform.findLocalMaxima(distMap, bw, bh, {
            minDistance: minPeakDistance,
            minThreshold: minPeakThreshold,
            maxPeaks: 32
        });

        // 若只有 0 或 1 個核心，代表為單一主體物件，無法/不需再拆分
        if (peaks.length <= 1) {
            return [box];
        }

        // 3. 標記控制分水嶺浸潤演算法 (階層式桶佇列 Hierarchical Bucket Queue)
        const labels = this._runMarkerWatershed(distMap, bw, bh, peaks);

        // 4. 根據各 Label 提取獨立 Bounding Box
        const subBoxes = this._extractBoxesFromLabels(labels, bw, bh, bx, by, minSubSize);

        if (subBoxes.length > 1) {
            return subBoxes;
        }

        return [box];
    }

    /**
     * 執行標記控制分水嶺浸潤 (從峰值核心向邊界擴展)
     * @private
     */
    static _runMarkerWatershed(distMap, width, height, markers) {
        const total = width * height;
        const labels = new Int32Array(total);

        let maxDist = 0;
        for (let i = 0; i < total; i++) {
            if (distMap[i] > maxDist) maxDist = distMap[i];
        }

        // 量化為整數桶 (Bucket Queue，每 0.5px 一個桶，速度極快且精確)
        const numBuckets = Math.ceil(maxDist * 2) + 2;
        const buckets = Array.from({ length: numBuckets }, () => []);

        // 植入種子標記
        for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            const labelId = i + 1;
            const idx = m.y * width + m.x;
            labels[idx] = labelId;

            // 將種子的鄰居加入佇列
            this._pushNeighborsToBuckets(m.x, m.y, width, height, distMap, labels, buckets);
        }

        // 從最高距離 (最核心) 到最低距離 (邊界) 逐層浸潤
        for (let b = numBuckets - 1; b >= 0; b--) {
            const bucket = buckets[b];
            while (bucket.length > 0) {
                const idx = bucket.pop();
                if (labels[idx] !== 0) continue; // 已被標記
                if (distMap[idx] <= 0) continue; // 背景像素不浸潤

                const x = idx % width;
                const y = Math.floor(idx / width);

                // 檢查 4-連通鄰居的標籤
                let neighborLabel = 0;
                let conflict = false;

                const checkNeighbor = (nx, ny) => {
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
                    const nLab = labels[ny * width + nx];
                    if (nLab > 0) {
                        if (neighborLabel === 0) {
                            neighborLabel = nLab;
                        } else if (neighborLabel !== nLab) {
                            conflict = true;
                        }
                    }
                };

                checkNeighbor(x - 1, y);
                checkNeighbor(x + 1, y);
                checkNeighbor(x, y - 1);
                checkNeighbor(x, y + 1);

                if (neighborLabel > 0) {
                    // 若兩側標籤相撞，此像素為山脊線 (Ridge)，歸屬至主要流向以保證 Sprite 邊緣連續
                    labels[idx] = neighborLabel;

                    // 繼續將未標記的前景鄰居推入桶佇列
                    this._pushNeighborsToBuckets(x, y, width, height, distMap, labels, buckets);
                }
            }
        }

        return labels;
    }

    /**
     * @private
     */
    static _pushNeighborsToBuckets(x, y, width, height, distMap, labels, buckets) {
        const tryPush = (nx, ny) => {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
            const nIdx = ny * width + nx;
            if (labels[nIdx] === 0 && distMap[nIdx] > 0) {
                const bIdx = Math.max(0, Math.min(buckets.length - 1, Math.round(distMap[nIdx] * 2)));
                buckets[bIdx].push(nIdx);
            }
        };

        tryPush(x - 1, y);
        tryPush(x + 1, y);
        tryPush(x, y - 1);
        tryPush(x, y + 1);
    }

    /**
     * 從分水嶺標籤圖提取獨立緊湊邊界框
     * @private
     */
    static _extractBoxesFromLabels(labels, width, height, offsetX, offsetY, minSubSize) {
        const boxMap = new Map();

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                const lab = labels[rowOffset + x];
                if (lab <= 0) continue;

                if (!boxMap.has(lab)) {
                    boxMap.set(lab, {
                        minX: x, minY: y, maxX: x, maxY: y, count: 1
                    });
                } else {
                    const b = boxMap.get(lab);
                    if (x < b.minX) b.minX = x;
                    if (x > b.maxX) b.maxX = x;
                    if (y < b.minY) b.minY = y;
                    if (y > b.maxY) b.maxY = y;
                    b.count++;
                }
            }
        }

        const results = [];
        for (const [lab, b] of boxMap.entries()) {
            const bw = b.maxX - b.minX + 1;
            const bh = b.maxY - b.minY + 1;

            if (bw >= minSubSize * 0.7 && bh >= minSubSize * 0.7 && b.count >= minSubSize * 4) {
                results.push({
                    x: offsetX + b.minX,
                    y: offsetY + b.minY,
                    width: bw,
                    height: bh
                });
            }
        }

        return results;
    }
}
