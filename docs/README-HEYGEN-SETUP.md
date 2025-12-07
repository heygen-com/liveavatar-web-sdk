# HeyGen Live Avatar Setup Guide

This guide provides instructions for setting up HeyGen Live Avatar integration in the demo Next.js application.

## Prerequisites

You will need a HeyGen account with API access. Get your API key from [HeyGen Settings](https://app.heygen.com/settings/api).

## Environment Variables

The HeyGen integration requires the following server-side environment variables:

### Required
- **`HEYGEN_API_KEY`** (required): Your HeyGen API key for authentication

### Optional
- **`HEYGEN_AVATAR_ID`** (optional): Default avatar ID to use if not specified in component props

⚠️ **Security Note**: These are server-only environment variables. Never expose your API key in client-side code or commit it to version control.

## Setup Instructions

### Local Development

1. Copy the example environment file in the `apps/demo` directory:
   ```bash
   cp apps/demo/.env.example apps/demo/.env.local
   ```

2. Edit `apps/demo/.env.local` and add your HeyGen credentials:
   ```env
   HEYGEN_API_KEY=your_actual_api_key_here
   HEYGEN_AVATAR_ID=your_avatar_id_here  # optional
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### GitHub Actions (for CI/CD)

To add secrets for GitHub Actions workflows:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:
   - **Name**: `HEYGEN_API_KEY`
   - **Value**: Your HeyGen API key
   - Click **Add secret**
5. Optionally, add `HEYGEN_AVATAR_ID`:
   - **Name**: `HEYGEN_AVATAR_ID`
   - **Value**: Your avatar ID
   - Click **Add secret**

**Confirmation phrase**: After adding secrets to GitHub, reply with: **"Secrets added to GitHub repo"**

### Vercel Deployment

To deploy to Vercel with HeyGen integration:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add the following variables:
   - **Name**: `HEYGEN_API_KEY`
   - **Value**: Your HeyGen API key
   - **Environment**: Select **Production** and **Preview** (and **Development** if needed)
   - Check **Encrypted** to mark as sensitive
   - Click **Save**
4. Optionally, add `HEYGEN_AVATAR_ID`:
   - **Name**: `HEYGEN_AVATAR_ID`
   - **Value**: Your avatar ID
   - **Environment**: Select **Production** and **Preview** (and **Development** if needed)
   - Click **Save**

5. Redeploy your application to apply the new environment variables

**Confirmation phrase**: After adding secrets to Vercel, reply with: **"Secrets added to Vercel"**

If you've added secrets to both platforms, reply with: **"I added secrets to both"**

If you need more guidance, reply with: **"I will add them, tell me how"**

## Using the Component

Once the environment variables are configured, you can use the `HeygenLiveAvatar` component in your Next.js pages:

```tsx
import { HeygenLiveAvatar } from "@/components/HeygenLiveAvatar";

export default function MyPage() {
  return (
    <div className="w-full h-screen">
      <HeygenLiveAvatar 
        avatarId="optional-avatar-id"  // Optional: override default
        className="w-full h-full"
      />
    </div>
  );
}
```

### Component Props

- **`avatarId`** (optional): Override the default avatar ID for this instance
- **`className`** (optional): CSS classes to apply to the container

## Verification

After deploying with the correct environment variables:

1. Navigate to the demo page that includes the HeyGen Live Avatar component
2. The avatar should load and initialize successfully
3. Check the browser console for any error messages

### Troubleshooting

If the avatar fails to load, collect the following information for debugging:

1. **Browser Console Errors**: Open browser DevTools (F12) → Console tab
   - Look for error messages related to HeyGen or token fetching
   - Copy any error stack traces

2. **API Response**: In the Network tab, find the request to `/api/heygen/token`
   - Check the response status code
   - View the response body
   - Note any error messages

3. **Server Logs**: Check your server logs (Vercel deployment logs or local terminal)
   - Look for errors from the `/api/heygen/token` endpoint
   - Check for authentication or API errors from HeyGen

Common issues:
- **"HEYGEN_API_KEY not configured"**: The environment variable is not set correctly
- **"Failed to retrieve token from HeyGen API"**: API key may be invalid or expired
- **"Failed to load HeyGen SDK"**: Network issue or SDK loading problem

## Architecture

The integration works as follows:

1. The `HeygenLiveAvatar` component mounts on the page
2. It POSTs to `/api/heygen/token` with optional `avatarId`
3. The API route authenticates with HeyGen using `HEYGEN_API_KEY`
4. HeyGen returns a short-lived session token
5. The component uses this token to initialize the HeyGen SDK
6. The SDK loads either from npm package `@heygen/liveavatar-web-sdk` or falls back to CDN
7. The avatar renders in the container

## Security Best Practices

- ✅ API keys are stored as server-side environment variables only
- ✅ The token endpoint (`/api/heygen/token`) never exposes the API key to clients
- ✅ Tokens are short-lived and generated per session
- ✅ Error messages do not leak sensitive information
- ✅ Environment variables are marked as encrypted in Vercel
- ✅ `.env.example` contains only placeholder values

## Support

For issues specific to the HeyGen API or SDK:
- [HeyGen Documentation](https://docs.heygen.com)
- [HeyGen Support](https://help.heygen.com)

For issues with this integration:
- Check the troubleshooting section above
- Review error logs and console messages
- Ensure environment variables are correctly configured
