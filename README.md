# vkr-analysis-frontend

React + TypeScript frontend for the VKR analytics MVP.

## Stack

- Vite
- pnpm
- Tailwind CSS
- shadcn/ui-style local components
- Apache ECharts
- TanStack Table

## Run

```bash
pnpm install
pnpm dev
```

The app expects the backend at `http://127.0.0.1:8000`.
Override it with:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## MVP Flow

1. Login with backend credentials, for example `admin` / `admin` after applying the demo seed.
2. Load semantic analytics fields from `GET /analytics/fields`.
3. Use report presets or build a custom analytics query.
4. Render the response as a TanStack table and ECharts chart.
5. Open the rating tab or export reports to XLSX.