import { MetadataDetector } from './MetadataDetector.js';
import { AlphaSegmenter } from './AlphaSegmenter.js';
import { BackgroundSegmenter } from './BackgroundSegmenter.js';
import { MorphologicalProcessor } from './MorphologicalProcessor.js';
import { RecursiveXYCut } from './RecursiveXYCut.js';
import { ConnectedComponentDetector } from './ConnectedComponentDetector.js';
import { ComponentGrouper } from './ComponentGrouper.js';
import { WatershedSegmenter } from './WatershedSegmenter.js';
import { BoundingBoxRefiner } from './BoundingBoxRefiner.js';

/**
 * AtlasAnalyzer
 * 智慧圖集分析主協調器 (Pipeline Facade)
 * 
 * 核心原則：
 * 先偵測 Sprite 之間的空隙 (Gutters) 與矩形區域 (Recursive XY-Cut)，
 * 再使用 Connected Components 作為輔助驗證，徹底杜絕 Over-segmentation（過度分割）問題。
 */
export class AtlasAnalyzer {
    /**
     * 對圖集進行完整自動辨識分析
     * @param {HTMLImageElement|HTMLCanvasElement} source 
     * @param {Object} options
     * @param {string} [options.bgType='auto'] 'auto' | 'alpha' | 'dark' | 'light'
     * @param {number} [options.alphaThreshold=15]
     * @param {number} [options.bgTolerance=28]
     * @param {number} [options.minSpriteWidth=16]
     * @param {number} [options.minSpriteHeight=16]
     * @param {number} [options.minSpriteArea=256]
     * @param {number} [options.minComponentArea=4]
     * @param {number} [options.mergeDistance=0]
     * @param {number} [options.separatorConfidence=0.20]
     * @param {number} [options.gutterWidth=1]
     * @param {number} [options.occupancyThreshold=0.04]
     * @param {number} [options.padding=0]
     * @param {number} [options.morphCloseRadius=0]
     * @param {boolean} [options.enableWatershed=false]
     * @param {number} [options.watershedDistance=14]
     * @param {Object|string} [metadata] 可選的外部 metadata
     * @returns {Promise<{sprites: Array, stats: Object, debugData: Object}>}
     */
    static async analyze(source, options = {}, metadata = null) {
        const startTime = performance.now();

        // 1. 最高優先級：Metadata 檢測
        if (metadata) {
            const parsed = MetadataDetector.parse(metadata);
            if (parsed && parsed.length > 0) {
                return {
                    sprites: parsed,
                    stats: {
                        source: 'metadata',
                        count: parsed.length,
                        durationMs: Math.round(performance.now() - startTime)
                    },
                    debugData: null
                };
            }
        }

        // 準備 Canvas 與 ImageData
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;

        let canvas;
        let ctx;
        if ((typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) || (source && typeof source.getContext === 'function')) {
            canvas = source;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, width, height);
        }

        const imageData = ctx.getImageData(0, 0, width, height);

        // 參數解析 (支援新命名與向後相容命名)
        const baseMinSize = options.minSize || 16;
        const minSpriteWidth = options.minSpriteWidth || baseMinSize;
        const minSpriteHeight = options.minSpriteHeight || baseMinSize;
        const minSpriteArea = options.minSpriteArea || (minSpriteWidth * minSpriteHeight);
        const minComponentArea = options.minComponentArea || 4;
        const mergeDistance = typeof options.mergeDistance === 'number' ? options.mergeDistance : (options.mergeGap || options.groupDistance || 0);
        const separatorConfidence = typeof options.separatorConfidence === 'number' ? options.separatorConfidence : 0.20;
        const gutterWidth = options.gutterWidth || 1;
        const occupancyThreshold = typeof options.occupancyThreshold === 'number' ? options.occupancyThreshold : 0.04;
        const padding = options.padding || 0;
        const morphCloseRadius = options.morphCloseRadius || 0;
        const enableWatershed = Boolean(options.enableWatershed);
        const watershedDistance = options.watershedDistance || 14;

        const bgType = options.bgType || 'auto';
        const alphaThreshold = typeof options.alphaThreshold === 'number' ? options.alphaThreshold : 15;
        const bgTolerance = typeof options.bgTolerance === 'number' ? options.bgTolerance : 28;

