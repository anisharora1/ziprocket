# ZipRocket Push Notification Backend

Stage 2 implementation of the push notification infrastructure in `server/`.

## 1. Environment Configuration

The push notification service relies on Firebase Cloud Messaging (FCM) via Firebase Admin SDK. It reuses existing Firebase credentials in `.env`:

```env
FIREBASE_PROJECT_ID=ziprocket01
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ziprocket01.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Troubleshooting FCM Errors:**
> If sending fails with a permission or `"entity not found"` error (e.g. `messaging/third-party-auth-error` or `PERMISSION_DENIED`):
> 1. Open the [Google Cloud Console](https://console.cloud.google.com/) for project **`ziprocket01`**.
> 2. Enable the **Firebase Cloud Messaging API** (v1).
> 3. Verify that the service account (`FIREBASE_CLIENT_EMAIL`) has the **Firebase Cloud Messaging API Admin** or **Firebase Admin SDK Administrator Service Agent** IAM role.

---

## 2. Platform Settings Extension

`PlatformSettings.notificationSettings` controls segment rules, rate caps, and quiet hours:

| Parameter | Default | Description |
|---|---|---|
| `maxPromoPerDay` | `2` | Maximum promotional push notifications allowed per device per Indian day (Asia/Kolkata). |
| `quietHoursStart` | `"22:00"` | Start of quiet hours in 24h `HH:MM` format (Asia/Kolkata). |
| `quietHoursEnd` | `"08:00"` | End of quiet hours in 24h `HH:MM` format (Asia/Kolkata). |
| `inactiveDays` | `14` | Days since last delivered order to consider a customer "inactive". |
| `newUserDays` | `7` | Account age in days to consider a user "new" with 0 orders. |
| `regularMinOrders30d` | `4` | Delivered orders in past 30 days required for "regular" segment. |
| `foodLoverMinOrders60d` | `2` | Minimum food orders in past 60 days for "food_lovers" segment. |
| `foodLoverSharePct` | `60` | Minimum % share of food orders in past 60 days. |

---

## 3. Endpoints

### Customer Endpoints (`/api/notifications`)

- **`POST /register-device`**:
  - Optional auth (`optionalAuth` middleware). If a valid Bearer token is present, links the device token to that `User`. Otherwise, registers as guest (`user: null`).
  - Upserts `DeviceToken`: `token`, `platform`, `zoneId`, `lastLocation` (`{ lat, lng }`), `appVersion`, `lastSeenAt`.
  - Rate limited with `notificationLimiter`.
- **`POST /unlink-user`**:
  - Sets `user = null` for the given `{ token }`. Called on user logout.
- **`PUT /preferences`** (`protect`):
  - Updates `{ marketingOptIn: boolean }` across all device tokens owned by the authenticated user.
- **`POST /opened`**:
  - Body: `{ campaignId, token? }`.
  - Atomically increments `stats.opened` on the campaign (deduplicated per device token using `openedTokens`).

### Admin Endpoints (`/api/admin/notifications`)
Protected by `protect`, `authorize("admin")`, and `adminLimiter`.

- **`GET /segments?zoneIds=&radiusLat=&radiusLng=&radiusKm=`**:
  - Returns audience counts (`{ targeted, skippedCap, skippedQuiet }`) for all segments to populate dashboard cards.
- **`POST /audience-preview`**:
  - Body: `{ segment, zoneIds, radius }`.
  - Previews potential reach and skips for a custom audience configuration.
- **`POST /send-test`**:
  - Body: `{ title, body, imageUrl?, route }`.
  - Sends a test notification exclusively to the authenticated admin's registered devices (bypassing caps and segments).
- **`POST /campaigns`**:
  - Body: `{ title, body, imageUrl?, route, segment, zoneIds?, radius?, scheduledAt?, overrideQuietHours? }`.
  - Validates `title` (1-65 chars), `body` (1-180 chars), `imageUrl` (optional HTTPS only), and `route`.
  - Allowed routes:
    - `/(tabs)/home`, `/(tabs)/orders`, `/(tabs)/search`, `/grocery`, `/cart`, `/addresses`
    - `/restaurants/<valid ObjectId>`
    - `/grocery/category/<name>`
  - If no `scheduledAt`: Checks quiet hours. If within quiet hours without `overrideQuietHours`, returns 400. Otherwise, creates campaign and dispatches immediately in background (responds 202).
  - If `scheduledAt` is provided: If scheduled time falls inside quiet hours, shifts forward to `quietHoursEnd` (08:00 IST).
- **`GET /campaigns?page=&limit=`**:
  - Paginated history of campaigns with delivery stats (`targeted`, `sent`, `failed`, `skippedCap`, `skippedQuiet`, `opened`).
- **`POST /campaigns/:id/cancel`**:
  - Cancels a campaign whose status is currently `"scheduled"`.

---

## 4. Audience Segmentation & Caps

- **Base Audience**: `DeviceToken` with `marketingOptIn: true`, `lastSeenAt` within the last 60 days, and either guest (`user == null`) or registered customer (`user.role === 'customer'` and `!user.isBlocked`).
- **Location Filters**:
  - `zoneIds`: Matches tokens registered to specific delivery zones.
  - `radius`: Bounding-box prefilter on coordinates + in-code Haversine formula calculation.
- **Order Aggregation**:
  Delivered orders (`orderStatus: "delivered"`) are evaluated in a single aggregation pipeline using the `{ user: 1, orderStatus: 1 }` index to compute order counts and timestamps.
- **Daily Cap**:
  Device tokens that have reached `maxPromoPerDay` for the current Asia/Kolkata date string (`YYYY-MM-DD`) are excluded from sending and counted under `stats.skippedCap`.

---

## 5. FCM Multicast & Token Maintenance

- FCM messages are sent via `admin.messaging().sendEachForMulticast` in batches of up to 500 tokens.
- Android configuration:
  - Priority: `"high"`
  - Channel: `"promotions_high"` (default notification channel configured on mobile app)
  - TTL: 4 hours
  - Sound: `"default"`
- Token maintenance:
  - Tokens failing with `messaging/registration-token-not-registered` or `messaging/invalid-registration-token` are automatically deleted from the database.
  - Device tokens are masked in all logs (e.g. `fK39xLa8...`).

---

## 6. Scheduled Job

- Cron scheduler initialized in `src/jobs/notificationJob.ts` and started from `server.ts` alongside `startSettlementJob()`.
- Runs every minute (`* * * * *`).
- Uses atomic MongoDB claiming:
  ```ts
  NotificationCampaign.findOneAndUpdate(
    { _id: candidate._id, status: "scheduled" },
    { $set: { status: "sending" } },
    { new: true }
  )
  ```
  Guarantees that a process restart or multiple clustered instances will never send duplicate push notifications.
