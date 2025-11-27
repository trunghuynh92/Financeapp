# Mobile Development Plan - Expo React Native

## Overview

Plan to develop a native mobile version of the Finance App using Expo (React Native) to share maximum code with the existing Next.js web application.

## Phase 1: Architecture & Code Preparation

### 1.1 Restructure for Code Sharing

**Goal:** Extract platform-agnostic code that can be shared between web and mobile.

#### Create Shared Packages Structure
```
Financeapp/
├── apps/
│   ├── web/                    # Next.js web app (current codebase)
│   └── mobile/                 # Expo mobile app (new)
├── packages/
│   ├── shared/                 # Shared business logic
│   │   ├── api/               # API client functions
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript types
│   │   └── constants/         # Constants
│   ├── ui/                    # Shared UI components (platform-agnostic)
│   └── config/                # Shared configuration
└── package.json               # Root package.json (monorepo)
```

#### Tasks:
- [ ] Set up monorepo structure (using npm workspaces or pnpm)
- [ ] Extract API client functions from Next.js API routes
- [ ] Move TypeScript types to shared package
- [ ] Extract utility functions (date formatting, currency, etc.)
- [ ] Create platform-agnostic hooks

### 1.2 API Backend Requirements

**Current Setup:** Next.js API routes (same codebase as frontend)

**Mobile Requirements:** Need standalone API server

#### Option A: Keep Next.js API Routes (Recommended)
- Deploy Next.js app as API server
- Mobile app calls `/api/*` endpoints via HTTP
- **Pros:** Minimal changes, reuse existing code
- **Cons:** Need to ensure API routes work standalone

#### Option B: Migrate to Standalone API
- Create separate Express/Fastify server
- Migrate API logic from Next.js routes
- **Pros:** Clear separation, better scalability
- **Cons:** More work, duplicate code initially

**Recommendation:** Start with Option A, migrate to Option B later if needed.

