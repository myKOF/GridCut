import { ConfidenceEvaluator } from './ConfidenceEvaluator.js';

/**
 * BoundingBoxRefiner
 * 計算緊湊邊界框、過濾雜訊、合併相近碎塊、加上 Padding 並確保不超出圖集邊界
 */
export class BoundingBoxRefiner {
    /**
     * @param {Array<{x: number, y: number, width: number, height: number, pixelCount?: number}>} rawBoxes 
     * @param {Uint8Array} mask 
     * @param {number} imgWidth 
     * @param {number} imgHeight 
     * @param {Object} options
     * @param {number} [options.minSize=16] 最小寬度與高度
     * @param {number} [options.mergeGap=0] 合併間距
     * @param {number} [options.padding=0] 外擴邊距
     * @returns {Array<{id: string, x: number, y: number, width: number, height: number, confidence: number}>}
     */
    static refine(rawBoxes, mask, imgWidth, imgHeight, options = {}) {
        const {
            minSize = 16,
            mergeGap = 0,
            padding = 0
        } = options;

        // 1. 初步過濾低於最小尺寸的框
        let boxes = rawBoxes.filter(b => b.width >= minSize && b.height >= minSize);

        // 2. 緊湊化 (Tight Bounding Box)，根據 Mask 縮減多餘空白
        boxes = boxes.map(b => this.shrinkToTightBox(b, mask, imgWidth, imgHeight)).filter(b => b && b.width >= minSize && b.height >= minSize);

        // 3. 鄰近小碎塊合併 (若 mergeGap > 0，嚴格禁止獨立主體互溶)
        if (mergeGap > 0 && boxes.length > 1) {
            boxes = this.mergeCloseBoxes(boxes, mergeGap, minSize);
        }

        // 4. 重疊度去重 (Deduplication)
        boxes = this.removeDuplicatesAndContainment(boxes);

        // 5. 加上 Padding 與防溢邊界限制 (Clamp to [0, imgWidth], [0, imgHeight])
        const refined = boxes.map(b => {
            const px = Math.max(0, b.x - padding);
            const py = Math.max(0, b.y - padding);
            const pw = Math.min(imgWidth - px, b.width + padding * 2);
            const ph = Math.min(imgHeight - py, b.height + padding * 2);

            // 透過多維度評估器計算信心分數
            const confEval = ConfidenceEvaluator.evaluate(b, mask, imgWidth, imgHeight);

            return {
                x: Math.round(px),
                y: Math.round(py),
                width: Math.round(pw),
                height: Math.round(ph),
                confidence: confEval.score,
                confidenceCategory: confEval.category,
                confidenceBreakdown: confEval.breakdown,
                reason: b.reason || 'enclosed by gutters'
            };
        });

        // 6. 自然閱讀順序排序 (從上到下、從左到右)
        refined.sort((a, b) => {
            const rowDiff = Math.abs(a.y - b.y);
            const avgH = (a.height + b.height) / 2;
            if (rowDiff < avgH * 0.45) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        // 7. 給予正式 ID
        return refined.map((b, idx) => ({
            id: `sprite_${String(idx + 1).padStart(3, '0')}`,
            ...b
        }));
    }

    /**
     * 緊貼實際前景像素邊緣
     */
    static shrinkToTightBox(b, mask, imgWidth, imgHeight) {
        let minX = b.x + b.width, maxX = b.x;
        let minY = b.y + b.height, maxY = b.y;
        let found = false;

        for (let y = b.y; y < b.y + b.height; y++) {
            if (y < 0 || y >= imgHeight) continue;
            const rowOffset = y * imgWidth;

            for (let x = b.x; x < b.x + b.width; x++) {
                if (x < 0 || x >= imgWidth) continue;

                if (mask[rowOffset + x] === 1) {
                    found = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (!found || maxX < minX || maxY < minY) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
            reason: b.reason || 'enclosed by gutters'
        };
    }

    /**
     * 合併相鄰小於指定 gap 的框體 (嚴格保護 Primary Sprite，禁止多個獨立主體骨牌式連環合併)
     */
    static mergeCloseBoxes(boxes, gap, minSize = 16) {
        let current = [...boxes];
        let mergedAny = true;

        const isPrimary = (b) => b.width >= minSize && b.height >= minSize;

        while (mergedAny) {
            mergedAny = false;
            const nextList = [];
            const used = new Array(current.length).fill(false);

            for (let i = 0; i < current.length; i++) {
                if (used[i]) continue;
                let b = { ...current[i] };

                for (let j = i + 1; j < current.length; j++) {
                    if (used[j]) continue;
                    const o = current[j];

                    // 若兩者皆為獨立主體 Sprite，絕對禁止互相合併！
                    if (isPrimary(b) && isPrimary(o)) {
                        continue;
                    }

                    // 檢查兩框距離是否小於等於 gap
                    const gapX = Math.max(0, Math.max(b.x, o.x) - Math.min(b.x + b.width, o.x + o.width));
                    const gapY = Math.max(0, Math.max(b.y, o.y) - Math.min(b.y + b.height, o.y + o.height));

                    if (gapX <= gap && gapY <= gap) {
                        // 合併非主體碎片
                        const nx1 = Math.min(b.x, o.x);
                        const ny1 = Math.min(b.y, o.y);
                        const nx2 = Math.max(b.x + b.width, o.x + o.width);
                        const ny2 = Math.max(b.y + b.height, o.y + o.height);

                        b.x = nx1;
                        b.y = ny1;
                        b.width = nx2 - nx1;
                        b.height = ny2 - ny1;
                        used[j] = true;
                        mergedAny = true;
                    }
                }
                nextList.push(b);
            }
            current = nextList;
        }

        return current;
    }

    /**
     * 過濾重複框與高包含度框
     */
    static removeDuplicatesAndContainment(boxes) {
        boxes.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        const deduplicated = [];

        for (const b of boxes) {
            let isRedundant = false;
            for (const exist of deduplicated) {
                const ox = Math.max(0, Math.min(b.x + b.width, exist.x + exist.width) - Math.max(b.x, exist.x));
                const oy = Math.max(0, Math.min(b.y + b.height, exist.y + exist.height) - Math.max(b.y, exist.y));
                const oArea = ox * oy;
                const bArea = b.width * b.height;

                // 若被較大框覆蓋超過 80%
                if (oArea > bArea * 0.8) {
                    isRedundant = true;
                    break;
                }
            }
            if (!isRedundant) deduplicated.push(b);
        }

        return deduplicated;
    }

    /**
     * 評估 Bounding Box 信心度 (委派至 ConfidenceEvaluator)
     */
    static calculateConfidence(b, mask, imgWidth, imgHeight) {
        return ConfidenceEvaluator.evaluate(b, mask, imgWidth, imgHeight).score;
    }
}
