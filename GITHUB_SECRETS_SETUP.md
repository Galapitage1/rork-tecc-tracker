# 🔐 GitHub Secrets Setup for Environment Variables

## Problem Solved
Your sync wasn't working because the builds didn't have the `EXPO_PUBLIC_FILE_SYNC_URL` configured. Now it will be baked into every GitHub build!

---

## 📋 Step-by-Step: Add Secrets to GitHub

### Step 1: Go to Your Repository Settings

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`
2. Click **"Settings"** tab (top right)
3. In the left sidebar, click **"Secrets and variables"** → **"Actions"**

### Step 2: Add Your Secrets

Click the **"New repository secret"** button for each of these:

#### Secret 1: EXPO_PUBLIC_FILE_SYNC_URL
- **Name**: `EXPO_PUBLIC_FILE_SYNC_URL`
- **Value**: `https://tracker.tecclk.com/Tracker/api`
- Click **"Add secret"**

#### Secret 2: EXPO_PUBLIC_RORK_API_BASE_URL
- **Name**: `EXPO_PUBLIC_RORK_API_BASE_URL`
- **Value**: `https://tracker.tecclk.com`
- Click **"Add secret"**

#### Secret 3 (Optional): EXPO_PUBLIC_JSONBIN_KEY
- **Name**: `EXPO_PUBLIC_JSONBIN_KEY`
- **Value**: Leave empty unless you're using JSONBin
- Click **"Add secret"**

---

## 🚀 How to Build with Environment Variables

### Option 1: Automatic Build (When You Push Code)
Every time you push code to GitHub, it will **automatically build** with your secrets!

```bash
git add .
git commit -m "Update app"
git push
```

### Option 2: Manual Build (On Demand)
1. Go to your repository on GitHub
2. Click **"Actions"** tab
3. Click **"Build and Package App"** workflow
4. Click **"Run workflow"** dropdown
5. Click the green **"Run workflow"** button
6. Wait 3-5 minutes

### Option 3: Build Locally and Upload
If you want to build on your iMac:

```bash
# Create .env file with your settings
echo "EXPO_PUBLIC_FILE_SYNC_URL=https://tracker.tecclk.com/Tracker/api" > .env
echo "EXPO_PUBLIC_RORK_API_BASE_URL=https://tracker.tecclk.com" >> .env

# Build
bun run package

# Upload tracker-app.zip to your server via FTP
```

---

## 📥 Download Your Build from GitHub

1. After the build finishes (green checkmark ✅):
2. Go to **Actions** tab
3. Click the latest build
4. Scroll to **"Artifacts"** section at the bottom
5. Download **"deployment-package"**
6. Extract the ZIP file
7. Upload ALL files to your server at `/domains/tracker.tecclk.com/public_html/`

---

## ✅ Verify It's Working

### After Uploading to Server:

1. Open your app: `https://tracker.tecclk.com`
2. Press **F12** to open browser console
3. Type: `window.EXPO_FILE_SYNC_URL`
4. Expected output: `"https://tracker.tecclk.com/Tracker/api"`

If you see the URL, **environment variables are working!** ✅

### Test Sync:

#### On OLD device (with data):
1. Go to **Settings**
2. Press **"Override Data"** button
3. Check console - should show:
   ```
   [OVERRIDE SYNC] products: Uploading to server...
   [OVERRIDE SYNC] products: ✓ SUCCESS
   Override sync complete - Success: 4 Failed: 0
   ```

#### On NEW device (empty):
1. Go to **Settings**
2. Press **"Sync Now"** button
3. Check console - should show:
   ```
   [INSTANT SYNC] products: Got X items from server
   [INSTANT SYNC] products: Success
   ```
4. Your data should appear! 🎉

---

## 🔄 Update Secrets Later

If you need to change your sync URL:

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click the secret you want to update (e.g., `EXPO_PUBLIC_FILE_SYNC_URL`)
3. Click **"Update secret"**
4. Enter new value
5. Click **"Update secret"**
6. Trigger a new build (push code or manual workflow)

---

## 🆘 Troubleshooting

### "No JSONBIN key configured" in console
✅ **This is OK!** The message appears because you're using FILE_SYNC_URL instead of JSONBin. As long as you also see upload/download messages, sync is working.

### Secrets not working in build
1. Make sure secret names are **EXACTLY** as shown (all caps, with underscores)
2. Wait 1-2 minutes after adding secrets before building
3. Re-run the workflow

### Build fails on GitHub
1. Go to **Actions** tab
2. Click the failed build (red X)
3. Check error messages
4. Usually means missing dependencies or syntax errors in code

### Override button does nothing
1. Check browser console for errors
2. Verify `window.EXPO_FILE_SYNC_URL` is set (should not be undefined)
3. Check that `https://tracker.tecclk.com/Tracker/api/sync.php` exists on your server

---

## 🎯 Summary

You've now:
- ✅ Added GitHub Secrets for environment variables
- ✅ Configured automatic builds with secrets baked in
- ✅ Can download builds from GitHub that work immediately
- ✅ No more "No sync configured" errors
- ✅ Data will sync between devices!

Every build from now on will include your sync URL! 🚀
