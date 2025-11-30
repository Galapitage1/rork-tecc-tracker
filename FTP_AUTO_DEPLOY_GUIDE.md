# 🚀 Automatic FTP Deployment Guide

## Overview

This guide shows you how to connect GitHub builds directly to your FTP server (like FileZilla), so your app automatically deploys whenever you push code!

**No more manual downloads and uploads!** 🎉

---

## How It Works

```
Push Code to GitHub → GitHub Builds Your App → Automatically Uploads via FTP → Live on Your Server
```

Instead of:
1. ~~Push code~~
2. ~~Wait for build~~
3. ~~Download ZIP~~
4. ~~Open FileZilla~~
5. ~~Upload files manually~~

Now it's just:
1. Push code → **Done!** Your app is live automatically.

---

## 📋 Step-by-Step Setup

### Step 1: Get Your FTP Credentials

You need the same credentials you use in FileZilla:

| Setting | Description | Example |
|---------|-------------|---------|
| **FTP Server** | Your server hostname or IP | `sg-shared01-da.pvtwebs.com` or `160.30.208.11` |
| **FTP Username** | Your FTP login username | `tecclkc1` |
| **FTP Password** | Your FTP login password | `your_password_here` |
| **FTP Port** | Usually 21 for FTP | `21` |
| **Server Directory** | Where to upload files | `/domains/tracker.tecclk.com/public_html/` |

💡 **Tip**: These are the same settings you use when connecting with FileZilla!

---

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** (tab at the top)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **"New repository secret"** for each of these:

#### Required Secrets

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `FTP_SERVER` | `sg-shared01-da.pvtwebs.com` | Your FTP server address |
| `FTP_USERNAME` | `tecclkc1` | Your FTP username |
| `FTP_PASSWORD` | `your_password` | Your FTP password |
| `FTP_PORT` | `21` | FTP port (usually 21) |
| `FTP_SERVER_DIR` | `/domains/tracker.tecclk.com/public_html/` | Directory on server |

⚠️ **Important**: Secret names must be EXACTLY as shown (uppercase with underscores)

---

### Step 3: Enable Auto-Deploy

**Option A: Enable Automatic Deployment on Every Push**

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click the **"Variables"** tab
3. Click **"New repository variable"**
4. Add:
   - **Name**: `FTP_AUTO_DEPLOY`
   - **Value**: `true`
5. Click **Add variable**

Now every push to main/master will automatically deploy!

**Option B: Manual Deploy Only**

If you prefer to control when deploys happen:
1. Leave `FTP_AUTO_DEPLOY` variable unset (or set to `false`)
2. Deploy manually when ready (see next section)

---

### Step 4: Trigger a Deployment

**Automatic (when auto-deploy is enabled):**
```bash
git add .
git commit -m "Update app"
git push
```
Wait 3-5 minutes → Your app is live!

**Manual Deploy:**
1. Go to **Actions** tab in your repository
2. Click **"Build and Package App"** workflow
3. Click **"Run workflow"** dropdown
4. Set **"Deploy to FTP server after build"** to `true`
5. Click the green **"Run workflow"** button
6. Wait for completion

---

## ✅ Verify Deployment

After the workflow completes:

1. Check the **Actions** tab - you should see a green checkmark ✓
2. Open your website in an incognito browser window
3. You should see your latest changes!

If using `https://tracker.tecclk.com`:
- Clear browser cache or use incognito mode
- Check that files were uploaded correctly

---

## 🔧 Advanced Settings

### Exclude Files from Upload

The workflow automatically excludes:
- `.git` folders
- `node_modules`

### Preserve Server Data

The deployment is designed to preserve your existing data:
- The `Tracker/data/` folder is **not included** in the deployment
- Existing files on the server that aren't in your new build are **kept** (using `dangerous-clean-slate: false`)
- Your user data and sync files remain intact between deployments

**Note**: Make sure the `Tracker/data/` directory already exists on your server with proper permissions (777) before your first deployment.

### Custom Server Directory

If your files should go to a different location, update the `FTP_SERVER_DIR` secret:
- For root folder: `/`
- For subdomain: `/domains/yourdomain.com/public_html/`
- For subdirectory: `/public_html/app/`

---

## 🆘 Troubleshooting

### "FTP connection failed"
1. Verify your server address is correct
2. Check if your hosting firewall blocks GitHub IPs
3. Try using IP address instead of hostname in `FTP_SERVER`
4. Ensure port 21 is correct (some hosts use different ports)

### "Permission denied"
1. Check that your FTP user has write permissions
2. Verify the `FTP_SERVER_DIR` path exists and is writable
3. Contact your hosting provider to enable FTP write access

### "Deployment skipped"
1. Make sure `FTP_AUTO_DEPLOY` variable is set to `true`
2. Or run the workflow manually with deploy option set to `true`
3. Verify all FTP secrets are configured

### "Files uploaded but site shows old version"
1. Clear your browser cache (Ctrl+Shift+Delete)
2. Use incognito/private browsing mode
3. Try accessing with `?v=` timestamp: `https://yoursite.com/?v=123`

### "Workflow fails during upload"
1. Check the Actions log for specific error messages
2. Common issues:
   - Server directory doesn't exist
   - Connection timeout (try running again)
   - File permission issues

---

## 🔐 Security Notes

1. **Never commit FTP credentials** to your code - always use GitHub Secrets
2. **Use strong passwords** for your FTP account
3. **Consider SFTP** if your host supports it (more secure)
4. **Limit FTP user permissions** to only the directories needed

---

## 📊 Workflow Summary

Your `build-and-deploy.yml` workflow now:

1. ✅ Builds your Expo web app
2. ✅ Creates deployment package
3. ✅ Uploads artifacts for download
4. ✅ Deploys to FTP server (when enabled)

All in one automated pipeline! 🚀

---

## Quick Reference

| Task | How To |
|------|--------|
| Enable auto-deploy | Set `FTP_AUTO_DEPLOY` variable to `true` |
| Disable auto-deploy | Delete `FTP_AUTO_DEPLOY` variable or set to `false` |
| Manual deploy | Run workflow with deploy option set to `true` |
| Update FTP password | Update `FTP_PASSWORD` secret in Settings |
| Change server directory | Update `FTP_SERVER_DIR` secret |

---

## Next Steps

1. ✅ Set up FTP secrets in GitHub
2. ✅ Enable auto-deploy (optional)
3. ✅ Push a change to test
4. ✅ Verify your site is updated automatically

Your deployment is now fully automated! 🎉
