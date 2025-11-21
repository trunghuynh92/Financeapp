# Mobile Development Plan - Expo React Native

## Overview

Plan to develop a native mobile version of the Finance App using Expo (React Native) to share maximum code with the existing Next.js web application.

## Phase 1: Architecture & Code Preparation (Week 1-2)

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

### 1.3 Authentication Architecture

**Current:** Supabase Auth (server-side and client-side)

**Mobile Needs:**
- React Native compatible auth flow
- Secure token storage
- Biometric authentication (Face ID, Touch ID)

#### Tasks:
- [ ] Install `@supabase/supabase-js` for React Native
- [ ] Set up `expo-secure-store` for token storage
- [ ] Implement OAuth flow for mobile (if using social login)
- [ ] Add biometric authentication with `expo-local-authentication`
- [ ] Create shared auth hooks

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
- **Zustand or Jotai:** Lightweight global state
- **WatermelonDB:** Offline-first SQLite database (optional, for advanced offline)

#### Tasks:
- [ ] Install TanStack Query for both web and mobile
- [ ] Refactor data fetching to use React Query
- [ ] Implement optimistic updates for transactions
- [ ] Set up offline queue for pending operations
- [ ] Create sync strategy for offline/online transitions

## Phase 2: Mobile App Setup (Week 3)

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

# UI libraries
npm install react-native-reanimated react-native-gesture-handler
npm install @react-navigation/native @react-navigation/native-stack

# Forms and validation
npm install react-hook-form zod

# Date handling
npm install date-fns

# API and state
npm install @tanstack/react-query @supabase/supabase-js zustand

# UI components (choose one)
npm install react-native-paper  # Material Design
# OR
npm install @rneui/themed       # React Native Elements
# OR
npm install tamagui             # Universal UI (web + mobile)
```

### 2.2 Project Structure

```
apps/mobile/
├── app/                        # Expo Router file-based routing
│   ├── (auth)/                # Auth group
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                # Main app tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Dashboard
│   │   ├── accounts.tsx
│   │   ├── transactions.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx            # Root layout
│   └── +not-found.tsx
├── components/                 # Mobile-specific components
│   ├── AccountCard.tsx
│   ├── TransactionList.tsx
│   └── ...
├── hooks/                      # Mobile-specific hooks
├── lib/                        # Mobile-specific utilities
│   ├── supabase.ts
│   └── api-client.ts
├── constants/                  # Mobile constants
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
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.financeapp",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Allow Finance App to use Face ID for secure authentication"
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
        "USE_FINGERPRINT"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-local-authentication"
    ]
  }
}
```

## Phase 3: Core Features Implementation (Week 4-8)

### 3.1 Must-Have Features (MVP)

#### Week 4: Authentication & Setup
- [ ] Login / Register screens
- [ ] Biometric authentication
- [ ] Onboarding flow
- [ ] Profile management

#### Week 5: Dashboard & Accounts
- [ ] Dashboard overview with balances
- [ ] Account list
- [ ] Account details view
- [ ] Add/edit accounts

#### Week 6: Transactions
- [ ] Transaction list with filters
- [ ] Transaction details
- [ ] Add transaction (manual entry)
- [ ] Quick transaction entry
- [ ] Transaction categorization

#### Week 7: Transfers & Matching
- [ ] Transfer between accounts
- [ ] Transfer matching
- [ ] Investment contributions/withdrawals
- [ ] Loan disbursements

#### Week 8: Reports & Polish
- [ ] Basic reports (income/expense)
- [ ] Account balance history
- [ ] Offline mode handling
- [ ] Error states and loading states
- [ ] Push notifications setup

### 3.2 Nice-to-Have Features (Post-MVP)

- [ ] Receipt photo capture
- [ ] OCR for receipt scanning
- [ ] Budget tracking
- [ ] Recurring transactions
- [ ] Multi-currency support
- [ ] Export data (CSV, PDF)
- [ ] Widgets (iOS/Android)
- [ ] Apple Pay / Google Pay integration
- [ ] Bank account sync (via Plaid or similar)

## Phase 4: Testing & Deployment (Week 9-10)

### 4.1 Testing Strategy

#### Manual Testing:
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Test on real iOS device
- [ ] Test on real Android device
- [ ] Test offline scenarios
- [ ] Test auth flows
- [ ] Test data sync

#### Automated Testing:
- [ ] Set up Jest for unit tests
- [ ] Set up Detox for E2E tests
- [ ] Write tests for critical flows
- [ ] Set up CI/CD pipeline

### 4.2 Deployment

#### Internal Testing:
- [ ] Create Expo development build
- [ ] Distribute via Expo Go (for testing)
- [ ] Create TestFlight build (iOS)
- [ ] Create internal testing track (Android)

#### Production Release:
- [ ] Create EAS Build configuration
- [ ] Generate production builds
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

**Platform-Specific Code (~30-40%):**
- UI components (web: shadcn/ui, mobile: React Native components)
- Navigation (web: Next.js App Router, mobile: Expo Router)
- Layout and styling (web: Tailwind, mobile: StyleSheet/Tamagui)
- Platform APIs (camera, biometrics, notifications)
- File system and storage

### Component Adaptation Strategy

**Option 1: Component Wrappers**
```typescript
// packages/ui/Button.tsx
import { Platform } from 'react-native'

