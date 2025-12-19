// Replay functionality
const canvas = document.getElementById('replayCanvas');
const ctx = canvas.getContext('2d');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const speedSlider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');
const timeSlider = document.getElementById('timeSlider');
const timestampDisplay = document.getElementById('timestampDisplay');
const pixelCount = document.getElementById('pixelCount');
const totalPixels = document.getElementById('totalPixels');

// Scale canvas for display
const SCALE = 5;
canvas.style.width = (canvas.width * SCALE) + 'px';
canvas.style.height = (canvas.height * SCALE) + 'px';
canvas.style.imageRendering = 'pixelated';

// Replay state
let isPlaying = false;
let currentIndex = 0;
let replayInterval = null;
let baseSpeed = 100; // milliseconds per pixel at 1x speed
let currentSpeed = baseSpeed;

// Initialize canvas (white)
function initCanvas() {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 128, 64);
}

// Draw a pixel
function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Update display
function updateDisplay() {
    pixelCount.textContent = currentIndex;
    totalPixels.textContent = pixels.length;
    
    if (pixels.length > 0 && currentIndex > 0) {
        const currentPixel = pixels[currentIndex - 1];
        timestampDisplay.textContent = formatTimestamp(currentPixel.placed_at);
    } else {
        timestampDisplay.textContent = '--';
    }
    
    timeSlider.value = pixels.length > 0 ? (currentIndex / pixels.length * 100) : 0;
}

// Play/pause functionality
function play() {
    if (currentIndex >= pixels.length) {
        currentIndex = 0;
    }
    
    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
    
    replayInterval = setInterval(() => {
        if (currentIndex < pixels.length) {
            const pixel = pixels[currentIndex];
            drawPixel(pixel.x, pixel.y, pixel.color);
            currentIndex++;
            updateDisplay();
        } else {
            pause();
        }
    }, currentSpeed);
}

function pause() {
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    if (replayInterval) {
        clearInterval(replayInterval);
        replayInterval = null;
    }
}

playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
        pause();
    } else {
        play();
    }
});

// Reset functionality
resetBtn.addEventListener('click', () => {
    pause();
    currentIndex = 0;
    initCanvas();
    updateDisplay();
});

// Speed control
speedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    speedDisplay.textContent = speed + 'x';
    currentSpeed = baseSpeed / speed;
    
    // Restart interval with new speed if playing
    if (isPlaying) {
        pause();
        play();
    }
});

// Time scrubber
timeSlider.addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value) / 100;
    const targetIndex = Math.floor(percent * pixels.length);
    
    if (targetIndex !== currentIndex) {
        pause();
        currentIndex = targetIndex;
        
        // Redraw canvas up to current index
        initCanvas();
        for (let i = 0; i < currentIndex; i++) {
            const pixel = pixels[i];
            drawPixel(pixel.x, pixel.y, pixel.color);
        }
        updateDisplay();
    }
});

// Initialize
initCanvas();
updateDisplay();

// Auto-play on load (optional - comment out if you don't want this)
// play();

