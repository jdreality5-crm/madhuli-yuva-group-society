# 🚂 Railway.app Deployment Guide

## Railway.app pe Society Management System Deploy karna

### Step 1: Railway Account Setup
1. Visit: https://railway.app
2. Sign up with GitHub (free account)
3. Verify email

### Step 2: Railway CLI Install (Optional - ya directly GitHub se link karo)

**Option A: CLI se deploy**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to project
cd D:\society

# Initialize Railway project
railway init

# Deploy
railway up
```

**Option B: GitHub se deploy (Easier)**
1. Create GitHub repository
2. Push code to GitHub
3. Railway dashboard me "New Project" -> "Deploy from GitHub"
4. Select your repository
5. Auto-deploy hoga

### Step 3: Environment Variables Set karo Railway Dashboard me

Railway Dashboard -> Your Project -> Variables tab me add karo:

```
NODE_ENV=production
JWT_SECRET=your-super-secret-key-change-this-in-production-12345
PORT=5000
```

### Step 4: Build Command Configure karo

Railway automatically detect karega `package.json` se.

**Start Command:** `node server.js`

### Step 5: Domain Setup

Railway automatically generate karega:
- `your-app-name.up.railway.app`

Custom domain bhi add kar sakte ho (free plan me bhi)

### Step 6: Verify Deployment

1. Railway dashboard me logs check karo
2. Visit your Railway URL
3. Test login:
   - Organizer: admin@society.com / admin123
   - User: raj@example.com / owner123

---

## 🎯 Quick GitHub Push & Deploy Steps

```bash
# Navigate to project
cd D:\society

# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Society Management System"

# Create GitHub repo and push
# (Create repo on github.com first)
git remote add origin https://github.com/YOUR-USERNAME/society-management.git
git branch -M main
git push -u origin main
```

Then Railway dashboard me:
1. New Project
2. Deploy from GitHub
3. Select `society-management` repo
4. Deploy!

---

## ✅ Post-Deployment Checklist

- [ ] Application running on Railway URL
- [ ] Login working (both organizer and user)
- [ ] Database created (SQLite auto-creates)
- [ ] File uploads working
- [ ] PDF generation working
- [ ] All API endpoints responding
- [ ] Mobile responsive working

---

## 🐛 Troubleshooting

**Build fails:**
- Check Railway logs
- Verify package.json is correct
- Ensure all dependencies listed

**Database not persisting:**
- Railway provides volumes - configure persistent volume for `society.db`
- Settings -> Volumes -> Add volume -> Mount path: `/app/society.db`

**File uploads failing:**
- Add volume for `/app/uploads`

**Environment variables not working:**
- Re-deploy after adding variables
- Check variable names exactly match

---

## 💡 Free Tier Limits (Railway)

- $5 free credit per month
- ~500 hours runtime
- 1GB RAM
- 1GB storage
- Perfect for small societies!

---

## 🔗 Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app
- Support: https://railway.app/help

---

**Your app will be live at: `https://your-project-name.up.railway.app`**
