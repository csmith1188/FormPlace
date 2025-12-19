/**
 * Validate coordinates are within canvas bounds
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if valid
 */
function validateCoordinates(x, y) {
    return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        x >= 0 && x < 128 &&
        y >= 0 && y < 64 &&
        Number.isInteger(x) &&
        Number.isInteger(y)
    );
}

/**
 * Validate color is a valid hex color
 * @param {string} color - Color string
 * @returns {boolean} True if valid
 */
function validateColor(color) {
    if (typeof color !== 'string') {
        return false;
    }
    // Check if it's a valid hex color (#RRGGBB or #RGB)
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(color);
}

/**
 * Convert canvas state array to 2D array for easier manipulation
 * @param {Array} canvasState - Array of {x, y, color} objects
 * @returns {Array} 2D array [y][x] = color
 */
function canvasStateTo2D(canvasState) {
    const canvas = Array(64).fill(null).map(() => Array(128).fill('#FFFFFF'));
    
    for (const pixel of canvasState) {
        if (pixel.x >= 0 && pixel.x < 128 && pixel.y >= 0 && pixel.y < 64) {
            canvas[pixel.y][pixel.x] = pixel.color;
        }
    }
    
    return canvas;
}

/**
 * Convert 2D canvas array to flat array
 * @param {Array} canvas2D - 2D array [y][x] = color
 * @returns {Array} Flat array of {x, y, color} objects
 */
function canvas2DToFlat(canvas2D) {
    const flat = [];
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 128; x++) {
            flat.push({ x, y, color: canvas2D[y][x] });
        }
    }
    return flat;
}

module.exports = {
    validateCoordinates,
    validateColor,
    canvasStateTo2D,
    canvas2DToFlat
};

