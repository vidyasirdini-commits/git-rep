# QuickCart Delivery Platform

QuickCart is a rapid local delivery platform with customer shopping, live order tracking, store partner operations, and admin analytics.

## Included

- Customer catalog, search, cart, checkout, order history, and live tracking
- Partner fulfillment queue and inventory updates
- Admin sales analytics, platform revenue, and delivery zones
- Express API with OpenAPI-generated React Query hooks
- PostgreSQL schema and seeded development data

## Run locally

Install dependencies with pnpm, then start the API and web packages with the workspace workflows. The API expects DATABASE_URL and the web package expects PORT and BASE_PATH from the runtime.

## Project map

- artifacts/quickcart — React + Vite frontend
- artifacts/api-server — Express API
- lib/api-spec — OpenAPI source of truth
- lib/db — Drizzle PostgreSQL schema

This project was built in Replit and is connected to GitHub for collaboration.
