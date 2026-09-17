// GridCut - Core Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const sourceImage = document.getElementById('sourceImage');
    const editorWrapper = document.getElementById('editorWrapper');
    const placeholderView = document.getElementById('placeholderView');
    
    // Inputs
    const tileWidthInput = document.getElementById('tileWidth');
    const tileHeightInput = document.getElementById('tileHeight');
    const exportFormatSelect = document.getElementById('exportFormat');
    const filePrefixInput = document.getElementById('filePrefix');
    
    // Buttons
    const downloadBtn = document.getElementById('downloadBtn');
    const resetCropBtn = document.getElementById('resetCropBtn');
    
    // Info panels
    const origSizeSpan = document.getElementById('origSize');
    const cropSizeSpan = document.getElementById('cropSize');
    const colsCountSpan = document.getElementById('colsCount');
    const rowsCountSpan = document.getElementById('rowsCount');
    const totalCountSpan = document.getElementById('totalCount');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    // Crop Box Elements
    const cropBox = document.getElementById('cropBox');
    const gridCanvas = document.getElementById('gridCanvas');
    const gridCtx = gridCanvas.getContext('2d');
    
    // Loader Modal
    const loaderModal = document.getElementById('loaderModal');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');

    // App State
    let originalImg = null;
    let scaleRatio = 1; // Real Width / Rendered Width
    let isDragging = false;
    let dragType = null; // 'move' or handle name ('nw', 'se', etc.)
    let startX = 0, startY = 0;
    let startCropState = { x: 0, y: 0, w: 0, h: 0 };
    
    // Rendered Crop box state (relative to the image's container coordinates)
    let cropBoxState = { x: 0, y: 0, w: 0, h: 0 };

    // --- UPLOAD & FILE INPUT HANDLERS ---
    
    // Click dropzone to open file dialog
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
        }
    });

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('請上傳有效的圖片檔案！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImg = new Image();
            originalImg.onload = () => {
                // Initialize workspace with image
                setupWorkspace();
            };
            originalImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- WORKSPACE & CROPPING SETUP ---

    function setupWorkspace() {
        if (!originalImg) return;

        // Set image source
        sourceImage.src = originalImg.src;
        
        // Hide placeholder and show editor
        placeholderView.style.display = 'none';
        editorWrapper.style.display = 'inline-block';
        
        // Reset inputs and buttons
        downloadBtn.disabled = false;
        resetCropBtn.disabled = false;
        
        statusDot.classList.add('active');
        statusText.textContent = '圖片載入成功，可拖曳邊框調整範圍';

        // Display original size
        origSizeSpan.textContent = `${originalImg.width} × ${originalImg.height}`;

        // Wait for image render dimensions to be calculated by browser
        // Using a short requestAnimationFrame to ensure layout has updated
        requestAnimationFrame(() => {
            resetCropToFull();
        });
    }

    function resetCropToFull() {
        if (!originalImg) return;

        const containerRect = sourceImage.getBoundingClientRect();
        const renderW = sourceImage.clientWidth || containerRect.width;
        const renderH = sourceImage.clientHeight || containerRect.height;
        
        scaleRatio = originalImg.width / renderW;

        // Set crop state to 100% of rendered image size
        cropBoxState = {
            x: 0,
            y: 0,
            w: renderW,
            h: renderH
        };

        updateCropBoxUI();
        recalculateAndDrawGrid();
    }

    resetCropBtn.addEventListener('click', () => {
        resetCropToFull();
    });

    // Resize observer to handle browser resizing dynamically
    const resizeObserver = new ResizeObserver(() => {
        if (originalImg && editorWrapper.style.display !== 'none') {
            // Keep the relative crop box position upon container resize
            const prevScale = scaleRatio;
            const containerRect = sourceImage.getBoundingClientRect();
            const renderW = sourceImage.clientWidth || containerRect.width;
            if (renderW === 0) return;
            
            scaleRatio = originalImg.width / renderW;
            const ratio = prevScale / scaleRatio; // new size / old size

            cropBoxState.x *= ratio;
            cropBoxState.y *= ratio;
            cropBoxState.w *= ratio;
            cropBoxState.h *= ratio;

            updateCropBoxUI();
            recalculateAndDrawGrid();
        }
    });
    resizeObserver.observe(sourceImage);

    // --- CROP BOX INTERACTION (DRAG & RESIZE) ---

    // Listeners for crop box drag/resize
    cropBox.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);

    // Mobile touch support
    cropBox.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', endDrag);

    function startDrag(e) {
        if (e.target.classList.contains('handle')) {
            dragType = e.target.dataset.handle;
        } else if (e.target === cropBox || e.target === gridCanvas) {
            dragType = 'move';
        } else {
            return;
        }

        e.preventDefault();
        isDragging = true;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        
        startCropState = { ...cropBoxState };
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = (clientX - startX);
        const deltaY = (clientY - startY);

        const containerW = sourceImage.clientWidth;
        const containerH = sourceImage.clientHeight;

        // Minimum dimensions of crop box in pixels
        const minBoxSize = 30;

        if (dragType === 'move') {
            // Move crop box
            let newX = startCropState.x + deltaX;
            let newY = startCropState.y + deltaY;

            // Bounds checking
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + startCropState.w > containerW) newX = containerW - startCropState.w;
            if (newY + startCropState.h > containerH) newY = containerH - startCropState.h;

            cropBoxState.x = newX;
            cropBoxState.y = newY;
        } else {
            // Resize crop box using handles
            let newX = startCropState.x;
            let newY = startCropState.y;
            let newW = startCropState.w;
            let newH = startCropState.h;

            // Horizontal resizing
            if (dragType.includes('w')) {
                // Dragging West handle (left side)
                const proposedX = startCropState.x + deltaX;
                const proposedW = startCropState.w - deltaX;
                
                if (proposedX >= 0 && proposedW >= minBoxSize) {
                    newX = proposedX;
                    newW = proposedW;
                } else if (proposedX < 0) {
                    newX = 0;
                    newW = startCropState.x + startCropState.w;
                }
            } else if (dragType.includes('e')) {
                // Dragging East handle (right side)
                const proposedW = startCropState.w + deltaX;
                if (proposedW >= minBoxSize && startCropState.x + proposedW <= containerW) {
                    newW = proposedW;
                } else if (startCropState.x + proposedW > containerW) {
                    newW = containerW - startCropState.x;
                }
            }

            // Vertical resizing
            if (dragType.includes('n')) {
                // Dragging North handle (top side)
                const proposedY = startCropState.y + deltaY;
                const proposedH = startCropState.h - deltaY;

                if (proposedY >= 0 && proposedH >= minBoxSize) {
                    newY = proposedY;
                    newH = proposedH;
                } else if (proposedY < 0) {
                    newY = 0;
                    newH = startCropState.y + startCropState.h;
                }
            } else if (dragType.includes('s')) {
                // Dragging South handle (bottom side)
                const proposedH = startCropState.h + deltaY;
                if (proposedH >= minBoxSize && startCropState.y + proposedH <= containerH) {
                    newH = proposedH;
                } else if (startCropState.y + proposedH > containerH) {
                    newH = containerH - startCropState.y;
                }
            }

            cropBoxState = { x: newX, y: newY, w: newW, h: newH };
        }

        updateCropBoxUI();
        recalculateAndDrawGrid();
    }

    function endDrag() {
        isDragging = false;
        dragType = null;
    }

    function updateCropBoxUI() {
        cropBox.style.left = `${cropBoxState.x}px`;
        cropBox.style.top = `${cropBoxState.y}px`;
        cropBox.style.width = `${cropBoxState.w}px`;
        cropBox.style.height = `${cropBoxState.h}px`;

        // Update grid canvas size in properties (must match CSS layout sizes for 1:1 pixel rendering)
        gridCanvas.width = cropBoxState.w;
        gridCanvas.height = cropBoxState.h;
    }

    // --- GRID CALCULATION & CANVAS RENDERING ---

    function recalculateAndDrawGrid() {
        if (!originalImg) return;

        // User target slicing sizes
        const targetTileW = Math.max(8, parseInt(tileWidthInput.value) || 128);
        const targetTileH = Math.max(8, parseInt(tileHeightInput.value) || 128);

        // Convert current crop box into original pixel size
        const origCropX = Math.round(cropBoxState.x * scaleRatio);
        const origCropY = Math.round(cropBoxState.y * scaleRatio);
        const origCropW = Math.round(cropBoxState.w * scaleRatio);
        const origCropH = Math.round(cropBoxState.h * scaleRatio);

        // Output crop details to panel
        cropSizeSpan.textContent = `${origCropW} × ${origCropH} px`;

        // Count how many complete items fit inside the cropped region
        const cols = Math.floor(origCropW / targetTileW);
        const rows = Math.floor(origCropH / targetTileH);
        const total = cols * rows;

        // Render stats UI
        colsCountSpan.textContent = cols > 0 ? cols : 0;
        rowsCountSpan.textContent = rows > 0 ? rows : 0;
        totalCountSpan.textContent = total > 0 ? total : 0;

        // Clear grid canvas
        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        if (cols <= 0 || rows <= 0) return;

        // Drawing parameters in CSS (rendered) space
        const stepX = (targetTileW / scaleRatio);
        const stepY = (targetTileH / scaleRatio);

        // Canvas styles
        gridCtx.lineWidth = 1;

        // High contrast grid drawing technique (White-Black alternating dash lines)
        // First draw semi-transparent dark lines as background
        gridCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        gridCtx.setLineDash([4, 4]);
        drawGridLines(cols, rows, stepX, stepY);

        // Then draw offset light lines to guarantee visibility on any background texture
        gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        gridCtx.lineDashOffset = 4;
        drawGridLines(cols, rows, stepX, stepY);
    }

    function drawGridLines(cols, rows, stepX, stepY) {
        // Vertical lines
        for (let i = 1; i <= cols; i++) {
            const x = i * stepX;
            gridCtx.beginPath();
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, gridCanvas.height);
            gridCtx.stroke();
        }

        // Horizontal lines
        for (let j = 1; j <= rows; j++) {
            const y = j * stepY;
            gridCtx.beginPath();
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(gridCanvas.width, y);
            gridCtx.stroke();
        }
    }

    // Input listeners to trigger grid redraw instantly
    tileWidthInput.addEventListener('input', recalculateAndDrawGrid);
    tileHeightInput.addEventListener('input', recalculateAndDrawGrid);

    // Ensure inputs don't stay empty
    tileWidthInput.addEventListener('blur', () => {
        if (!tileWidthInput.value || parseInt(tileWidthInput.value) <= 0) {
            tileWidthInput.value = 128;
        }
        recalculateAndDrawGrid();
    });
    tileHeightInput.addEventListener('blur', () => {
        if (!tileHeightInput.value || parseInt(tileHeightInput.value) <= 0) {
            tileHeightInput.value = 128;
        }
        recalculateAndDrawGrid();
    });


    // --- SLICING & PACKING (ZIP GENERATION) ---

    downloadBtn.addEventListener('click', async () => {
        if (!originalImg) return;

        // Fetch inputs
        const targetTileW = Math.max(8, parseInt(tileWidthInput.value) || 128);
        const targetTileH = Math.max(8, parseInt(tileHeightInput.value) || 128);
        const format = exportFormatSelect.value;
        const prefix = filePrefixInput.value.trim() || 'tile_';

        // Calculate original coordinates
        const origCropX = Math.round(cropBoxState.x * scaleRatio);
        const origCropY = Math.round(cropBoxState.y * scaleRatio);
        const origCropW = Math.round(cropBoxState.w * scaleRatio);
        const origCropH = Math.round(cropBoxState.h * scaleRatio);

        const cols = Math.floor(origCropW / targetTileW);
        const rows = Math.floor(origCropH / targetTileH);
        const total = cols * rows;

        if (total <= 0) {
            alert('設定尺寸過大，在此裁切區域內無法切出任何圖片！');
            return;
        }

        // Extension mapping
        let ext = 'png';
        if (format === 'image/jpeg') ext = 'jpg';
        if (format === 'image/webp') ext = 'webp';

        // Show Loader
        loaderModal.classList.add('active');
        progressText.textContent = `準備切圖，共 ${total} 張...`;
        progressBar.style.width = '0%';

        // Initialize JSZip
        const zip = new JSZip();
        
        // Creating an offline canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = targetTileW;
        sliceCanvas.height = targetTileH;
        const sliceCtx = sliceCanvas.getContext('2d');

        // Helper to delay execution and yield control back to UI main-thread (prevent browser freeze)
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            let processed = 0;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Coordinates on source image
                    const sx = origCropX + (c * targetTileW);
                    const sy = origCropY + (r * targetTileH);

                    // Clear and draw on slice canvas
                    sliceCtx.clearRect(0, 0, targetTileW, targetTileH);
                    sliceCtx.drawImage(
                        originalImg,
                        sx, sy, targetTileW, targetTileH, // Source clip
                        0, 0, targetTileW, targetTileH    // Destination layout
                    );

                    // Convert to blob and add to ZIP
                    const blob = await canvasToBlob(sliceCanvas, format, 0.92);
                    
                    // Naming standard: prefix_row_col.ext
                    const paddedRow = String(r).padStart(2, '0');
                    const paddedCol = String(c).padStart(2, '0');
                    const filename = `${prefix}${paddedRow}_${paddedCol}.${ext}`;
                    
                    zip.file(filename, blob);

                    processed++;
                    
                    // Update Progress bar
                    const percent = Math.round((processed / total) * 100);
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `已切圖 ${processed} / ${total} 張 (${percent}%)`;

                    // Yield UI thread periodically
                    if (processed % 10 === 0) {
                        await delay(5);
                    }
                }
            }

            // ZIP generation
            progressText.textContent = '正在打包成 ZIP 壓縮檔...';
            const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                progressBar.style.width = `${Math.round(metadata.percent)}%`;
                progressText.textContent = `壓縮打包中: ${Math.round(metadata.percent)}%`;
            });

            // Trigger file download
            progressText.textContent = '完成！開始下載檔案。';
            await delay(300);

            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = `${prefix}tiles.zip`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadLink.href);

        } catch (error) {
            console.error(error);
            alert('切圖打包過程中發生錯誤：' + error.message);
        } finally {
            loaderModal.classList.remove('active');
        }
    });

    // Helper: Canvas to Blob async wrapped
    function canvasToBlob(canvas, format, quality) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, format, quality);
        });
    }

    // Auto-load test image if query parameter 'test' is present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('test')) {
        statusText.textContent = '正在自動載入測試圖片...';
        fetch('test_sprite_sheet.png')
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'test_sprite_sheet.png', { type: 'image/png' });
                handleImageFile(file);
            })
            .catch(err => {
                console.error('無法載入測試圖片', err);
                statusText.textContent = '自動載入測試圖片失敗';
            });
    }
});