#### Tasks:
- [ ] Audit current API routes for mobile compatibility
- [ ] Add CORS configuration for mobile app
- [ ] Implement proper API authentication (JWT tokens)
- [ ] Create API client library for mobile
- [ ] Test API routes work without server-side rendering
- [ ] Implement API versioning (/api/v1/*)
- [ ] Add rate limiting to API routes
- [ ] Document all API endpoints (consider OpenAPI/Swagger)

### 1.3 Authentication Architecture

**Current:** Supabase Auth (server-side and client-side)

**Mobile Needs:**
- React Native compatible auth flow
- Secure token storage
- Biometric authentication (Face ID, Touch ID)

#### Tasks:
- [ ] Install `@supabase/supabase-js` for React Native
- [ ] Set up `expo-secure-store` for token storage
- [ ] Implement OAuth flow for mobile (Google, Apple Sign-In)
- [ ] Add biometric authentication with `expo-local-authentication`
- [ ] Create shared auth hooks
- [ ] Implement session refresh logic

### 1.4 Database & State Management

**Current:**
- Supabase PostgreSQL
- Direct queries from components
- Some client-side state

**Mobile Optimization:**
- Add offline-first capability
- Implement optimistic updates
- Cache frequently accessed data

#### Recommended Libraries:
- **TanStack Query (React Query):** API caching and synchronization
- **Zustand:** Lightweight global state
- **WatermelonDB:** Offline-first SQLite database (for advanced offline)

#### Tasks:
- [ ] Install TanStack Query for both web and mobile
- [ ] Refactor data fetching to use React Query
- [ ] Implement optimistic updates for transactions
- [ ] Set up offline queue for pending operations
- [ ] Create sync strategy for offline/online transitions

## Phase 2: Mobile App Setup

### 2.1 Initialize Expo Project

```bash
cd apps/
npx create-expo-app mobile --template blank-typescript
cd mobile
```

#### Install Core Dependencies:
```bash
# Expo essentials
npx expo install expo-router expo-secure-store expo-local-authentication
npx expo install expo-notifications expo-image expo-haptics

# Navigation & Gestures
npm install react-native-reanimated react-native-gesture-handler
npm install @react-navigation/native @react-navigation/native-stack

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Date handling
npm install date-fns

# API and state
npm install @tanstack/react-query @supabase/supabase-js zustand

# UI - NativeWind (Tailwind for React Native) - matches web styling
npm install nativewind tailwindcss
# OR Tamagui (Universal UI)
npm install tamagui @tamagui/config

# List virtualization
npm install @shopify/flash-list

# Icons
npm install lucide-react-native react-native-svg
```

### 2.2 Project Structure

```
apps/mobile/
├── app/                        # Expo Router file-based routing
│   ├── (auth)/                # Auth group (unauthenticated)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (app)/                 # Main app (authenticated)
│   │   ├── (tabs)/            # Bottom tab navigation
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── accounts.tsx
│   │   │   ├── transactions.tsx
│   │   │   └── more.tsx       # Settings, Profile, etc.
│   │   ├── account/[id].tsx   # Account details
│   │   ├── transaction/[id].tsx
│   │   ├── add-transaction.tsx
│   │   ├── transfer.tsx
│   │   ├── search.tsx         # Global search (like command bar)
│   │   └── settings/
│   │       ├── profile.tsx
│   │       ├── entities.tsx
│   │       └── notifications.tsx
│   ├── _layout.tsx            # Root layout
│   └── +not-found.tsx
├── components/                 # Mobile-specific components
│   ├── ui/                    # Base UI components
│   ├── accounts/
│   ├── transactions/
│   └── common/
├── hooks/                      # Mobile-specific hooks
├── lib/                        # Mobile-specific utilities
│   ├── supabase.ts
│   ├── api-client.ts
│   └── notifications.ts
├── constants/                  # Mobile constants
│   ├── colors.ts
│   └── layout.ts
├── assets/                     # Images, fonts
└── app.json                    # Expo configuration
```

### 2.3 Expo Configuration

**app.json:**
```json
{
  "expo": {
    "name": "Finance App",
    "slug": "finance-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "scheme": "financeapp",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.financeapp",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Allow Finance App to use Face ID for secure authentication",
        "NSCameraUsageDescription": "Allow Finance App to capture receipt photos",
        "NSPhotoLibraryUsageDescription": "Allow Finance App to access photos for receipts"
      },
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.financeapp",
      "permissions": [
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-local-authentication",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Finance App to access photos for receipts"
        }
      ]
    ]
  }
}
```

## Phase 3: Core Features Implementation

### 3.1 MVP Features (Priority Order)

#### Authentication & Onboarding
- [ ] Login screen (email/password)
- [ ] Social login (Google, Apple)
- [ ] Register screen
- [ ] Forgot password flow
- [ ] Biometric authentication (Face ID / Touch ID)
- [ ] Onboarding screens (first-time users)
- [ ] Entity selection/creation

#### Dashboard
- [ ] Total balance overview (all accounts)
- [ ] Balance breakdown by account type
- [ ] Recent transactions list
- [ ] Quick actions (add transaction, transfer)
- [ ] Pull-to-refresh

#### Accounts
- [ ] Account list grouped by type (Bank, Cash, Credit Card, etc.)
- [ ] Account details view
- [ ] Account balance and transaction history
- [ ] Add new account
- [ ] Edit account
- [ ] Balance checkpoint (reconciliation)

#### Transactions
- [ ] Transaction list with infinite scroll
- [ ] Filter transactions (date, type, category, account)
- [ ] Search transactions
- [ ] Transaction details view
- [ ] Add transaction (manual entry)
- [ ] Edit transaction
- [ ] Delete transaction (with confirmation)
- [ ] Transaction categorization (inline edit)
- [ ] Split transaction

#### Transfers & Matching
- [ ] Transfer between own accounts
- [ ] View unmatched transfers
- [ ] Match transfers
- [ ] Unmatch transfers

#### Debt Management
- [ ] Credit card list with balances
- [ ] Credit card charge recording
- [ ] Credit card payment (Quick Pay)
- [ ] Credit line drawdown/repayment
- [ ] Term loan payments
- [ ] Loan receivable tracking

#### Search (Command Bar Equivalent)
- [ ] Global search screen
- [ ] Search transactions by description, amount, date
- [ ] Quick filters
- [ ] Recent searches
- [ ] Voice search (optional)

#### Settings & Profile
- [ ] Profile management
- [ ] Entity switching
- [ ] Notification preferences
- [ ] Security settings (biometrics, PIN)
- [ ] App theme (light/dark/system)
- [ ] Sign out

### 3.2 Post-MVP Features

#### Contracts & Scheduled Payments
- [ ] View contracts list
- [ ] Contract details
- [ ] Create/edit contract
- [ ] View scheduled payments
- [ ] Mark payment as paid
- [ ] Payment reminders

#### Budgets
- [ ] Budget overview
- [ ] Budget by category
- [ ] Budget progress tracking
- [ ] Budget alerts

#### Cash Flow
- [ ] Cash flow projection view
- [ ] Monthly breakdown
- [ ] Scenario comparison (simplified)

#### Reports
- [ ] Income vs Expense summary
- [ ] Expense by category (pie chart)
- [ ] Account balance trends
- [ ] Export reports (PDF/CSV)

#### Receipt Management
- [ ] Capture receipt photo
- [ ] Attach receipt to transaction
- [ ] View receipt gallery
- [ ] OCR receipt scanning (extract amount, date)

#### Advanced Features
- [ ] Push notifications for payment reminders
- [ ] Recurring transaction templates
- [ ] Multi-currency display
- [ ] Home screen widgets (iOS/Android)
- [ ] Quick actions (3D Touch / Long press)
- [ ] Share extension (capture receipts from other apps)
- [ ] Siri Shortcuts / Google Assistant integration
- [ ] Apple Watch companion (balance view)

## Phase 4: Testing & Deployment

### 4.1 Testing Strategy

#### Manual Testing:
- [ ] Test on iOS simulator (multiple device sizes)
- [ ] Test on Android emulator (multiple device sizes)
- [ ] Test on real iOS device
- [ ] Test on real Android device
- [ ] Test offline scenarios
- [ ] Test slow network conditions
- [ ] Test auth flows (login, logout, token refresh)
- [ ] Test data sync after offline period
- [ ] Test biometric authentication
- [ ] Test push notifications

#### Automated Testing:
- [ ] Set up Jest for unit tests
- [ ] Set up React Native Testing Library for component tests
- [ ] Set up Detox or Maestro for E2E tests
- [ ] Write tests for critical flows (auth, transactions)
- [ ] Set up CI/CD pipeline (GitHub Actions + EAS)

### 4.2 Deployment

#### Development Builds:
- [ ] Create Expo development build
- [ ] Set up EAS Build configuration
- [ ] Internal distribution via Expo

#### Beta Testing:
- [ ] TestFlight build (iOS)
- [ ] Internal testing track (Android Play Console)
- [ ] Gather feedback from beta testers

#### Production Release:
- [ ] App Store assets (screenshots, description, keywords)
- [ ] Play Store assets (screenshots, description)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Submit to Apple App Store
- [ ] Submit to Google Play Store
- [ ] Set up OTA updates with EAS Update

## Technical Considerations

### Code Sharing Strategy

**Shared Code (~60-70%):**
- API client functions
- Business logic and data transformations
- TypeScript types and interfaces
- Utility functions (date, currency formatting)
- React hooks (data fetching, form handling)
- Validation schemas (Zod)
- Constants and configuration

**Platform-Specific Code (~30-40%):**
- UI components (web: shadcn/ui, mobile: NativeWind/Tamagui)
- Navigation (web: Next.js App Router, mobile: Expo Router)
- Layout and styling
- Platform APIs (camera, biometrics, notifications)
- File system and storage
- Haptic feedback

### UI Library Recommendation

**Option 1: NativeWind (Recommended)**
- Tailwind CSS for React Native
- Matches your web Tailwind classes
- Easy to share styling knowledge
- Good ecosystem

**Option 2: Tamagui**
- Universal components (web + mobile)
- Great performance
- Steeper learning curve
- Better for true code sharing

**Recommendation:** Start with NativeWind for familiarity, consider Tamagui for v2.

### Offline Strategy

#### Levels of Offline Support:

**Level 1: Read-Only Cache (MVP)**
- Cache API responses with React Query
- Show cached data when offline
- Display "offline" indicator
- Queue actions for when online

**Level 2: Optimistic Updates**
- Apply changes locally immediately
- Sync to server in background
- Handle conflicts

**Level 3: Full Offline (Post-MVP)**
- Local SQLite database (WatermelonDB)
- Full CRUD operations offline
- Sync engine for reconciliation

### Performance Optimization

- [ ] Use FlashList instead of FlatList for large lists
- [ ] Implement list virtualization
- [ ] Lazy load screens
- [ ] Optimize images with expo-image
- [ ] Use React.memo for expensive components
- [ ] Implement pagination for transactions
- [ ] Cache API responses with React Query staleTime
- [ ] Minimize re-renders with proper state structure
- [ ] Use Hermes JavaScript engine

### Security Considerations

- [ ] Store sensitive data in SecureStore (not AsyncStorage)
- [ ] Implement certificate pinning (optional, advanced)
- [ ] Add app lock (biometrics or PIN)
- [ ] Clear sensitive data on logout
- [ ] Handle session expiry gracefully
- [ ] Implement jailbreak/root detection (optional)

## Environment Setup

### Development Environment Variables

**apps/mobile/.env:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://your-api.com/api
EXPO_PUBLIC_APP_ENV=development
```

### Required Accounts & Services

- [ ] Expo account (free tier sufficient for start)
- [ ] Apple Developer Program ($99/year for iOS App Store)
- [ ] Google Play Console ($25 one-time for Android)
- [ ] EAS Build service (included with Expo, paid for priority)
- [ ] Supabase project (already have)
- [ ] Sentry account (for error tracking, free tier)

## Migration Checklist

### Before Starting Mobile Development:

- [ ] Review all API endpoints for mobile compatibility
- [ ] Ensure authentication works with JWT tokens
- [ ] Test API endpoints with tools like Postman/Insomnia
- [ ] Add proper error responses to all API endpoints
- [ ] Implement consistent response format across APIs
- [ ] Set up monitoring and error tracking (Sentry)

### During Mobile Development:

- [ ] Keep web and mobile types in sync
- [ ] Test on real devices early and often
- [ ] Handle offline scenarios gracefully
- [ ] Implement proper error boundaries
- [ ] Add analytics (Expo Analytics or PostHog)
- [ ] Plan for app updates (OTA vs store updates)
- [ ] Document mobile-specific behaviors

## Resources

### Documentation:
- Expo: https://docs.expo.dev
- React Native: https://reactnative.dev
- Expo Router: https://docs.expo.dev/router/introduction
- Supabase React Native: https://supabase.com/docs/guides/getting-started/quickstarts/reactnative
- TanStack Query: https://tanstack.com/query/latest
- NativeWind: https://www.nativewind.dev
- Tamagui: https://tamagui.dev

### Learning Resources:
- Expo YouTube channel
- Simon Grimm (Galaxy.dev)
- William Candillon (React Native animations)
- Catalin Miron (UI tutorials)

### Tools:
- Expo Go (development testing)
- EAS CLI (build and deployment)
- React Native Debugger / Flipper
- Reactotron (debugging and logging)

## Next Steps

1. Set up monorepo structure and extract shared code
2. Refactor API to work standalone, implement React Query on web
3. Initialize Expo project with NativeWind
4. Implement authentication flow
5. Build dashboard and accounts screens
6. Build transactions features
7. Add transfers and debt management
8. Implement search and settings
9. Testing and polish
10. Beta release and iterate
