# AssetFlow - Frontend Documentation

This repository contains the frontend client for the **AssetFlow** application, a visual command center for comprehensive asset and resource management.

The frontend is built using **Next.js** (App Router) and **React**, styled via a custom CSS design system optimized for high-end glassmorphism and modern UI workflows.

## Tech Stack
*   **Framework:** Next.js (React 18+)
*   **State Management:** React Context API (`src/context/AppContext.tsx`)
*   **Data Fetching:** Direct integration mapping to the FastAPI Backend Server
*   **Styling:** Global CSS, CSS Variables for seamless theming (no external heavy frameworks)

## Application Structure
The application maps perfectly to a 10-screen architecture mapped inside `/src/app/` using the Next.js App Router:

1.  **`/login`**: The authentication gateway (Signup/Login/Password Reset).
2.  **`/setup`**: (Admins only) Manage departments, configure asset categories, and assign employee roles.
3.  **`/dashboard`**: Conditional dashboard rendering (Admin Dashboard vs Manager Dashboard vs Employee Dashboard) highlighting tasks and KPI cards.
4.  **`/assets`**: The core directory. A searchable, filterable grid to find tech and register new items.
5.  **`/allocation`**: Checkout & Transfer system. Manages handoffs, re-assignments, and flags overdue items.
6.  **`/booking`**: A timeline/calendar styled view allowing users to reserve shared resources (like Conference Rooms) based on specific hour slots.
7.  **`/maintenance`**: A Kanban-board visualizer dragging repair tickets through states (`Pending -> Approved -> Assigned -> Resolved`).
8.  **`/audit`**: The verification workspace displaying active audit tracking and resolution.
9.  **`/reports`**: Manager visibility. Renders visual charts, density heatmaps for peak asset usage, and provides `.csv` / `.pdf` export buttons.
10. **`/notifications`**: The global activity feed visually categorizing all system alerts and logs into tabs.

## Centralized State (`AppContext.tsx`)
Because of the heavy interconnectedness of the modules (e.g., resolving a maintenance ticket needs to update the core asset status across the active dashboards), the core application state is wrapped in a unified Context pipeline (`AppContext.tsx`). 

This engine acts as the middle-layer bridge: it hydrates the local React UI components while simultaneously syncing actions out to the FastAPI backend API via standard Fetch wrappers. It handles global authentication state and role identification (`currentRole`).

## Design Philosophy & Styling
AssetFlow prioritizes UX and rapid operability:
*   **Modular Overlays:** Creation and editing forms often use side-drawers and floating modals rather than routing to entirely new pages context switching.
*   **Glassmorphism & Theming:** UI depth is controlled using global CSS variables defining elevated surfaces, glowing borders, and muted typography.
*   **Color-Coded Statuses:** Immediate visual recognition leveraging standard variable blocks (`--status-success`, `--status-warning`, `--status-danger`) uniformly mapped into the `Badge` component.

## Running Locally

```bash
# 1. Install Node modules
npm install

# 2. Run the development server
npm run dev
```

Open `http://localhost:3000` to interact with the application. (Ensure the backend server is running concurrently for full data integration).
