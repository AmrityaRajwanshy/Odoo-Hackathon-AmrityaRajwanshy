# AssetFlow — Enterprise Asset & Resource Management

A full-featured **Enterprise Asset & Resource Management System** built for the **Odoo Hackathon** by [AmrityaRajwanshy](https://github.com/AmrityaRajwanshy).

---

## 🚀 Features

- 📦 **Asset Directory** — Track all assets with tags, status, condition & location
- 📋 **Allocation Management** — Assign assets to employees and departments
- 📅 **Booking System** — Reserve bookable assets with time-based scheduling
- 🔧 **Maintenance Requests** — Raise and track repair/maintenance tickets
- 🔍 **Audit Cycles** — Run asset verification audits with checklists
- 📊 **Reports & Analytics** — Visual insights on asset utilization
- 🔔 **Notifications** — Activity log and system alerts
- 👤 **Profile & Setup** — Role-based access (Admin / Asset Manager / Employee)

---

## 🛠️ Tech Stack

| Technology | Version |
|---|---|
| [Next.js](https://nextjs.org/) | 16.2.10 |
| [React](https://react.dev/) | 19.2.4 |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.3 |

---

## 📋 Prerequisites

Make sure you have the following installed before getting started:

- **Node.js** v18 or higher → [Download](https://nodejs.org/)
- **npm** v9 or higher (comes with Node.js)

Verify your versions:
```bash
node -v
npm -v
```

---

## ⚡ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AmrityaRajwanshy/Odoo-Hackathon-AmrityaRajwanshy.git
cd Odoo-Hackathon-AmrityaRajwanshy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The app will start at:

```
http://localhost:3000
```

> If port 3000 is busy, Next.js will automatically use the next available port (e.g., 3001, 3002).

---

## 📁 Project Structure

```
.
├── public/                     # Static assets (images, SVGs)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Root page (redirects to /login)
│   │   ├── globals.css         # Global styles
│   │   ├── login/              # Login page
│   │   ├── dashboard/          # Main dashboard
│   │   ├── assets/             # Asset directory
│   │   ├── allocation/         # Asset allocation
│   │   ├── booking/            # Booking management
│   │   ├── maintenance/        # Maintenance requests
│   │   ├── audit/              # Audit cycles
│   │   ├── reports/            # Reports & analytics
│   │   ├── notifications/      # Notifications
│   │   ├── profile/            # User profile
│   │   └── setup/              # System setup
│   ├── components/
│   │   ├── Badge.tsx           # Status badge component
│   │   ├── LayoutWrapper.tsx   # Layout with sidebar
│   │   ├── LineSidebar.tsx     # Line-style sidebar
│   │   ├── Sidebar.tsx         # Main sidebar navigation
│   │   └── Topbar.tsx          # Top navigation bar
│   └── context/
│       └── AppContext.tsx      # Global state management
├── .eslintrc.json
├── .gitignore
├── next.config.mjs
├── package.json
└── tsconfig.json
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server (after build) |
| `npm run lint` | Run ESLint to check for errors |

---

## 🧑‍💻 Roles

The system supports 3 role levels that can be switched from the UI:

| Role | Access |
|---|---|
| **Admin** | Full access — manage all assets, users, settings |
| **Asset Manager** | Manage assets, allocations, maintenance |
| **Employee** | View assets, create booking & maintenance requests |

---

## 📦 Build for Production

```bash
npm run build
npm run start
```

The production server will be available at `http://localhost:3000`.

---

## 🤝 Contributing

This project was built for the **Odoo Hackathon**. Feel free to fork and extend!

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