export const Button = Platform.select({
  web: () => require('./Button.web').Button,
  default: () => require('./Button.native').Button,
})()
```

**Option 2: Universal Components (Tamagui)**
```typescript
// Works on both web and mobile
import { Button } from 'tamagui'
```

**Recommendation:** Start with Option 1, consider Option 2 for v2.

### Database Strategy

**Local Storage:**
- Web: LocalStorage, IndexedDB
- Mobile: AsyncStorage, SecureStore, SQLite (WatermelonDB)

**Sync Strategy:**
1. User actions create pending operations
2. Operations queued in local database
3. Sync runs when online
4. Conflicts resolved (last-write-wins or custom)
5. Optimistic UI updates

### Performance Optimization

- [ ] Implement list virtualization (FlashList)
- [ ] Lazy load screens with React.lazy
- [ ] Optimize images with expo-image
- [ ] Use React.memo for expensive components
- [ ] Implement pagination for large lists
- [ ] Cache API responses with React Query
- [ ] Minimize bundle size with tree-shaking

## Environment Setup

### Development Environment Variables

**apps/mobile/.env:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://your-api.com/api
```

### Required Accounts & Services

- [ ] Expo account (free tier sufficient for start)
- [ ] Apple Developer Program ($99/year for iOS)
- [ ] Google Play Console ($25 one-time for Android)
- [ ] EAS Build service (for production builds)
- [ ] Supabase project (already have)

## Migration Checklist

### Before Starting Mobile Development:

- [ ] Review all API endpoints for mobile compatibility
- [ ] Ensure authentication works with JWT tokens
- [ ] Test API endpoints with tools like Postman
- [ ] Document all API endpoints (consider OpenAPI/Swagger)
- [ ] Implement API versioning (/api/v1/*)
- [ ] Add rate limiting to API routes
- [ ] Set up monitoring and error tracking (Sentry)

### During Mobile Development:

- [ ] Keep web and mobile in sync (share types, constants)
- [ ] Test on real devices early and often
- [ ] Handle offline scenarios gracefully
- [ ] Implement proper error boundaries
- [ ] Add analytics (Expo Analytics or Firebase)
- [ ] Plan for app updates (OTA vs store updates)

## Estimated Timeline

- **Phase 1 (Prep):** 2 weeks
- **Phase 2 (Setup):** 1 week
- **Phase 3 (Features):** 5 weeks
- **Phase 4 (Testing):** 2 weeks
- **Total:** ~10 weeks for MVP

## Resources

### Documentation:
- Expo: https://docs.expo.dev
- React Native: https://reactnative.dev
- Expo Router: https://docs.expo.dev/router/introduction
- Supabase React Native: https://supabase.com/docs/guides/getting-started/quickstarts/react-native
- TanStack Query: https://tanstack.com/query/latest

### Learning Resources:
- Expo YouTube channel
- React Native School
- William Candillon (React Native animations)

### Tools:
- Expo Go (testing app)
- EAS CLI (build and deployment)
- React Native Debugger
- Flipper (advanced debugging)

## Next Steps

1. **Week 1:** Set up monorepo structure and extract shared code
2. **Week 2:** Refactor API to work standalone, implement React Query
3. **Week 3:** Initialize Expo project and basic navigation
4. **Week 4:** Implement authentication flow
5. **Continue with feature development...**
