# Cleanup Unwanted Seeded Jobs

After running `/seed_kb` in Telegram, default jobs were added to your database. This guide helps you remove them.

## Option 1: Use the Cleanup Script (Recommended)

```bash
cd telegram-bot

# List all jobs in the database
python3 cleanup_jobs.py --list

# Delete specific unwanted jobs
python3 cleanup_jobs.py --delete event_crew promoter barista admin customer_service phone_researcher

# Delete ALL jobs (use with caution!)
python3 cleanup_jobs.py --delete-all
```

## Option 2: Delete from CRM UI

1. Go to your CRM → Bot Config → Job Posts tab
2. Click the trash icon next to each unwanted job
3. The job will be deleted from the database

## Option 3: SQL Query (Direct Database Access)

If you have access to your Supabase dashboard:

```sql
-- List all jobs
SELECT key, value->>'title' as title, is_active
FROM knowledgebase
WHERE category = 'role'
ORDER BY created_at;

-- Delete specific jobs
DELETE FROM knowledgebase
WHERE category = 'role'
AND key IN ('event_crew', 'promoter', 'barista', 'admin', 'customer_service', 'phone_researcher');

-- Or delete ALL jobs
DELETE FROM knowledgebase WHERE category = 'role';
```

## After Cleanup

The bot automatically refreshes its knowledgebase every 5 minutes. If you want immediate effect:

1. Restart your bot deployment, OR
2. Wait 5 minutes for the auto-refresh

## Verification

Check the bot removed the jobs:

```bash
# Should show only your active jobs
python3 cleanup_jobs.py --list
```

## Preventing Future Issues

To avoid accidentally seeding defaults again:
- Don't run `/seed_kb` command in Telegram
- Use the CRM UI to manage all job posts

## Need Help?

If the CRM delete button isn't working:
1. Check the browser console for errors
2. Verify Supabase connection in CRM settings
3. Try the cleanup script or SQL query directly
