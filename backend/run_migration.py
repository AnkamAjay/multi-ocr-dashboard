"""
One-time migration script: adds the 3 new columns to the existing 'documents' table.

SQLAlchemy's create_all() only creates tables that don't exist yet — it does NOT
add new columns to existing tables. Run this script ONCE to patch the live DB.

Usage:
    cd backend
    python run_migration.py

Safe to run multiple times — uses "IF NOT EXISTS"-style error handling.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "ocr_database.db")


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def run():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    migrations = [
        ("documents", "file_hash",      "ALTER TABLE documents ADD COLUMN file_hash VARCHAR"),
        ("documents", "corrected_json", "ALTER TABLE documents ADD COLUMN corrected_json JSON"),
        ("documents", "is_corrected",   "ALTER TABLE documents ADD COLUMN is_corrected BOOLEAN DEFAULT 0"),
    ]

    for table, col, sql in migrations:
        if column_exists(cursor, table, col):
            print(f"  [OK] Column '{table}.{col}' already exists -- skipping.")
        else:
            cursor.execute(sql)
            print(f"  [ADDED] Column '{table}.{col}'.")

    conn.commit()
    conn.close()
    print("\nMigration complete. You can now delete this file.")


if __name__ == "__main__":
    run()
