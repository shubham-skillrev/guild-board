# Email/Password Authentication Setup Guide

## What I've Added to Your Codebase

✅ **Updated Login Page** (`src/app/(auth)/login/page.tsx`)
   - Client component with tab toggle between "Google" and "Email"
   - Email/password form with sign-up and sign-in modes
   - Error handling and loading states

✅ **New API Routes**
   - `POST /api/auth/email-signup` - Register new users with email/password
   - `POST /api/auth/email-login` - Sign in with email/password

## What You Need to Do in Supabase Console

### Step 1: Enable Email/Password Authentication Provider

1. **Visit Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select project: `kubublvifvetwatcyluh`

2. **Navigate to Authentication Settings**
   - Click: Authentication (left sidebar)
   - Click: Providers
   - Find: Email/Password

3. **Enable Email/Password**
   - Toggle: "Enable Email provider"
   - Select sign-up method: **Email/Password** (NOT magic link)
   - Under "Email Confirmations":
     - For development: **Disable** "Confirm email" (or auto-confirm)
     - For production: Enable and set up email delivery
   - Click: Save

### Step 2: Configure Email Provider (Optional but Recommended)

1. **Go to Authentication → Settings**
2. **Scroll to "Email Templates"**
3. Configure email sender:
   - Use Supabase's default sender first (testing)
   - Later switch to SendGrid or your own SMTP

### Step 3: (Important) Add SUPABASE_SERVICE_ROLE_KEY to .env.local

For certain admin features to work, you'll need this key:

1. **Get the Service Role Key**
   - Go to: Settings → API
   - Find: "Service Role Key" (hidden by default)
   - Click to reveal and copy it

2. **Update .env.local**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://kubublvifvetwatcyluh.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=paste_your_service_role_key_here
   ```

3. **Restart the dev server**
   ```bash
   npm run dev
   ```

## Testing Email/Password Auth

Once enabled in Supabase:

1. **Go to login page**
   - http://localhost:3000/login

2. **Click "Email" tab**

3. **Sign Up (if new user)**
   - Enter email: `test@example.com`
   - Password: `password123` (6+ characters)
   - Click "Sign Up"

4. **Sign In (with existing account)**
   - Switch to sign-in mode
   - Enter credentials
   - Click "Sign In"

5. **Expected Behavior**
   - Success: Redirects to home page (/)
   - Error: Shows error message on login page

## Troubleshooting

### Error: "Email provider not enabled"
- Ensure you toggled "Enable Email provider" in Supabase console
- Wait 30 seconds and refresh

### Error: "Invalid request"
- Check that password is at least 6 characters
- Verify email format is valid

### Error: "User already exists"
- Email is already registered
- Try signing in instead

### Red flags
- If you see "Sign up failed" with no details:  
  - Check Supabase console logs (Authentication → Audit Logs)
  - Verify email provider is enabled
  - Check .env.local has correct keys

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Login Page UI | ✅ Complete | Both Google and Email options |
| Email Sign-up API | ✅ Complete | Awaits Supabase config |
| Email Sign-in API | ✅ Complete | Awaits Supabase config |
| Google OAuth | ⚠️ Paused | Still needs OAuth provider setup |
| Database Schema | ⚠️ Not Applied | Still needs SQL migration in Supabase |

## Next Steps

1. **Enable email/password provider** in Supabase console (instructions above)
2. **Add SUPABASE_SERVICE_ROLE_KEY** to .env.local
3. **Test sign-up/sign-in** at http://localhost:3000/login
4. **Once working**, we can proceed to:
   - Apply the database migration (001_initial_schema.sql)
   - Set up Google OAuth properly
   - Build remaining features (Phase 3)

## Questions?

The email/password routes are already deployed in your code. Just need the Supabase configuration to activate them!
