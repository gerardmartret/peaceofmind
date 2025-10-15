# 📧 Marketing Email List - SQL Queries

Quick reference for managing your email marketing list in Supabase.

---

## 🎯 Essential Marketing Queries

### **1. Export All Active Subscribers** ⭐
```sql
SELECT 
  email,
  created_at,
  marketing_consent
FROM users
WHERE unsubscribed = false
  AND marketing_consent = true
ORDER BY created_at DESC;
```
**Use this for:** Mailchimp import, newsletter campaigns

---

### **2. Get Total Subscriber Count**
```sql
SELECT COUNT(*) as total_subscribers
FROM users
WHERE unsubscribed = false;
```

---

### **3. New Subscribers This Week**
```sql
SELECT 
  email,
  created_at
FROM users
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND unsubscribed = false
ORDER BY created_at DESC;
```

---

### **4. New Subscribers This Month**
```sql
SELECT 
  email,
  created_at
FROM users
WHERE created_at >= DATE_TRUNC('month', NOW())
  AND unsubscribed = false
ORDER BY created_at DESC;
```

---

### **5. All Users (Including Unsubscribed)**
```sql
SELECT 
  email,
  created_at,
  unsubscribed,
  marketing_consent
FROM users
ORDER BY created_at DESC;
```

---

## 📊 Analytics Queries

### **6. Growth Rate**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

### **7. Most Active Users (By Trip Count)**
```sql
SELECT 
  u.email,
  COUNT(t.id) as trip_count,
  u.created_at as user_since
FROM users u
LEFT JOIN trips t ON u.email = t.user_email
GROUP BY u.email, u.created_at
ORDER BY trip_count DESC
LIMIT 20;
```

---

### **8. Unsubscribe Rate**
```sql
SELECT 
  COUNT(*) FILTER (WHERE unsubscribed = false) as active_subscribers,
  COUNT(*) FILTER (WHERE unsubscribed = true) as unsubscribed,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE unsubscribed = true)::NUMERIC / COUNT(*)::NUMERIC * 100, 
    2
  ) as unsubscribe_rate_percent
FROM users;
```

---

### **9. User Engagement Levels**
```sql
SELECT 
  CASE 
    WHEN trip_count >= 5 THEN 'Power User'
    WHEN trip_count >= 2 THEN 'Active User'
    WHEN trip_count = 1 THEN 'New User'
    ELSE 'Inactive'
  END as user_type,
  COUNT(*) as count
FROM (
  SELECT u.email, COUNT(t.id) as trip_count
  FROM users u
  LEFT JOIN trips t ON u.email = t.user_email
  GROUP BY u.email
) subquery
GROUP BY user_type
ORDER BY 
  CASE user_type
    WHEN 'Power User' THEN 1
    WHEN 'Active User' THEN 2
    WHEN 'New User' THEN 3
    ELSE 4
  END;
```

---

## 🔄 Management Queries

### **10. Unsubscribe a User**
```sql
UPDATE users
SET 
  unsubscribed = true,
  updated_at = NOW()
WHERE email = 'user@example.com';
```

---

### **11. Resubscribe a User**
```sql
UPDATE users
SET 
  unsubscribed = false,
  updated_at = NOW()
WHERE email = 'user@example.com';
```

---

### **12. Delete User and All Trips (GDPR)**
```sql
-- Delete user's trips first
DELETE FROM trips WHERE user_email = 'user@example.com';

-- Then delete user
DELETE FROM users WHERE email = 'user@example.com';
```

---

## 📈 Dashboard Queries

### **13. Daily Stats Summary**
```sql
SELECT 
  (SELECT COUNT(*) FROM users WHERE unsubscribed = false) as active_subscribers,
  (SELECT COUNT(*) FROM trips) as total_trips,
  (SELECT COUNT(*) FROM trips WHERE created_at::DATE = CURRENT_DATE) as trips_today,
  (SELECT COUNT(*) FROM users WHERE created_at::DATE = CURRENT_DATE) as new_users_today;
```

---

### **14. Popular Locations**
```sql
SELECT 
  jsonb_array_elements(locations) ->> 'name' as location_name,
  COUNT(*) as visit_count
FROM trips
WHERE locations IS NOT NULL
GROUP BY location_name
ORDER BY visit_count DESC
LIMIT 10;
```

---

### **15. Trip Dates Distribution**
```sql
SELECT 
  trip_date,
  COUNT(*) as trips_planned
FROM trips
WHERE trip_date >= CURRENT_DATE
GROUP BY trip_date
ORDER BY trip_date ASC
LIMIT 30;
```

---

## 🔍 Via Supabase Client (TypeScript)

### **Export Email List**
```typescript
// Get all active subscribers
const { data: subscribers } = await supabase
  .from('users')
  .select('email, created_at')
  .eq('unsubscribed', false)
  .eq('marketing_consent', true)
  .order('created_at', { ascending: false });

// Convert to CSV
const csv = subscribers.map(s => `${s.email},${s.created_at}`).join('\n');
```

### **Check If Email Exists**
```typescript
const { data, error } = await supabase
  .from('users')
  .select('email')
  .eq('email', 'user@example.com')
  .single();

const exists = !error && !!data;
```

### **Get User's Trip Count**
```typescript
const { count } = await supabase
  .from('trips')
  .select('*', { count: 'exact', head: true })
  .eq('user_email', 'user@example.com');
```

---

## 📤 Export Formats

### **CSV Export (for Mailchimp/SendGrid)**
```
email,created_at
user1@example.com,2025-10-15T10:30:00Z
user2@example.com,2025-10-15T11:45:00Z
```

### **JSON Export (for APIs)**
```json
[
  {
    "email": "user1@example.com",
    "created_at": "2025-10-15T10:30:00Z",
    "marketing_consent": true,
    "unsubscribed": false
  }
]
```

---

## 🎯 Quick Actions

### **Get Today's Stats**
```sql
SELECT 
  'New Users Today' as metric,
  COUNT(*) as value
FROM users
WHERE created_at::DATE = CURRENT_DATE

UNION ALL

SELECT 
  'New Trips Today',
  COUNT(*)
FROM trips
WHERE created_at::DATE = CURRENT_DATE;
```

---

## 📊 Supabase Dashboard Access

**Your Project:**
https://supabase.com/dashboard/project/wogzaghesjfqamifrrfo

**Quick Links:**
- **Table Editor:** View/edit data manually
- **SQL Editor:** Run custom queries
- **Database:** Manage tables and RLS
- **API Docs:** Auto-generated API documentation

---

## 💡 Pro Tips

1. **Export regularly:** Download email list weekly for backup
2. **Segment users:** Create campaigns based on trip count
3. **Monitor growth:** Track new subscribers daily
4. **Clean data:** Remove unsubscribes from exports
5. **Respect privacy:** Honor unsubscribe requests immediately

---

*Created: October 15, 2025*

