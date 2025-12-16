# Fintech Mobile Application

A production-ready fintech mobile application with React Native frontend and Node.js backend.

## Project Structure

```
├── backend/          # Node.js Express API
│   ├── src/          # Source code
│   ├── prisma/       # Database schema and migrations
│   └── package.json
├── mobile/           # React Native mobile app (CLI)
│   ├── src/          # Source code
│   ├── android/      # Android native project
│   ├── ios/          # iOS native project
│   └── package.json
└── docker-compose.yml # PostgreSQL and Redis services
```

## Prerequisites

- Node.js 20+
- npm
- Docker and Docker Compose
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- JDK 17+ (for Android)

## Getting Started

### 1. Start Database Services

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

### 3. Mobile App Setup

```bash
cd mobile
npm install

# For Android
npm run android

# For iOS (macOS only)
cd ios && pod install && cd ..
npm run ios
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Mobile Tests

```bash
cd mobile
npm test
```

## Environment Variables

See `.env.example` files in each project directory for required environment variables.

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL with Prisma ORM
- Redis for caching and sessions
- Socket.io for real-time updates
- Jest for testing
- fast-check for property-based testing

### Mobile
- React Native (CLI)
- TypeScript
- Zustand for state management
- React Navigation
- Jest and React Native Testing Library
- fast-check for property-based testing
