#!/usr/bin/env python3
"""
Cleanup script to delete unwanted jobs from the knowledgebase.

Usage:
  python3 cleanup_jobs.py --delete barista event_crew promoter admin customer_service phone_researcher
  python3 cleanup_jobs.py --list  # List all jobs
  python3 cleanup_jobs.py --delete-all  # Delete ALL jobs (dangerous!)
"""

import asyncio
import sys
import argparse
from shared.database import get_supabase

async def list_jobs():
    """List all jobs in the database."""
    client = get_supabase()

    try:
        result = client.table("knowledgebase").select(
            "key, value, is_active, created_at"
        ).eq("category", "role").order("created_at", desc=False).execute()

        if not result.data:
            print("\n✅ No jobs found in database.")
            return []

        print(f"\n📋 Found {len(result.data)} jobs in database:\n")

        jobs = []
        for idx, job in enumerate(result.data, 1):
            key = job["key"]
            title = job["value"].get("title", "No title")
            is_active = job["is_active"]
            created = job["created_at"][:10]  # Just the date

            status = "✅ ACTIVE" if is_active else "❌ INACTIVE"
            print(f"{idx}. {status} | {key:25s} | {title:40s} | Created: {created}")
            jobs.append(key)

        return jobs

    except Exception as e:
        print(f"\n❌ Error listing jobs: {e}")
        return []


async def delete_jobs(job_keys: list):
    """Delete specific jobs from the database."""
    client = get_supabase()

    print(f"\n🗑️  Deleting {len(job_keys)} jobs...")

    deleted_count = 0
    failed = []

    for key in job_keys:
        try:
            result = client.table("knowledgebase").delete().eq(
                "category", "role"
            ).eq("key", key).execute()

            if result.data:
                print(f"  ✓ Deleted: {key}")
                deleted_count += 1
            else:
                print(f"  ⚠️  Not found: {key}")
                failed.append(key)

        except Exception as e:
            print(f"  ❌ Error deleting {key}: {e}")
            failed.append(key)

    print(f"\n✅ Successfully deleted {deleted_count} jobs")
    if failed:
        print(f"⚠️  Failed to delete: {', '.join(failed)}")

    return deleted_count


async def delete_all_jobs():
    """Delete ALL jobs from the database (dangerous!)."""
    jobs = await list_jobs()

    if not jobs:
        return 0

    print("\n⚠️  WARNING: This will delete ALL jobs from the database!")
    confirm = input("Type 'DELETE ALL' to confirm: ")

    if confirm != "DELETE ALL":
        print("Cancelled.")
        return 0

    return await delete_jobs(jobs)


async def main():
    parser = argparse.ArgumentParser(
        description="Cleanup unwanted jobs from the knowledgebase"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all jobs in the database"
    )
    parser.add_argument(
        "--delete",
        nargs="+",
        metavar="JOB_KEY",
        help="Delete specific jobs by key (e.g., barista event_crew)"
    )
    parser.add_argument(
        "--delete-all",
        action="store_true",
        help="Delete ALL jobs (requires confirmation)"
    )

    args = parser.parse_args()

    # Default to listing if no action specified
    if not any([args.list, args.delete, args.delete_all]):
        await list_jobs()
        print("\nUsage:")
        print("  --list                    List all jobs")
        print("  --delete JOB_KEY ...      Delete specific jobs")
        print("  --delete-all              Delete all jobs (dangerous!)")
        return

    if args.list:
        await list_jobs()

    if args.delete:
        print(f"\n🎯 You want to delete: {', '.join(args.delete)}")
        confirm = input("Proceed? (y/n): ")
        if confirm.lower() == 'y':
            await delete_jobs(args.delete)
        else:
            print("Cancelled.")

    if args.delete_all:
        await delete_all_jobs()


if __name__ == "__main__":
    asyncio.run(main())
