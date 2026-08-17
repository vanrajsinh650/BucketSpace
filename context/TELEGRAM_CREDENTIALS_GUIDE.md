# How to Get Telegram API ID & API Hash (Step-by-Step Guide)

This guide shows you how to get your **Telegram `api_id` and `api_hash`** in under **60 seconds** directly from the official Telegram portal.

You only need to do this **once** for the entire project.

---

## 1. Official Telegram Developer Portal

1. Open your browser and navigate to:
   👉 **[https://my.telegram.org](https://my.telegram.org)**

---

## 2. Step-by-Step Walkthrough

### Step 1: Log In
* Enter your **Phone number** in international format (e.g. `+919876543210`, `+12025550123`).
* Click **Next**.
* Telegram will instantly send a **Confirmation code** to your official Telegram app.
* Copy the confirmation code from your Telegram chat, paste it into the website, and click **Sign In**.

---

### Step 2: Open API Development Tools
* After logging in, you will see three options:
  1. *API development tools*  👈 **(Click this one)**
  2. *Delete account*
  3. *Log out*

---

### Step 3: Create Your Application
* Fill in the simple form (it takes 5 seconds):
  * **App title**: `BucketSpace`
  * **Short name**: `bucketspace`
  * **URL**: (Leave empty or put `http://localhost:3000`)
  * **Platform**: Choose `Desktop` or `Web`
  * **Description**: (Leave empty or put `Personal cloud storage`)
* Click **Create application**.

---

### Step 4: Copy Your Credentials
* You will immediately see your keys:
  * **`App api_id`**: An 8-digit number (e.g., `28194820`)
  * **`App api_hash`**: A 32-character text string (e.g., `a1b2c3d4e5f60718293a4b5c6d7e8f90`)

---

## 3. Save to Your `.env` File

Open `.env` in the root of the BucketSpace project and add:

```bash
TELEGRAM_API_ID="28194820"
TELEGRAM_API_HASH="a1b2c3d4e5f60718293a4b5c6d7e8f90"
```

Once saved in `.env`, the entire BucketSpace backend will automatically use these credentials for all user phone logins, and you will never need to enter or look for them again!
