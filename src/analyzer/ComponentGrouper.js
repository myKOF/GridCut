/**
 * ComponentGrouper
 * 幾何元件聚合演算法
 * 嚴格原則：只聚合主體邊緣之微小衛星碎片 (粒子、拖尾)，【絕對不合併】相鄰的獨立主體 Sprite！
 */
export class ComponentGrouper {
    /**
     * @param {Array<{id: number, x: number, y: number, width: number, height: number, pixelCount: number}>} components 
     * @param {Object} options
     * @param {number} [options.groupDistance=0] 允許聚合的最大間隙
     * @param {number} [options.minSize=16] 主體最小尺寸門檻
     * @param {number} [options.imgWidth] 圖集寬度
     * @param {number} [options.imgHeight] 圖集高度
     * @returns {Array<{x: number, y: number, width: number, height: number, pixelCount: number, componentCount: number}>}
     */
    static group(components, options = {}) {
        if (!components || components.length <= 1) {
            return components.map(c => ({ ...c, componentCount: 1 }));
        }

        const groupDistance = typeof options.groupDistance === 'number' ? options.groupDistance : 0;
        if (groupDistance <= 0) {
            return components.map(c => ({ ...c, componentCount: 1 }));
        }

        const minSize = options.minSize || 16;
        const primaryAreaThreshold = Math.max(80, Math.floor(minSize * minSize * 0.5));

        // 區分獨立主體 (Primary) 與微小碎片 (Fragment)
        const isPrimary = (c) => (c.width >= minSize && c.height >= minSize) || (c.pixelCount >= primaryAreaThreshold);

        const primaries = [];
        const fragments = [];

        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            if (isPrimary(comp)) {
                primaries.push({
                    x: comp.x,
                    y: comp.y,
                    width: comp.width,
                    height: comp.height,
                    pixelCount: comp.pixelCount,
                    componentCount: 1
                });
            } else {
                fragments.push(comp);
            }
        }

        // 獨立主體之間【絕不互相合併】，避免骨牌式擴散
        // 僅將微小碎片吸附至距離最近且小於 groupDistance 的單一主體
        const unabsorbedFragments = [];

        for (const frag of fragments) {
            let closestPrimary = null;
            let minGap = Infinity;

            for (const prim of primaries) {
                const gapX = Math.max(0, Math.max(frag.x, prim.x) - Math.min(frag.x + frag.width, prim.x + prim.width));
                const gapY = Math.max(0, Math.max(frag.y, prim.y) - Math.min(frag.y + frag.height, prim.y + prim.height));
                const gap = Math.max(gapX, gapY);

                if (gap <= groupDistance && gap < minGap) {
                    minGap = gap;
                    closestPrimary = prim;
                }
            }

            if (closestPrimary) {
                // 將碎片併入該主體外接框
                const nx1 = Math.min(closestPrimary.x, frag.x);
                const ny1 = Math.min(closestPrimary.y, frag.y);
                const nx2 = Math.max(closestPrimary.x + closestPrimary.width, frag.x + frag.width);
                const ny2 = Math.max(closestPrimary.y + closestPrimary.height, frag.y + frag.height);

                closestPrimary.x = nx1;
                closestPrimary.y = ny1;
                closestPrimary.width = nx2 - nx1;
                closestPrimary.height = ny2 - ny1;
                closestPrimary.pixelCount += (frag.pixelCount || 0);
                closestPrimary.componentCount++;
            } else {
                unabsorbedFragments.push({
                    x: frag.x,
                    y: frag.y,
                    width: frag.width,
                    height: frag.height,
                    pixelCount: frag.pixelCount,
                    componentCount: 1
                });
            }
        }

        return [...primaries, ...unabsorbedFragments];
    }
}
