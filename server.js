require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { PNG } = require('pngjs');

const { initDB, getCanvasState, placePixel, getUserById, updateUserBalance, createTransaction, getAllPixelsForReplay, getCanvasAs2D, getPixelColorAt } = require('./utils/db');
const { router: authRouter, isAuthenticated } = require('./routes/auth');
const { calculatePrice, purchasePixels } = require('./utils/digipogs');
const { validateCoordinates, validateColor } = require('./utils/canvas');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const AUTH_URL = process.env.AUTH_URL || 'https://formbar.yorktechapps.com';
const THIS_URL = process.env.THIS_URL || `http://localhost:${PORT}`;
const API_KEY = process.env.API_KEY || '';
const APP_ACCOUNT_ID = parseInt(process.env.APP_ACCOUNT_ID || '0'); // Formbar account ID to receive digipogs

function compressCanvas2D(canvas2D) {
    const flatPixels = canvas2D.flat();
    const palette = [];
    const paletteLookup = new Map();
    const indexedPixels = [];

    for (const color of flatPixels) {
        if (!paletteLookup.has(color)) {
            paletteLookup.set(color, palette.length);
            palette.push(color);
        }
        indexedPixels.push(paletteLookup.get(color));
    }

    const runs = [];
    let currentAlias = indexedPixels[0];
    let runLength = 1;

    for (let i = 1; i < indexedPixels.length; i += 1) {
        const alias = indexedPixels[i];
        if (alias === currentAlias) {
            runLength += 1;
        } else {
            runs.push([runLength, currentAlias]);
            currentAlias = alias;
            runLength = 1;
        }
    }

    if (indexedPixels.length > 0) {
        runs.push([runLength, currentAlias]);
    }

    return {
        encoding: 'palette-rle-v1',
        palette,
        runs,
        pixelCount: indexedPixels.length
    };
}

function normalizeHexColor(hex) {
    if (typeof hex !== 'string') {
        return '#000000';
    }

    const normalized = hex.trim();
    if (/^#[A-Fa-f0-9]{6}$/.test(normalized)) {
        return normalized;
    }

    if (/^#[A-Fa-f0-9]{3}$/.test(normalized)) {
        const r = normalized[1];
        const g = normalized[2];
        const b = normalized[3];
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    return '#000000';
}

function canvas2DToPngBuffer(canvas2D, scale = 1) {
    const sourceWidth = 128;
    const sourceHeight = 64;
    const outputWidth = sourceWidth * scale;
    const outputHeight = sourceHeight * scale;
    const png = new PNG({ width: outputWidth, height: outputHeight });

    for (let y = 0; y < sourceHeight; y += 1) {
        for (let x = 0; x < sourceWidth; x += 1) {
            const color = normalizeHexColor(canvas2D[y][x]);
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);

            for (let dy = 0; dy < scale; dy += 1) {
                for (let dx = 0; dx < scale; dx += 1) {
                    const outX = x * scale + dx;
                    const outY = y * scale + dy;
                    const idx = (outputWidth * outY + outX) << 2;
                    png.data[idx] = r;
                    png.data[idx + 1] = g;
                    png.data[idx + 2] = b;
                    png.data[idx + 3] = 255;
                }
            }
        }
    }

    return PNG.sync.write(png);
}

// Create Socket.io client connection to Formbar for Digipogs transfers
let formbarSocket = null;
if (API_KEY && AUTH_URL) {
    formbarSocket = ioClient(AUTH_URL, {
        extraHeaders: {
            api: API_KEY
        }
    });

    formbarSocket.on('connect', () => {
        console.log('Connected to Formbar for Digipogs transfers');
    });

    formbarSocket.on('disconnect', () => {
        console.log('Disconnected from Formbar');
    });

    formbarSocket.on('connect_error', (error) => {
        console.error('Formbar connection error:', error);
    });
}

// Session middleware
const sessionMiddleware = session({
    store: new SQLiteStore({ db: 'sessions.db' }),
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
});

app.use(sessionMiddleware);

// Share Express session with Socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Session middleware is now handled above with sharedSession

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', authRouter);

// Show login page if accessing /login directly (will redirect to Formbar)
app.get('/login', (req, res) => {
    if (!req.query.token) {
        res.render('login');
    }
});

// Home page (requires authentication)
app.get('/', isAuthenticated, async (req, res) => {
    try {
        const canvasState = await getCanvasState();
        const user = await getUserById(req.session.userId);
        
        res.render('index', {
            user: {
                displayName: req.session.user,
                pixelBalance: user ? user.pixel_balance : 0,
                userId: req.session.userId
            },
            canvasState: canvasState
        });
    } catch (error) {
        console.error('Error loading home page:', error);
        res.status(500).send('Internal server error');
    }
});

// Replay page (no authentication required)
app.get('/replay', async (req, res) => {
    try {
        const pixels = await getAllPixelsForReplay();
        res.render('replay', { pixels: pixels });
    } catch (error) {
        console.error('Error loading replay page:', error);
        res.status(500).send('Internal server error');
    }
});

