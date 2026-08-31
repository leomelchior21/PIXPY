# PixPy

PixPy is a game-like Python playground for a small middle-school classroom. The first vertical slice, Runner Lab, lets students hack an original pixel runner, observe immediate consequences, and discover variables through play.

## Run locally

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Run `npm install`.
3. Run `npm run dev`.

The teacher/test access ID is configured in the classroom handoff and is intentionally not printed in the UI. Student access is validated by a protected Supabase RPC after the database migration and private roster seed have been applied. If Supabase is unavailable, an existing local session still works and progress is saved in the browser.

## Supabase

Run `supabase/migrations/202608310001_pixpy_core.sql` in the Supabase SQL editor. The roster seed is generated locally from the school list and is ignored by Git so student information is not published. See `supabase/README.md`.

## Quality checks

```sh
npm run lint
npm test
npm run build
```

## Architecture

- React + TypeScript + Vite
- CodeMirror for a focused, touch-friendly Python editor
- Pyodide loaded on demand for genuine in-browser Python execution
- Canvas for the Runner Lab game layer
- Supabase RPCs with deny-by-default RLS for student identification and progress
- Local-first saves for classroom network resilience
