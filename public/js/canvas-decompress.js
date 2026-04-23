(function attachCanvasCompression(globalScope) {
    'use strict';

    function assertInteger(value, fieldName) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`${fieldName} must be a non-negative integer`);
        }
    }

    function decompressCanvasToFlat(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('payload must be an object');
        }

        const { width, height, palette, runs } = payload;
        assertInteger(width, 'width');
        assertInteger(height, 'height');

        if (!Array.isArray(palette)) {
            throw new Error('palette must be an array');
        }

        if (!Array.isArray(runs)) {
            throw new Error('runs must be an array');
        }

        const expectedPixelCount = width * height;
        const flatPixels = [];

        for (const run of runs) {
            if (!Array.isArray(run) || run.length !== 2) {
                throw new Error('Each run must be [count, alias]');
            }

            const [count, alias] = run;
            assertInteger(count, 'run count');
            assertInteger(alias, 'run alias');

            const color = palette[alias];
            if (typeof color !== 'string') {
                throw new Error(`Invalid palette alias: ${alias}`);
            }

            for (let i = 0; i < count; i += 1) {
                flatPixels.push(color);
            }
        }

        if (flatPixels.length !== expectedPixelCount) {
            throw new Error(
                `Decoded pixel count mismatch. Expected ${expectedPixelCount}, got ${flatPixels.length}`
            );
        }

        return flatPixels;
    }

    function decompressCanvas2D(payload) {
        const { width, height } = payload;
        const flatPixels = decompressCanvasToFlat(payload);
        const rows = [];

        for (let y = 0; y < height; y += 1) {
            const start = y * width;
            rows.push(flatPixels.slice(start, start + width));
        }

        return rows;
    }

    const api = {
        decompressCanvasToFlat,
        decompressCanvas2D
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        globalScope.CanvasCompression = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
