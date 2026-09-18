/**
 * MorphologicalProcessor
 * 負責二值化遮罩之數學形態學運算 (Dilation 膨脹、Erosion 腐蝕、Closing 閉合)
 * 用於封閉 Sprite 內部發光、粒子、斷線與微小空隙，避免同一物件被過度碎切。
 */
export class MorphologicalProcessor {
    /**
     * 膨脹運算 (Dilation)
     * @param {Uint8Array} mask 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 膨脹半徑 (px)
     * @returns {Uint8Array}
     */
    static dilate(mask, width, height, radius = 1) {
        if (radius <= 0) return new Uint8Array(mask);

        const r = Math.round(radius);
        const output = new Uint8Array(mask.length);
        const rSq = r * r;

        // 預先計算圓形結構元素的相對位移
        const offsets = [];
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy <= rSq) {
                    offsets.push({ dx, dy });
                }
            }
        }

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                if (mask[rowOffset + x] === 1) {
                    for (let i = 0; i < offsets.length; i++) {
                        const nx = x + offsets[i].dx;
                        const ny = y + offsets[i].dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            output[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }

        return output;
    }

    /**
     * 腐蝕運算 (Erosion)
     * @param {Uint8Array} mask 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 腐蝕半徑 (px)
     * @returns {Uint8Array}
     */
    static erode(mask, width, height, radius = 1) {
        if (radius <= 0) return new Uint8Array(mask);

        const r = Math.round(radius);
        const output = new Uint8Array(mask.length);
        const rSq = r * r;

        const offsets = [];
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy <= rSq) {
                    offsets.push({ dx, dy });
                }
            }
        }

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x++) {
                if (mask[rowOffset + x] === 0) continue;

                let fullyCovered = true;
                for (let i = 0; i < offsets.length; i++) {
                    const nx = x + offsets[i].dx;
                    const ny = y + offsets[i].dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height || mask[ny * width + nx] === 0) {
                        fullyCovered = false;
                        break;
                    }
                }

                if (fullyCovered) {
                    output[rowOffset + x] = 1;
                }
            }
        }

        return output;
    }

    /**
     * 閉合運算 (Closing = Dilation + Erosion)
     * 能在不顯著擴大 Sprite 邊界的同時，閉合內部空洞與細微分離的碎屑
     * @param {Uint8Array} mask 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 閉合半徑 (px)
     * @returns {Uint8Array}
     */
    static close(mask, width, height, radius = 2) {
        if (radius <= 0) return mask;
        const dilated = this.dilate(mask, width, height, radius);
        return this.erode(dilated, width, height, radius);
    }
}
