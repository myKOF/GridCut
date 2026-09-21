/**
 * DebugVisualizer
 * 負責渲染自動檢測演算法各階段的除錯視覺化圖層 (Phase 7: Debug Visualization)
 * 
 * 支援 8 種檢視模式：
 * 1. 'original': 原始圖集 (無疊加)
 * 2. 'mask': 前景二值佔用遮罩 (Foreground / Occupancy Mask)
 * 3. 'ccl': 連通成分彩色標籤圖 (Connected Components)
 * 4. 'h_proj': 全圖水平投影分佈 (Horizontal Projection Profile)
 * 5. 'v_proj': 全圖垂直投影分佈 (Vertical Projection Profile)
 * 6. 'gutters': 偵測出的分割通道 (Detected Gutters)
 * 7. 'candidates': 空間遞迴分割候選矩形 (Rectangle Candidates)
 * 8. 'final': 最終邊界框與檢測依據 (Final Bounding Boxes & Reasons)
 */
export class DebugVisualizer {
    /**
     * 繪製除錯圖層到指定 Canvas
     * @param {string} mode 檢視模式
     * @param {Object} debugData 分析器產生的除錯數據
     * @param {HTMLCanvasElement} canvas 目標 Canvas
     * @param {number} width 畫布寬度
     * @param {number} height 畫布高度
     * @param {Array} [sprites] 最終邊界框
     */
    static render(mode, debugData, canvas, width, height, sprites = []) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);

        if (!debugData || mode === 'original' || mode === 'none') {
            return;
        }

        switch (mode) {
            case 'mask':
                this._renderMask(ctx, debugData.mask, width, height);
                break;
            case 'ccl':
                this._renderCCL(ctx, debugData.components, debugData.mask, width, height);
                break;
            case 'h_proj':
                this._renderHProfile(ctx, debugData.globalHProfile, width, height);
                break;
            case 'v_proj':
                this._renderVProfile(ctx, debugData.globalVProfile, width, height);
                break;
            case 'gutters':
                this._renderGutters(ctx, debugData.gutters, width, height);
                break;
            case 'candidates':
                this._renderCandidates(ctx, debugData.candidates, width, height);
                break;
            case 'final':
                this._renderFinalBoxes(ctx, sprites, width, height);
                break;
            default:
                break;
        }
    }

    /**
     * 1. 繪製二值前景遮罩 (半透明暗黑背景 + 明亮前景)
     */
    static _renderMask(ctx, mask, width, height) {
        if (!mask) return;
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            if (mask[i] === 1) {
                // 前景以亮青綠色呈現
                data[idx] = 16;      // R
                data[idx + 1] = 185; // G
                data[idx + 2] = 129; // B
                data[idx + 3] = 220; // A
            } else {
                // 背景以半透明黑紫底呈現
                data[idx] = 15;
                data[idx + 1] = 23;
                data[idx + 2] = 42;
                data[idx + 3] = 200;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // 浮水印文字
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Debug Mode: Foreground / Occupancy Mask', 12, 24);
    }

    /**
     * 2. 繪製連通成分 (CCL) 彩色標籤
     */
    static _renderCCL(ctx, components, mask, width, height) {
        if (!components) return;

        // 半透明黑色底
        ctx.fillStyle = 'rgba(10, 15, 29, 0.75)';
        ctx.fillRect(0, 0, width, height);

        // 為每個 component 繪製不同顏色的半透明框與標籤
        components.forEach((comp, idx) => {
            const hue = (idx * 137.508) % 360; // 黃金角均勻色輪
            ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
            ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.25)`;
            ctx.lineWidth = 1;

            ctx.fillRect(comp.x, comp.y, comp.width, comp.height);
            ctx.strokeRect(comp.x, comp.y, comp.width, comp.height);

            if (comp.width > 20 && comp.height > 12) {
                ctx.fillStyle = `hsl(${hue}, 90%, 80%)`;
                ctx.font = '9px monospace';
                ctx.fillText(`c_${comp.id || idx}`, comp.x + 2, comp.y + 10);
            }
        });

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Debug Mode: Connected Components (${components.length} components found)`, 12, 24);
    }

    /**
     * 3. 繪製全圖水平投影波形 (Horizontal Projection Profile)
     */
    static _renderHProfile(ctx, profile, width, height) {
        if (!profile) return;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(0, 0, width, height);

        let maxVal = 1;
        for (let i = 0; i < profile.length; i++) {
            if (profile[i] > maxVal) maxVal = profile[i];
        }

        const maxBarWidth = Math.min(width * 0.45, 300);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let y = 0; y < height; y++) {
            const val = profile[y] || 0;
            const barW = (val / maxVal) * maxBarWidth;
            ctx.fillRect(0, y, barW, 1);
        }

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Debug Mode: Horizontal Projection Profile (Y-axis)', 12, 24);
    }

    /**
     * 4. 繪製全圖垂直投影波形 (Vertical Projection Profile)
     */
    static _renderVProfile(ctx, profile, width, height) {
        if (!profile) return;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(0, 0, width, height);

        let maxVal = 1;
        for (let i = 0; i < profile.length; i++) {
            if (profile[i] > maxVal) maxVal = profile[i];
        }

        const maxBarHeight = Math.min(height * 0.45, 300);

        ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1;

        for (let x = 0; x < width; x++) {
            const val = profile[x] || 0;
            const barH = (val / maxVal) * maxBarHeight;
            ctx.fillRect(x, height - barH, 1, barH);
        }

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Debug Mode: Vertical Projection Profile (X-axis)', 12, 24);
    }

    /**
     * 5. 繪製偵測出的 Gutters 分割線
     */
    static _renderGutters(ctx, gutters, width, height) {
        if (!gutters || gutters.length === 0) {
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('Debug Mode: Detected Gutters (None detected)', 12, 24);
            return;
        }

        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(0, 0, width, height);

        gutters.forEach(g => {
            const conf = g.confidence || 0.8;
            ctx.lineWidth = Math.max(1, Math.round(conf * 2));
            if (g.orientation === 'H') {
                ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0.4, conf)})`; // 紅色水平線
                ctx.beginPath();
                ctx.moveTo(g.x, g.y);
                ctx.lineTo(g.x + g.length, g.y);
                ctx.stroke();
            } else {
                ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0.4, conf)})`; // 綠色垂直線
                ctx.beginPath();
                ctx.moveTo(g.x, g.y);
                ctx.lineTo(g.x, g.y + g.length);
                ctx.stroke();
            }
        });

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Debug Mode: Detected Gutters (${gutters.length} separators, Red: H, Green: V)`, 12, 24);
    }

    /**
     * 6. 繪製 Recursive XY-Cut 候選矩形 (Candidate Rectangles)
     */
    static _renderCandidates(ctx, candidates, width, height) {
        if (!candidates) return;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.fillRect(0, 0, width, height);

        candidates.forEach((cand, idx) => {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(cand.x, cand.y, cand.width, cand.height);
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.fillRect(cand.x, cand.y, cand.width, cand.height);

            if (cand.width > 24 && cand.height > 16) {
                ctx.fillStyle = '#bae6fd';
                ctx.font = '10px monospace';
                ctx.fillText(`#${idx + 1}`, cand.x + 3, cand.y + 11);
            }
        });

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Debug Mode: Recursive XY-Cut Candidates (${candidates.length} candidate boxes)`, 12, 24);
    }

    /**
     * 7. 繪製最終邊界框與檢測依據 (Final Bounding Boxes)
     */
    static _renderFinalBoxes(ctx, sprites, width, height) {
        if (!sprites) return;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.fillRect(0, 0, width, height);

        sprites.forEach((s) => {
            const conf = s.confidence || 0.9;
            const isHigh = conf >= 0.8;
            ctx.strokeStyle = isHigh ? '#10b981' : (conf >= 0.5 ? '#f59e0b' : '#ef4444');
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            if (s.width > 30 && s.height > 20) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(s.x + 2, s.y + 2, Math.min(s.width - 4, 120), 24);

                ctx.fillStyle = isHigh ? '#34d399' : '#fbbf24';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(`${s.id} (${s.width}×${s.height})`, s.x + 4, s.y + 12);

                ctx.fillStyle = '#94a3b8';
                ctx.font = '8px monospace';
                const shortReason = (s.reason || 'gutter enclosed').split(':')[0];
                ctx.fillText(`${Math.round(conf * 100)}% | ${shortReason}`, s.x + 4, s.y + 22);
            }
        });

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Debug Mode: Final Sprites (${sprites.length} sprites with detection reasons)`, 12, 24);
    }
}
