# FIRE Architect Pro

TypeScript + TSX refactor of the FIRE dashboard UI with a Vite frontend and Node/Express API.

## Local Development

Install dependencies:

```bash
npm install
```

Run frontend and API together:

```bash
npm start
```

Default local ports:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

If `5173` is already in use, Vite will move to the next free port.

## Build

```bash
npm run build
```

The production frontend is emitted to `dist/`.

## Deploy To Vercel

The project uses:

- static frontend from Vite
- serverless functions under `api/`

Deploy settings:

- Framework preset: `Other`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Project Structure

- `src/App.tsx`: app shell and top-level composition
- `src/hooks/`: planner, chart, and snapshot state logic
- `src/components/`: reusable UI pieces and tab views
- `src/services/api.ts`: API requests
- `api/`: Vercel serverless endpoints