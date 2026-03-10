# AppDetails Refactoring - Quick Start Guide

## What Changed?

The AppDetails page has been refactored from a single file into a modular structure:
- **Before**: `pages/AppDetails.tsx` (670 lines)
- **After**: `pages/AppDetails/` directory (16 files)

## New Tab Structure

1. **Server Overview** - Instance info, K8s details, SSH
2. **App Details** - Application-specific content (NEW!)
3. **Web Terminal** - Interactive terminal
4. **Container Logs** - Pod logs
5. **Container Events** - K8s events

## Testing the Implementation

### 1. Start the Frontend
```bash
cd haik8s/frontend
npm run dev
```

### 2. Navigate to an OpenClaw Instance
- Go to `/apps`
- Click "OpenClaw"
- Click "Details" on an instance

### 3. Test Each Tab
- **Server Overview**: Check instance info displays
- **App Details**: Should show 4 sections (Usage Guide, Basic Config, Model Config, Channel Config)
- **Web Terminal**: Terminal should work (if container running)
- **Container Logs**: Logs should load
- **Container Events**: Events should display and refresh

## Backend API Testing

### Get OpenClaw Config
```bash
# Requires: container_id, app_id='openclaw', auth token
curl -X GET "http://localhost:8000/api/applications/openclaw/openclaw-config?instance_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update OpenClaw Config
```bash
curl -X PUT "http://localhost:8000/api/applications/openclaw/openclaw-config" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": 1,
    "models": {
      "providers": {
        "anthropic": {
          "baseUrl": "https://api.anthropic.com",
          "apiKey": "sk-...",
          "api": "anthropic",
          "models": []
        }
      }
    }
  }'
```

## Adding a New Application

To add details for a new application (e.g., "myapp"):

### 1. Create Component File
```bash
cd haik8s/frontend/src/pages/AppDetails/app-specific
touch MyAppDetails.tsx
```

### 2. Implement Component
```typescript
// MyAppDetails.tsx
import type { AppDetailsProps } from '../types';

export default function MyAppDetails({ appId, instance }: AppDetailsProps) {
  return (
    <div className="space-y-4">
      <h2>Details for {appId}</h2>
      <p>Instance: {instance.name}</p>
      {/* Add your custom sections here */}
    </div>
  );
}
```

### 3. Register Component
```typescript
// app-specific/index.ts
import OpenClawDetails from './OpenClawDetails';
import MyAppDetails from './MyAppDetails';  // Add this

export const APP_DETAILS_COMPONENTS = {
  openclaw: OpenClawDetails,
  myapp: MyAppDetails,  // Add this
};
```

### 4. Test
Navigate to `/apps/myapp/details` - your component should appear in the "App Details" tab.

## Troubleshooting

### "App Details" tab is empty
- Check: Is your app registered in `APP_DETAILS_COMPONENTS`?
- Check: Is the container running? (Some details require running containers)

### Config not loading
- Check: Container status (must be "running")
- Check: Config file exists at `~/.openclaw/openclaw.json`
- Check: Network tab in browser DevTools for API errors

### TypeScript errors
```bash
cd haik8s/frontend
npm run build
# Look for errors in AppDetails/ files only
```

### Restore original (if needed)
```bash
mv haik8s/frontend/src/pages/AppDetails.tsx.bak haik8s/frontend/src/pages/AppDetails.tsx
rm -rf haik8s/frontend/src/pages/AppDetails/
```

## File Structure Reference

```
AppDetails/
├── index.tsx              # Main component - handles routing & tabs
├── types.ts               # Shared TypeScript types
├── constants.tsx          # Tab configs & status metadata
├── components/            # Reusable tab components
│   ├── ServerOverview.tsx
│   ├── WebTerminal.tsx
│   ├── ContainerLogs.tsx
│   ├── ContainerEvents.tsx
│   ├── StatusBadge.tsx
│   ├── StatusDot.tsx
│   └── InfoSection.tsx
└── app-specific/          # App-specific details
    ├── index.ts           # Component registry
    └── OpenClawDetails/
        ├── UsageGuide.tsx
        ├── BasicConfiguration.tsx
        ├── ModelConfiguration.tsx
        └── ChannelConfiguration.tsx
```

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications/{app_id}/openclaw-config?instance_id={id}` | Read OpenClaw config |
| PUT | `/api/applications/{app_id}/openclaw-config` | Update OpenClaw config |

Request body for PUT:
```json
{
  "instance_id": 1,
  "models": { ... },      // Optional
  "channels": { ... }     // Optional
}
```

## Next Steps

1. **Test runtime functionality** - Click through all tabs
2. **Test with real OpenClaw instance** - Verify config loads
3. **Add OpenDrSai details** - Follow "Adding a New Application" guide
4. **Implement full editing** - Add modal forms for model/channel editing

## Support

- Implementation details: See `IMPLEMENTATION_SUMMARY.md`
- Original plan: See plan document provided
- Questions: Check code comments in each component

