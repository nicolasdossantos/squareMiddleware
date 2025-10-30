# Fluent Front AI - Dashboard

A modern, responsive frontend for the Fluent Front AI receptionist platform.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **TanStack Query** - Data fetching and caching
- **Zustand** - State management

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Development

```bash
# Start dev server (http://localhost:5173)
npm run dev

# The dashboard will proxy API calls to http://localhost:3000/api
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Type check
npm run type-check
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── Header.tsx
│   ├── HeroSection.tsx
│   ├── DemoCarousel.tsx
│   ├── FeatureHighlights.tsx
│   ├── CTABanner.tsx
│   ├── Footer.tsx
│   └── AIBotIllustration.tsx
├── pages/            # Page components
│   └── LandingPage.tsx
├── hooks/            # Custom React hooks
├── services/         # API calls and external service integrations
├── utils/            # Utility functions
├── App.tsx           # Root component with routing
├── main.tsx          # Entry point
└── index.css         # Global styles

public/              # Static assets
```

## Design System

### Colors

**Light Mode:**
- Background: `#F8FAFB`
- Surface: `#FFFFFF`
- Primary Text: `#1B1D1F`
- Secondary Text: `#636C72`
- Primary Accent: `#00C7C7`

**Dark Mode:**
- Background: `#0D1117`
- Surface: `#161B22`
- Primary Text: `#F3F6F8`
- Secondary Text: `#9CA3AF`
- Primary Accent: `#00E0E0`

### Typography

- Font Family: **Inter** (variable)
- Weights: 400, 500, 600, 700

### Components

- Button Radius: `12px`
- Card Radius: `20px`
- Spacing Scale: `8px`

## Environment Variables

Create a `.env.local` file with:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Fluent Front AI
VITE_APP_URL=http://localhost:5173
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DARK_MODE=true
```

## API Integration

The dashboard communicates with the backend API at `/api/*`:

- `POST /api/auth/register` - User signup
- `POST /api/auth/login` - User login
- `GET /api/customers` - Fetch customers
- `GET /api/call-logs` - Fetch call logs
- And more...

See backend documentation for full API reference.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` and `npm run type-check`
4. Submit a pull request

## License

Proprietary - Fluent Front AI
