"""Google Sheets integration for job roles."""
import os
import json
import time
import gspread
from google.oauth2.service_account import Credentials

# Global client and cache
gsheets_client = None
job_roles_cache = None
job_roles_cache_time = 0
JOB_ROLES_CACHE_DURATION = 300  # 5 minutes


def init_google_sheets():
    """Initialize Google Sheets client."""
    global gsheets_client

    creds_json = os.environ.get('GOOGLE_SHEETS_CREDENTIALS')
    if not creds_json:
        print("Google Sheets credentials not configured")
        return None

    try:
        creds_dict = json.loads(creds_json)
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ]
        credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        gsheets_client = gspread.authorize(credentials)
        print("Google Sheets client initialized")
        return gsheets_client
    except Exception as e:
        print(f"Error initializing Google Sheets: {e}")
        return None


def get_job_roles_from_sheets() -> str:
    """Fetch job roles from Google Sheets with caching."""
    global job_roles_cache, job_roles_cache_time, gsheets_client

    current_time = time.time()

    # Return cached data if still valid
    if job_roles_cache and (current_time - job_roles_cache_time) < JOB_ROLES_CACHE_DURATION:
        return job_roles_cache

    if not gsheets_client:
        print("Warning: Google Sheets not configured, using default job roles")
        return "No specific job roles configured. Screen the resume generally."

    try:
        spreadsheet_id = os.environ.get('GOOGLE_SHEETS_ID')
        if not spreadsheet_id:
            print("Warning: GOOGLE_SHEETS_ID not set")
            return "No specific job roles configured."

        sheet = gsheets_client.open_by_key(spreadsheet_id).sheet1
        records = sheet.get_all_records()

        job_roles_text = ""
        for row in records:
            job_title = row.get('Job Title', '')
            requirements = row.get('Requirements', '')
            scoring = row.get('Scoring Guide', '')
            if job_title:
                job_roles_text += f"\n\nJOB: {job_title}\nRequirements: {requirements}\nScoring: {scoring}"

        job_roles_cache = job_roles_text
        job_roles_cache_time = current_time
        print(f"Fetched {len(records)} job roles from Google Sheets")
        return job_roles_text

    except Exception as e:
        print(f"Error fetching job roles from Google Sheets: {e}")
        return job_roles_cache or "No specific job roles configured."
