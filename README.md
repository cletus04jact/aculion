# ACULION Platform Monorepo

Clean monorepo workspace organizing ACULION web applications, spatial & traffic microservices, and shared packages.

## Monorepo Folder Structure

```text
aculion-platform/
├── apps/
│   ├── web/                    # Main React/Vite platform application + Email Express Server
│   ├── location-intelligence/  # Location Intelligence frontend module
│   └── traffic-intelligence/   # Traffic Intelligence frontend module (Traffic UI)
├── services/
│   ├── location-service/       # FastAPI location & spatial analytics engine
│   ├── traffic-service/        # FastAPI traffic telemetry, database polling & real-time events
│   └── api-gateway/            # Unified API routing gateway (Port 8080)
├── packages/
│   ├── ui/                     # Shared design system & UI components
│   ├── maps/                   # Shared geospatial & map components
│   └── config/                 # Shared configurations
├── start-dev.ps1               # Local development PowerShell launcher
├── package.json                # Monorepo NPM workspace configuration & dev scripts
└── README.md                   # Monorepo architecture summary
```

## Architecture

The platform uses a single gateway routing architecture. Frontend applications communicate **only** with the API Gateway, which forwards requests internally to downstream services.

```text
                    Internet
                       │
                       ▼
                 Web Application
                  apps/web
                       │
                       │ HTTPS
                       ▼
              ┌──────────────────┐
              │    API Gateway   │
              │ services/        │
              │ api-gateway/     │ (Port 8080)
              └────────┬─────────┘
                       │
             ┌─────────┴──────────┐
             │                    │
             ▼                    ▼
     /api/location/*       /api/traffic/*
             │                    │
             ▼                    ▼
    location-service       traffic-service
      (Port 8000)            (Port 8095)
```

## Quick Start (Local Development)

### 1. Initial Setup
Run the setup command at the root to install both frontend and backend dependencies (including node modules and python virtual environments):
```bash
npm run setup
```

### 2. Launch Services
Start all components (frontend, API Gateway, location service, traffic service, and traffic UI) using the PowerShell script:
```powershell
.\start-dev.ps1
```
Or run the concurrent dev command:
```bash
npm run dev
```

## Individual Services Documentation
- For detailed API Gateway instructions, see [services/api-gateway/README.md](file:///e:/Aculion/site/aculion-site-main/aculion-platform/services/api-gateway/README.md).
- For Location Intelligence backend, see [services/location-service/README.md](file:///e:/Aculion/site/aculion-site-main/aculion-platform/services/location-service/README.md).
