# Vercel Deployment Fix Guide

## Problem
```
The specified Root Directory "eza-v5/frontend" does not exist. 
Please update your Project Settings.
```

## Solution

### Step 1: Check Your Repository Structure

First, verify where your frontend files are located in your repository:

1. Go to your GitHub repository
2. Check the branch you're deploying (`eza-global` in your case)
3. Look for `package.json` file - that's your frontend root

### Step 2: Update Vercel Project Settings

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **General**
4. Scroll down to **Root Directory** section

### Step 3: Set Correct Root Directory

Based on your repository structure, set one of these:

#### Option A: Frontend at Root Level
If `package.json` is at repository root:
- **Root Directory**: Leave **empty** or set to `/`

#### Option B: Frontend in `frontend/` Folder
If structure is:
```
repository/
  frontend/
    package.json
```
- **Root Directory**: `frontend`

#### Option C: Frontend in `eza-v5/frontend/` Folder
If structure is:
```
repository/
  eza-v5/
    frontend/
      package.json
```
- **Root Directory**: `eza-v5/frontend`

#### Option D: Frontend in Nested Path
If structure is different, find the path to `package.json`:
- **Root Directory**: `path/to/frontend`

### Step 4: Verify Build Settings

After setting Root Directory, verify:

1. **Framework Preset**: Next.js
2. **Build Command**: `npm run build` (or leave default)
3. **Install Command**: `npm ci` (or leave default)
4. **Output Directory**: `.next` (or leave default)

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

## Quick Check Commands

If you have access to your repository locally:

```bash
# Check if frontend exists at root
ls package.json

# Check if frontend exists in eza-v5/frontend
ls eza-v5/frontend/package.json

# Check if frontend exists in frontend folder
ls frontend/package.json
```

## Common Issues

### Issue: "Root Directory does not exist"
**Solution**: The path is incorrect. Check your GitHub repository structure and update Root Directory accordingly.

### Issue: "Build fails after fixing Root Directory"
**Solution**: 
1. Check that `package.json` exists in the Root Directory
2. Verify `npm ci` can install dependencies
3. Check build logs for specific errors

### Issue: "Different branch has different structure"
**Solution**: 
- Each branch can have different structure
- Set Root Directory per branch in Vercel settings
- Or use Vercel's branch-specific configuration

## Next Steps

After fixing the Root Directory:

1. ✅ Verify deployment succeeds
2. ✅ Check that environment variables are set
3. ✅ Test your deployed application
4. ✅ Configure custom domains if needed

## Need Help?

If you're still having issues:

1. Share your repository structure (screenshot of GitHub file tree)
2. Share your Vercel build logs
3. Check Vercel's [Root Directory documentation](https://vercel.com/docs/concepts/projects/project-configuration#root-directory)

