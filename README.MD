# FormPlace

FormPlace is a collaborative pixel canvas app inspired by r/place, using Formbar OAuth for authentication and Digipogs for in-app pixel purchases.

## Features

- Real-time collaborative canvas updates with Socket.io
- Formbar OAuth login/session support
- Pixel economy with balance tracking and Digipogs purchase flow
- Canvas replay page
- JSON canvas export endpoints:
  - raw 2D canvas (`/api/canvas/full`)
  - compressed payload (`/api/canvas/compressed`)
  - decompression helper script (`/api/canvas/decompress`)
  - PNG image export (`/api/canvas/png`)

## Tech Stack

- Node.js + Express
- Socket.io
- SQLite (`sqlite3`)
- EJS templates
- `express-session` + `connect-sqlite3`

## Requirements

- Node.js 18+ recommended
- npm

## Installation

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   PORT=3000
   THIS_URL=http://localhost:3000
   AUTH_URL=https://formbar.yorktechapps.com
   SESSION_SECRET=replace-with-a-strong-secret
   API_KEY=
   APP_ACCOUNT_ID=0
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`.

## Environment Variables

- `PORT`: HTTP server port (default `3000`)
- `THIS_URL`: Public base URL of this app (used for OAuth callback URLs)
- `AUTH_URL`: Formbar base URL
- `SESSION_SECRET`: Session signing secret
- `API_KEY`: API key used to connect to Formbar Socket endpoint
- `APP_ACCOUNT_ID`: Formbar account ID that receives Digipogs payments

## App Routes

- `GET /`: Main canvas page (authenticated)
- `GET /login`: OAuth login redirect/callback
- `GET /logout`: Ends session
- `GET /replay`: Pixel replay page (public)

## Canvas API Documentation

All canvas API routes are currently public (no auth required).

### `GET /api/canvas/full`

Returns the full canvas as a 2D color array.

#### Response

```json
{
  "width": 128,
  "height": 64,
  "data": [
    ["#FFFFFF", "#FFFFFF", "..."],
    ["#FFFFFF", "#FF0000", "..."]
  ]
}
```

### `GET /api/canvas/compressed`

Returns a compressed canvas payload using:

- **Palette aliases**: each unique color appears once in `palette`
- **Run-length encoding (RLE)**: `runs` stores repeated adjacent pixels as `[count, alias]`

Pixels are flattened row-by-row (left to right, top to bottom) before compression.

#### Response

```json
{
  "width": 128,
  "height": 64,
  "encoding": "palette-rle-v1",
  "palette": ["#FFFFFF", "#FF0000", "#000000"],
  "runs": [[1200, 0], [1, 1], [31, 0], [14, 2]],
  "pixelCount": 8192
}
```

#### Field Definitions

- `width`: Canvas width in pixels
- `height`: Canvas height in pixels
- `encoding`: Compression scheme identifier
- `palette`: Array of unique color strings
- `runs`: Array of `[count, alias]` tuples
  - `count`: Number of repeated pixels
  - `alias`: Index into `palette`
- `pixelCount`: Total decoded pixels (should equal `width * height`)

### `GET /api/canvas/decompress`

Returns a raw JavaScript helper script that can decode `/api/canvas/compressed` payloads.

The script exports:

- `decompressCanvasToFlat(payload)` -> `string[]`
- `decompressCanvas2D(payload)` -> `string[][]`

In browsers, these are available on `window.CanvasCompression`.
In Node/CommonJS, they are available via `module.exports`.

### `GET /api/canvas/png`

Returns the current canvas as a PNG image (`image/png`).

#### Query Parameters

- `scale` (optional): integer zoom multiplier from `1` to `32`
  - Default: `1`
  - Final output size: `(128 * scale) x (64 * scale)`

If `scale` is invalid, the endpoint returns `400` with a JSON error response.

#### Example

```bash
curl "http://localhost:3000/api/canvas/png" --output canvas.png
```

```bash
curl "http://localhost:3000/api/canvas/png?scale=8" --output canvas@8x.png
```

## Tutorial: Consume Compressed Canvas Data

### Browser Example

```html
<script src="http://localhost:3000/api/canvas/decompress"></script>
<script>
  async function loadCanvas() {
    const response = await fetch('http://localhost:3000/api/canvas/compressed');
    const compressed = await response.json();
    const rows = window.CanvasCompression.decompressCanvas2D(compressed);
    console.log('Rows:', rows.length, 'Columns:', rows[0].length);
  }

  loadCanvas();
</script>
```

### Node Example

```js
const { decompressCanvas2D } = require('./public/js/canvas-decompress');

async function loadCanvas() {
  const response = await fetch('http://localhost:3000/api/canvas/compressed');
  const compressed = await response.json();
  const rows = decompressCanvas2D(compressed);
  console.log(rows.length, rows[0].length);
}

loadCanvas();
```

### Render to a `<canvas>` in Browser

```js
async function paintToCanvas(canvasEl) {
  const [compressedRes, helperRes] = await Promise.all([
    fetch('/api/canvas/compressed'),
    fetch('/api/canvas/decompress')
  ]);

  // If the helper wasn't loaded by script tag, inject it dynamically.
  if (!window.CanvasCompression) {
    const helperSource = await helperRes.text();
    // eslint-disable-next-line no-eval
    eval(helperSource);
  }

  const payload = await compressedRes.json();
  const rows = window.CanvasCompression.decompressCanvas2D(payload);

  const ctx = canvasEl.getContext('2d');
  canvasEl.width = payload.width;
  canvasEl.height = payload.height;

  for (let y = 0; y < payload.height; y += 1) {
    for (let x = 0; x < payload.width; x += 1) {
      ctx.fillStyle = rows[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
```

## Socket.io API

The front-end and server exchange these main events:

- Client -> Server:
  - `placePixel`: `{ x, y, color }`
  - `purchasePixels`: `{ packSize, pin }`
  - `getBalance`: no payload
- Server -> Client:
  - `canvasState`: `[{ x, y, color }, ...]`
  - `canvasUpdate`: `{ x, y, color }`
  - `balanceUpdate`: `number`
  - `purchaseSuccess`: `{ packSize, newBalance }`
  - `purchaseError`: `{ message }`
  - `error`: `{ message }`

## Development Notes

- Canvas dimensions are fixed at `128x64`.
- Default background color is white (`#000000`).
- SQLite database is created at `database/place.db`.
- Session storage uses `sessions.db` in project root.

## Troubleshooting

- **OAuth redirect loops**: verify `THIS_URL` matches how you access the app.
- **Formbar purchase errors**: verify `API_KEY`, `AUTH_URL`, and `APP_ACCOUNT_ID`.
- **Session issues**: set a strong `SESSION_SECRET` and restart server after updating env.

## License

ISC
