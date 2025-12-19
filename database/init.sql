-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formbar_id INTEGER UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    pixel_balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Canvas table (stores all pixel placements)
CREATE TABLE IF NOT EXISTS canvas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL CHECK(x >= 0 AND x < 128),
    y INTEGER NOT NULL CHECK(y >= 0 AND y < 64),
    color TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Transactions table (pixel pack purchases)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pack_size INTEGER NOT NULL,
    pixels_purchased INTEGER NOT NULL,
    digipogs_spent REAL NOT NULL,
    discount_percent REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_canvas_coords ON canvas(x, y);
CREATE INDEX IF NOT EXISTS idx_canvas_placed_at ON canvas(placed_at);
CREATE INDEX IF NOT EXISTS idx_users_formbar_id ON users(formbar_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

