"""Turso DB connection smoke test.

Reads DATABASE_URL and TURSO_AUTH_TOKEN from environment variables (or a
.env file loaded by the caller).  Never hardcode credentials here.

Usage:
    cd backend
    source .venv/bin/activate
    python check_turso.py
"""
import os

import libsql_experimental as libsql
from dotenv import load_dotenv  # installed via python-dotenv

load_dotenv()  # picks up backend/.env in local dev

url = os.environ["DATABASE_URL"]
auth = os.environ["TURSO_AUTH_TOKEN"]

# The driver expects the raw libsql:// URL (not the https:// variant)
conn = libsql.connect(database=url, auth_token=auth)
cursor = conn.cursor()
cursor.execute("SELECT label FROM time_slots")
rows = cursor.fetchall()
print(f"FOUND {len(rows)} ROWS IN TURSO DIRECTLY:")
for r in rows:
    print(r)
