// Initialize Socket.io connection
const socket = io();

// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const colorDropperBtn = document.getElementById('colorDropper');
let selectedColor = '#FFFFFF';
let currentCanvas = {};
let dropperMode = false;

function setDropperMode(enabled) {
    dropperMode = enabled;

    if (!colorDropperBtn) {
        return;
    }

    colorDropperBtn.classList.toggle('active', enabled);
    colorDropperBtn.textContent = enabled ? 'Dropper (On)' : 'Dropper';
    canvas.style.cursor = enabled ? 'copy' : 'crosshair';
}

// Scale canvas for display (5x for 500x500 display)
const SCALE = 5;
canvas.style.width = (canvas.width * SCALE) + 'px';
canvas.style.height = (canvas.height * SCALE) + 'px';
canvas.style.imageRendering = 'pixelated';

// Initialize canvas with white background
function initCanvas() {
    // Create a white canvas
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 128; x++) {
            currentCanvas[`${x},${y}`] = '#000000';
        }
    }
    drawCanvas();
}

// Draw the canvas
function drawCanvas() {
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 64);

    // Draw all pixels
    for (const [key, color] of Object.entries(currentCanvas)) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    }
}

// Load initial canvas state
if (typeof canvasState !== 'undefined') {
    canvasState.forEach(pixel => {
        currentCanvas[`${pixel.x},${pixel.y}`] = pixel.color;
    });
    drawCanvas();
} else {
    initCanvas();
}

// Color picker change
colorPicker.addEventListener('change', (e) => {
    selectedColor = e.target.value;
});

// Dropper button toggle
if (colorDropperBtn) {
    colorDropperBtn.addEventListener('click', () => {
        setDropperMode(!dropperMode);
    });
}

// Canvas click handler
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / SCALE);
    const y = Math.floor((e.clientY - rect.top) / SCALE);

    // Validate coordinates
    if (x >= 0 && x < 128 && y >= 0 && y < 64) {
        const key = `${x},${y}`;
        const existingColor = currentCanvas[key] || '#000000';

        if (dropperMode) {
            // Set selected color to the color at the clicked pixel
            selectedColor = existingColor;
            colorPicker.value = existingColor;
            // Turn off dropper after picking
            setDropperMode(false);
        } else {
            socket.emit('placePixel', {
                x: x,
                y: y,
                color: selectedColor
            });
        }
    }
});

// Escape cancels dropper mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropperMode) {
        setDropperMode(false);
    }
});

// Socket.io event handlers
socket.on('canvasState', (state) => {
    state.forEach(pixel => {
        currentCanvas[`${pixel.x},${pixel.y}`] = pixel.color;
    });
    drawCanvas();
});

socket.on('canvasUpdate', (data) => {
    currentCanvas[`${data.x},${data.y}`] = data.color;
    drawCanvas();
});

socket.on('balanceUpdate', (balance) => {
    document.getElementById('pixelBalance').textContent = balance;
    document.getElementById('pixelBalanceText').textContent = balance;
});

socket.on('error', (data) => {
    alert('Error: ' + data.message);
});

// Purchase functionality
let selectedPackSize = null;
const packButtons = document.querySelectorAll('.pack-btn');
const purchaseModal = document.getElementById('purchaseModal');
const purchaseForm = document.getElementById('purchaseForm');
const packInfo = document.getElementById('packInfo');
const purchaseMessage = document.getElementById('purchaseMessage');
const cancelBtn = document.getElementById('cancelPurchase');
const closeBtn = document.querySelector('.close');

packButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedPackSize = parseInt(btn.dataset.pack);
        const packData = {
            10: { price: 10, discount: '0%' },
            25: { price: 22.5, discount: '10%' },
            50: { price: 42.5, discount: '15%' },
            100: { price: 80, discount: '20%' }
        };
        const data = packData[selectedPackSize];
        if (data.discount === '0%') {
            packInfo.textContent = `Purchase ${selectedPackSize} pixels for ${data.price} Digipogs`;
        } else {
            packInfo.textContent = `Purchase ${selectedPackSize} pixels for ${data.price} Digipogs (${data.discount} discount)`;
        }
        purchaseMessage.textContent = '';
        purchaseModal.style.display = 'block';
    });
});

closeBtn.addEventListener('click', () => {
    purchaseModal.style.display = 'none';
    purchaseForm.reset();
});

cancelBtn.addEventListener('click', () => {
    purchaseModal.style.display = 'none';
    purchaseForm.reset();
});

window.addEventListener('click', (e) => {
    if (e.target === purchaseModal) {
        purchaseModal.style.display = 'none';
        purchaseForm.reset();
    }
});

purchaseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('pin').value;
    
    if (!selectedPackSize) {
        purchaseMessage.textContent = 'Please select a pack size';
        purchaseMessage.className = 'message error';
        return;
    }

    // Validate PIN length (4-6 digits)
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        purchaseMessage.textContent = 'Please enter a valid PIN (4-6 digits)';
        purchaseMessage.className = 'message error';
        return;
    }

    purchaseMessage.textContent = 'Processing purchase...';
    purchaseMessage.className = 'message info';

    socket.emit('purchasePixels', {
        packSize: selectedPackSize,
        pin: pin
    });
});

socket.on('purchaseSuccess', (data) => {
    purchaseMessage.textContent = `Success! You now have ${data.newBalance} pixels.`;
    purchaseMessage.className = 'message success';
    purchaseForm.reset();
    setTimeout(() => {
        purchaseModal.style.display = 'none';
    }, 2000);
});

socket.on('purchaseError', (data) => {
    purchaseMessage.textContent = 'Error: ' + data.message;
    purchaseMessage.className = 'message error';
});

// Request balance on load
socket.emit('getBalance');