        // ============================================================
        // 第一階段：建立 Foreground / Occupancy Mask
        // ============================================================
        const hasAlpha = AlphaSegmenter.hasAlphaChannel(imageData.data, width, height);
        let rawMask;
        let segMode = 'alpha';

        if (bgType === 'alpha' || (bgType === 'auto' && hasAlpha)) {
            const segResult = AlphaSegmenter.segment(imageData, alphaThreshold);
            rawMask = segResult.mask;
            segMode = 'alpha';
        } else {
            const segResult = BackgroundSegmenter.segment(imageData, {
                bgType,
                bgTolerance
            });
            rawMask = segResult.mask;
            segMode = 'background';
        }

        // 形態學閉合處理 (消除內部斷孔)
        let mask = rawMask;
        if (morphCloseRadius > 0) {
            mask = MorphologicalProcessor.close(rawMask, width, height, morphCloseRadius);
        }

        // ============================================================
        // 第二階段 & 第三階段：Recursive XY-Cut & Candidate Rectangles
        // 先尋找圖集全域與局部 Gutter，分割出候選矩形
        // ============================================================
        const xyCutResult = RecursiveXYCut.segment(mask, width, height, {
            minSpriteWidth,
            minSpriteHeight,
            minSpriteArea,
            separatorConfidence,
            gutterWidth
        });

        const candidates = xyCutResult.candidates;
        const gutters = xyCutResult.gutters;

        // ============================================================
        // 第四階段：Connected Components (CCL) 作為輔助用途
        // CCL 不再直接當作 Sprite，而是用來：
        // 1. 驗證 Candidate 是否包含前景
        // 2. 檢測極小 Noise
        // 3. 補捉未被 XY-Cut 完整劃分到的孤立小元件
        // ============================================================
        const rawComponents = ConnectedComponentDetector.findComponents(mask, width, height, {
            minPixelCount: minComponentArea
        });

        // 建立 Candidate 內的精確 Sprite Bounding Box
        const candidateSprites = [];
        const candidateMatchedComps = new Set();

        for (const cand of candidates) {
            // 計算此 Candidate 矩形內的前景佔用像素
            let fgPixelCount = 0;
            const rx = Math.max(0, Math.round(cand.x));
            const ry = Math.max(0, Math.round(cand.y));
            const rw = Math.min(width - rx, Math.round(cand.width));
            const rh = Math.min(height - ry, Math.round(cand.height));
            const candArea = rw * rh;

            if (candArea <= 0) continue;

            for (let dy = 0; dy < rh; dy++) {
                const rowOffset = (ry + dy) * width;
                for (let dx = 0; dx < rw; dx++) {
                    if (mask[rowOffset + rx + dx] === 1) {
                        fgPixelCount++;
                    }
                }
            }

            const occupancy = fgPixelCount / candArea;

            // 若內部前景像素過少或佔用率極低，判定為純背景空隙 (Gutter/Whitespace)
            if (fgPixelCount < minComponentArea || occupancy < occupancyThreshold) {
                continue;
            }

            // 緊貼前景像素邊緣收縮 (Tight Bounding Box)
            const tightBox = BoundingBoxRefiner.shrinkToTightBox(
                { x: rx, y: ry, width: rw, height: rh, reason: cand.reason || 'enclosed by strong gutters' },
                mask,
                width,
                height
            );

            if (!tightBox) continue;

            // 標記落在該 candidate 內的 components (含邊界容差)
            for (const comp of rawComponents) {
                if (comp.centerX >= rx - 4 && comp.centerX <= rx + rw + 4 &&
                    comp.centerY >= ry - 4 && comp.centerY <= ry + rh + 4) {
                    candidateMatchedComps.add(comp.id);
                }
            }

            // 檢查候選框尺寸約束
            if (tightBox.width >= minSpriteWidth * 0.6 && tightBox.height >= minSpriteHeight * 0.6) {
                candidateSprites.push({
                    x: tightBox.x,
                    y: tightBox.y,
                    width: tightBox.width,
                    height: tightBox.height,
                    reason: cand.reason || 'enclosed by strong gutters'
                });
            }
        }

