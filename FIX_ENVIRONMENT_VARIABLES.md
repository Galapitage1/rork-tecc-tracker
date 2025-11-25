# Environment Variables Fix for Web Builds

## Problem
The sync is not working because the web build doesn't have the `EXPO_PUBLIC_FILE_SYNC_URL` environment variable. When you build the app, environment variables need to be **baked into the build** at build time.

## Symptoms
- Console shows: `"No sync configured - neither FILE_SYNC_URL nor JSONBIN key"`
- Override sync doesn't upload data to server
- New devices can't download data from server

## Root Cause
The `.env` file is not committed to Git (it's in `.gitignore`), so when you download a build from GitHub or export the app, it doesn't include your environment variables.

## Solutions

### Solution 1: Manual Fix for Current Build (QUICKEST)

1. **Locate your built web app** (usually in a `dist/` or `_expo/` folder)

2. **Find the `index.html` file**

3. **Add this script** BEFORE the closing `</head>` tag:

```html
<script>
  window.EXPO_FILE_SYNC_URL = 'https://tracker.tecclk.com/Tracker/api';
  window.EXPO_PUBLIC_RORK_API_BASE_URL = 'https://tracker.tecclk.com';
  console.log('[ENV CONFIG] Environment variables loaded');
</script>
</head>
```

4. **Re-upload the modified build** to your server

5. **Clear browser cache** and test sync again

---

### Solution 2: Automated Post-Build Script (RECOMMENDED)

I've created a post-build script at `scripts/inject-env.js` that automatically injects environment variables after building.

**To use it:**

1. Make the script executable:
```bash
chmod +x scripts/inject-env.js
```

2. Add it to your build process in `package.json`:
```json
{
  "scripts": {
    "export": "expo export --platform web",
    "export:inject": "expo export --platform web && node scripts/inject-env.js",
    "build-web": "npm run export:inject"
  }
}
```

3. Run the build with env injection:
```bash
npm run build-web
```

---

### Solution 3: Commit Environment Variables to Git (SIMPLE)

**⚠️ Only do this if your environment variables are NOT secrets**

1. Create `.env.production` file (already created):
```
EXPO_PUBLIC_RORK_API_BASE_URL=https://tracker.tecclk.com
EXPO_PUBLIC_FILE_SYNC_URL=https://tracker.tecclk.com/Tracker/api
```

2. Commit it to Git:
```bash
git add .env.production
git commit -m "Add production environment variables"
git push
```

3. Modify your build process to use `.env.production` during builds

---

## Verification

After applying any solution, verify it's working:

1. **Open browser console** (F12)

2. **Type**: 
```javascript
window.EXPO_FILE_SYNC_URL
```

3. **Expected output**: `"https://tracker.tecclk.com/Tracker/api"`

4. **If undefined**, the environment variable wasn't injected correctly

---

## Testing Sync

### On Old Device (with data):
1. Go to Settings
2. Press "Override Data" button
3. **Check console** for:
   - `[OVERRIDE SYNC] product_conversions: Uploading to server...`
   - `[OVERRIDE SYNC] product_conversions: ✓ SUCCESS`
4. Should show "Success: X" message

### On New Device (empty):
1. Go to Settings
2. Press "Sync Now" button
3. **Check console** for:
   - `[INSTANT SYNC] products: Got X items from server`
   - `[INSTANT SYNC] products: Success`
4. Data should appear in the app

---

## Alternative: Use JSONBin Instead

If you don't want to manage your own server sync, you can use JSONBin:

1. Sign up at https://jsonbin.io
2. Get your API key
3. Add to `.env`:
```
EXPO_PUBLIC_JSONBIN_KEY=your_api_key_here
```
4. Rebuild the app

The app will automatically use JSONBin if `EXPO_PUBLIC_JSONBIN_KEY` is set.

---

## Quick Test (Development Mode)

If you're using Expo Go or running locally with `bun start`, the `.env` file should work automatically. The issue only affects **built/exported apps**.

To test locally:
```bash
bun start
```

The environment variables from `.env` will be loaded automatically.

---

## Need Help?

If sync is still not working after trying these solutions:

1. Check the browser console for error messages
2. Verify `window.EXPO_FILE_SYNC_URL` is set (see Verification section)
3. Check that your server at `https://tracker.tecclk.com/Tracker/api` is accessible
4. Try accessing `https://tracker.tecclk.com/Tracker/api/get.php?endpoint=products` in your browser

