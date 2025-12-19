const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'place.db');

let db = null;

// Initialize database connection
function initDB() {
    return new Promise((resolve, reject) => {
        // Ensure database directory exists
        const fs = require('fs');
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
            } else {
                console.log('Connected to SQLite database');
                // Run initialization SQL
                const initSQL = fs.readFileSync(path.join(__dirname, '..', 'database', 'init.sql'), 'utf8');
                db.exec(initSQL, (err) => {
                    if (err) {
                        console.error('Error initializing database:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

// Get database instance
function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB() first.');
    }
    return db;
}

// Query helper
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Run helper (for INSERT, UPDATE, DELETE)
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDB().run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

// Get user by Formbar ID
async function getUserByFormbarId(formbarId) {
    const rows = await query('SELECT * FROM users WHERE formbar_id = ?', [formbarId]);
    return rows[0] || null;
}

// Create or update user
async function createOrUpdateUser(formbarId, displayName) {
    const existing = await getUserByFormbarId(formbarId);
    if (existing) {
        await run('UPDATE users SET display_name = ? WHERE formbar_id = ?', [displayName, formbarId]);
        return await getUserByFormbarId(formbarId);
    } else {
        await run('INSERT INTO users (formbar_id, display_name) VALUES (?, ?)', [formbarId, displayName]);
        return await getUserByFormbarId(formbarId);
    }
}

// Get user by ID
async function getUserById(userId) {
    const rows = await query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows[0] || null;
}

// Update user pixel balance
async function updateUserBalance(userId, newBalance) {
    await run('UPDATE users SET pixel_balance = ? WHERE id = ?', [newBalance, userId]);
}

// Get canvas state (current state - latest pixel at each coordinate)
async function getCanvasState() {
    // Get the latest pixel for each coordinate
    const rows = await query(`
        SELECT c.x, c.y, c.color
        FROM canvas c
        INNER JOIN (
            SELECT x, y, MAX(placed_at) as max_time
            FROM canvas
            GROUP BY x, y
        ) latest ON c.x = latest.x AND c.y = latest.y AND c.placed_at = latest.max_time
        ORDER BY c.y, c.x
    `);
    return rows;
}

// Get all pixels for replay (ordered chronologically)
async function getAllPixelsForReplay() {
    const rows = await query('SELECT * FROM canvas ORDER BY placed_at ASC');
    return rows;
}

// Get canvas as 2D array (64 rows x 128 columns) for JSON export
async function getCanvasAs2D() {
    // Initialize 2D array with white background
    const canvas = Array(64).fill(null).map(() => Array(128).fill('#FFFFFF'));
    
    // Get the latest pixel for each coordinate
    const rows = await query(`
        SELECT c.x, c.y, c.color
        FROM canvas c
        INNER JOIN (
            SELECT x, y, MAX(placed_at) as max_time
            FROM canvas
            GROUP BY x, y
        ) latest ON c.x = latest.x AND c.y = latest.y AND c.placed_at = latest.max_time
    `);
    
    // Fill in the pixels
    for (const pixel of rows) {
        if (pixel.x >= 0 && pixel.x < 128 && pixel.y >= 0 && pixel.y < 64) {
            canvas[pixel.y][pixel.x] = pixel.color;
        }
    }
    
    return canvas;
}

// Place a pixel
async function placePixel(x, y, color, userId) {
    await run('INSERT INTO canvas (x, y, color, user_id) VALUES (?, ?, ?, ?)', [x, y, color, userId]);
}

// Create transaction record
async function createTransaction(userId, packSize, pixelsPurchased, digipogsSpent, discountPercent) {
    await run(
        'INSERT INTO transactions (user_id, pack_size, pixels_purchased, digipogs_spent, discount_percent) VALUES (?, ?, ?, ?, ?)',
        [userId, packSize, pixelsPurchased, digipogsSpent, discountPercent]
    );
}

// Close database connection
function closeDB() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed');
            }
        });
    }
}

module.exports = {
    initDB,
    getDB,
    query,
    run,
    getUserByFormbarId,
    createOrUpdateUser,
    getUserById,
    updateUserBalance,
    getCanvasState,
    getAllPixelsForReplay,
    getCanvasAs2D,
    placePixel,
    createTransaction,
    closeDB
};