// Canvas image data as JSON (no authentication required)
app.get('/api/canvas/full', async (req, res) => {
    try {
        const canvas = await getCanvasAs2D();
        res.json({
            width: 128,
            height: 64,
            data: canvas
        });
    } catch (error) {
        console.error('Error getting canvas data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Canvas image data as compressed JSON (no authentication required)
app.get('/api/canvas/compressed', async (req, res) => {
    try {
        const canvas = await getCanvasAs2D();
        const compressed = compressCanvas2D(canvas);
        res.json({
            width: 128,
            height: 64,
            ...compressed
        });
    } catch (error) {
        console.error('Error getting compressed canvas data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Raw JavaScript decompressor helper (no authentication required)
app.get('/api/canvas/decompress', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'canvas-decompress.js'));
});

// Canvas image as PNG (no authentication required)
app.get('/api/canvas/png', async (req, res) => {
    try {
        const rawScale = req.query.scale;
        const scale = rawScale === undefined ? 1 : Number.parseInt(rawScale, 10);
        if (!Number.isInteger(scale) || scale < 1 || scale > 32) {
            return res.status(400).json({
                error: 'Invalid scale. Use an integer between 1 and 32.'
            });
        }

        const canvas = await getCanvasAs2D();
        const pngBuffer = canvas2DToPngBuffer(canvas, scale);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.send(pngBuffer);
    } catch (error) {
        console.error('Error getting canvas PNG:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Socket.io authentication middleware (after session middleware)
io.use((socket, next) => {
    const session = socket.request.session;
    
    if (session && session.user) {
        socket.userId = session.userId;
        socket.displayName = session.user;
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.displayName}`);
    
    try {
        // Send current canvas state and user balance
        const canvasState = await getCanvasState();
        const user = await getUserById(socket.userId);
        
        socket.emit('canvasState', canvasState);
        socket.emit('balanceUpdate', user ? user.pixel_balance : 0);
    } catch (error) {
        console.error('Error sending initial state:', error);
    }

    // Handle pixel placement
    socket.on('placePixel', async (data) => {
        try {
            const { x, y, color } = data;
            
            // Validate input
            if (!validateCoordinates(x, y)) {
                socket.emit('error', { message: 'Invalid coordinates' });
                return;
            }
            
            if (!validateColor(color)) {
                socket.emit('error', { message: 'Invalid color' });
                return;
            }

            // Get user and check balance
            const user = await getUserById(socket.userId);
            if (!user) {
                socket.emit('error', { message: 'User not found' });
                return;
            }

            // Check current color at this coordinate
            const existingColor = await getPixelColorAt(x, y);
            const isSameColor = existingColor && existingColor.toLowerCase() === color.toLowerCase();

            if (!isSameColor) {
                if (user.pixel_balance <= 0) {
                    socket.emit('error', { message: 'Insufficient pixel balance' });
                    return;
                }
            }

            // Place pixel
            await placePixel(x, y, color, socket.userId);
            
            // Decrement balance only if color actually changed
            let newBalance = user.pixel_balance;
            if (!isSameColor) {
                newBalance = user.pixel_balance - 1;
                await updateUserBalance(socket.userId, newBalance);
                socket.emit('balanceUpdate', newBalance);
            }

            // Broadcast to all clients
            io.emit('canvasUpdate', { x, y, color });
        } catch (error) {
            console.error('Error placing pixel:', error);
            socket.emit('error', { message: 'Failed to place pixel' });
        }
    });

    // Handle pixel pack purchase
    socket.on('purchasePixels', async (data) => {
        try {
            const { packSize, pin } = data;
            
            // Validate pack size
            const priceInfo = calculatePrice(packSize);
            if (!priceInfo) {
                socket.emit('purchaseError', { message: 'Invalid pack size' });
                return;
            }

            // Get user
            const user = await getUserById(socket.userId);
            if (!user) {
                socket.emit('purchaseError', { message: 'User not found' });
                return;
            }

            // Check if Formbar connection is available
            if (!formbarSocket || !formbarSocket.connected) {
                socket.emit('purchaseError', { message: 'Formbar service unavailable. Please try again later.' });
                return;
            }

            // Check if app account ID is configured
            if (!APP_ACCOUNT_ID || APP_ACCOUNT_ID === 0) {
                socket.emit('purchaseError', { message: 'Application not configured. Please contact administrator.' });
                return;
            }

            // Make Digipogs transfer via WebSocket
            const result = await purchasePixels(
                formbarSocket,
                user.formbar_id,
                APP_ACCOUNT_ID,
                packSize,
                pin,
                priceInfo.totalPrice
            );

            // Update user balance
            const newBalance = user.pixel_balance + packSize;
            await updateUserBalance(socket.userId, newBalance);

            // Record transaction
            await createTransaction(
                socket.userId,
                packSize,
                packSize,
                priceInfo.totalPrice,
                priceInfo.discount
            );

            // Send success response
            socket.emit('purchaseSuccess', {
                packSize: packSize,
                newBalance: newBalance
            });
            socket.emit('balanceUpdate', newBalance);
        } catch (error) {
            console.error('Error purchasing pixels:', error);
            socket.emit('purchaseError', { message: error.message || 'Purchase failed' });
        }
    });

    // Handle balance request
    socket.on('getBalance', async () => {
        try {
            const user = await getUserById(socket.userId);
            socket.emit('balanceUpdate', user ? user.pixel_balance : 0);
        } catch (error) {
            console.error('Error getting balance:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.displayName}`);
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await initDB();
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Visit ${THIS_URL} to use the application`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

