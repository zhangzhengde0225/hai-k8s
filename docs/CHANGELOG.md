# HAI-K8S Frontend Redesign - Changelog

## Version 2.0.0 - Frontend Redesign

### 🎨 Major Changes

#### New Layout System
- **Header + Sidebar Layout**: Replaced single-layer layout with two-tier structure
  - Header: 64px height, contains logo, language switcher, theme toggle, and user menu
  - Sidebar: 210px width, contains navigation menu
  - User information moved from sidebar bottom to header top-right

#### Internationalization (i18n)
- **Multi-language Support**: Full Chinese and English support
  - Default language: Chinese (zh)
  - Switchable via language selector in header
  - Persistent language preference in localStorage
- **Translation Files**: Organized by namespace
  - `common.json`: General UI text
  - `auth.json`: Authentication related
  - `container.json`: Container management
  - `admin.json`: Admin features
  - `errors.json`: Error messages

#### Theme System
- **Dark Mode Support**: Complete light/dark theme switching
  - Light mode: Default white/gray color scheme
  - Dark mode: Dark gray/black color scheme
  - Persistent theme preference in localStorage
  - No flash on page load (pre-initialized)
- **All Pages Adapted**: Every page supports both themes

### 🆕 New Components

- `Header.tsx` - Top navigation bar
- `Sidebar.tsx` - Left sidebar menu
- `ThemeToggle.tsx` - Theme switch button
- `LanguageSwitcher.tsx` - Language selector dropdown
- `UserMenu.tsx` - User profile dropdown menu

### 🔧 Modified Components

- `Layout.tsx` - Complete restructure to two-tier layout
- `LoginPage.tsx` - Added i18n and dark mode support
- `Dashboard.tsx` - Added i18n and dark mode support
- `CreateContainer.tsx` - Added dark mode support
- `ContainerDetail.tsx` - Added dark mode support
- `AdminUsers.tsx` - Added dark mode support
- `AdminImages.tsx` - Added dark mode support
- `AdminCluster.tsx` - Added dark mode support
- `App.tsx` - Initialize theme and language on mount
- `main.tsx` - Import i18n configuration
- `index.css` - Added theme CSS variables
- `index.html` - Added theme pre-initialization script

### 📦 New Dependencies

- `react-i18next@^15.x` - React internationalization framework
- `i18next@^24.x` - i18n core library

### 🗂️ New Files

**State Management:**
- `src/stores/themeStore.ts` - Theme state management (Zustand)
- `src/stores/languageStore.ts` - Language state management (Zustand)

**i18n Configuration:**
- `src/i18n/index.ts` - i18next initialization
- `src/i18n/types.ts` - TypeScript type definitions

**Translation Files (10 files):**
- `src/i18n/locales/en/*.json` (5 files)
- `src/i18n/locales/zh/*.json` (5 files)

**UI Components (5 files):**
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/LanguageSwitcher.tsx`
- `src/components/UserMenu.tsx`

**Documentation:**
- `docs/frontend-redesign-report.md` - Implementation report

### 🎯 Features

#### Language Switching
- Click language button in header (shows "中文" or "EN")
- Select from dropdown menu
- Immediate UI update
- Preference saved to localStorage

#### Theme Switching
- Click theme button in header (moon or sun icon)
- Immediate theme change
- Preference saved to localStorage
- Smooth color transitions

#### User Menu
- Click user avatar/name in header
- Shows user info (name, email)
- Logout button with icon
- Closes on outside click

### 🔄 Breaking Changes

None. All existing features remain functional.

### 🐛 Bug Fixes

None. This is a feature release.

### 📝 Notes

- All text in UI is now translatable
- Theme preference persists across sessions
- Language preference persists across sessions
- No performance impact on existing features
- Build size increased by ~2KB (gzip) due to i18n

### 🔜 Future Enhancements

- Lazy load translation files
- Sync with system theme preference
- Keyboard shortcuts for theme toggle
- Mobile responsive menu
- Additional language support
- More theme variants (high contrast, etc.)

---

**Full Changelog**: v1.0.0...v2.0.0
**Date**: 2026-02-11
**Contributors**: Claude Sonnet 4.5
