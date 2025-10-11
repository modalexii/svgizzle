// Main application entry point

import {
    handleFileUpload,
    updateMaterialThickness,
    updateDPI,
    applyAdjustments,
    downloadSVG,
    showStatus
} from './ui.js';

// Initialize application
function init() {
    // DOM elements
    const svgUpload = document.getElementById('svg-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const svgCanvas = document.getElementById('svg-canvas');
    const materialThicknessInput = document.getElementById('material-thickness');
    const dpiInput = document.getElementById('dpi');
    const applyBtn = document.getElementById('apply-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusMessage = document.getElementById('status-message');

    // Helper to bind showStatus with statusMessage
    const showStatusBound = (message, type) => showStatus(message, type, statusMessage);

    // Set up event listeners
    svgUpload.addEventListener('change', (e) => handleFileUpload(e, fileNameDisplay, svgCanvas, applyBtn, downloadBtn, showStatusBound));
    materialThicknessInput.addEventListener('input', updateMaterialThickness);
    dpiInput.addEventListener('input', updateDPI);
    applyBtn.addEventListener('click', () => applyAdjustments(showStatusBound));
    downloadBtn.addEventListener('click', () => downloadSVG(showStatusBound));

    console.log('SVG Material Thickness Adjuster initialized');
    console.log('SVG.js version:', SVG.version || 'loaded');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