        // ============================================================
        // 第五階段：Aggressive Component Grouping (合併未被劃分到的孤立 Components)
        // 原則："When uncertain, prefer grouping nearby components into one sprite
        //        unless there is strong separator evidence between them."
        // ============================================================
        const uncoveredComponents = rawComponents.filter(c => !candidateMatchedComps.has(c.id));
        if (uncoveredComponents.length > 0) {
            // 對未被候選矩形包裹的零星元件進行積極聚合 (Aggressive Grouping)
            const groupedUncovered = ComponentGrouper.group(uncoveredComponents, {
                groupDistance: Math.max(12, mergeDistance || 10),
                minSize: Math.min(minSpriteWidth, minSpriteHeight),
                imgWidth: width,
                imgHeight: height
            });

            for (const g of groupedUncovered) {
                // 嚴格避免與現有 candidate 框體重疊
                const isOverlap = candidateSprites.some(cs => {
                    const ox = Math.max(0, Math.min(g.x + g.width, cs.x + cs.width) - Math.max(g.x, cs.x));
                    const oy = Math.max(0, Math.min(g.y + g.height, cs.y + cs.height) - Math.max(g.y, cs.y));
                    return (ox * oy) > (g.width * g.height * 0.2);
                });

                if (!isOverlap && g.width >= minSpriteWidth * 0.6 && g.height >= minSpriteHeight * 0.6) {
                    candidateSprites.push({
                        x: g.x,
                        y: g.y,
                        width: g.width,
                        height: g.height,
                        reason: 'component grouping'
                    });
                }
            }
        }

        // ============================================================
        // 可選：Watershed 分水嶺沾黏分離 (針對極度沾黏且面積過大的複合區塊)
        // ============================================================
        let currentBoxes = candidateSprites;
        let watershedSplitCount = 0;

        if (enableWatershed) {
            const wsBoxes = [];
            for (const b of currentBoxes) {
                // 僅當候選框體大於正常 Sprite 兩倍以上時才需啟動分水嶺判斷
                if (b.width >= minSpriteWidth * 2.2 || b.height >= minSpriteHeight * 2.2) {
                    const wsSplits = WatershedSegmenter.separateTouchingSprites(
                        b,
                        mask,
                        width,
                        height,
                        {
                            minPeakDistance: watershedDistance,
                            minPeakThreshold: 4.0,
                            minSubSize: Math.min(minSpriteWidth, minSpriteHeight)
                        }
                    );
                    if (wsSplits.length > 1) {
                        watershedSplitCount += (wsSplits.length - 1);
                        wsSplits.forEach(split => {
                            split.reason = 'watershed split';
                        });
                        wsBoxes.push(...wsSplits);
                    } else {
                        wsBoxes.push(b);
                    }
                } else {
                    wsBoxes.push(b);
                }
            }
            currentBoxes = wsBoxes;
        }

        // ============================================================
        // 第六階段：加入 Minimum Sprite Constraints 與微調 (Refiner)
        // 嚴格過濾噪聲碎片，微調外接框、信心評估、自然排序
        // ============================================================
        const refinedSprites = BoundingBoxRefiner.refine(currentBoxes, mask, width, height, {
            minSize: Math.min(minSpriteWidth, minSpriteHeight),
            mergeGap: mergeDistance,
            padding
        });

        // 再次確保 minSpriteArea 約束
        const validSprites = refinedSprites.filter(s => s.width * s.height >= minSpriteArea * 0.5);

        const durationMs = Math.round(performance.now() - startTime);

        // ============================================================
        // 第七階段：建構 Debug Visualization 數據包
        // ============================================================
        const debugData = {
            mask,
            components: rawComponents,
            gutters,
            candidates,
            globalHProfile: xyCutResult.globalHProfile,
            globalVProfile: xyCutResult.globalVProfile,
            width,
            height
        };

        return {
            sprites: validSprites,
            stats: {
                source: 'recursive_xy_cut_pipeline',
                segMode,
                hasAlpha,
                rawComponentCount: rawComponents.length,
                candidateCount: candidates.length,
                gutterCount: gutters.length,
                watershedSplitCount,
                count: validSprites.length,
                durationMs
            },
            debugData
        };
    }
}
