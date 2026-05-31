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
        ("annotation_summary", "user_id", "ALTER TABLE annotation_summary ADD COLUMN user_id INTEGER REFERENCES users(id)"),
        ("page_corrections", "user_id", "ALTER TABLE page_corrections ADD COLUMN user_id INTEGER REFERENCES users(id)"),
        ("annotation_logs", "user_id", "ALTER TABLE annotation_logs ADD COLUMN user_id INTEGER REFERENCES users(id)"),
    ]

    for table, col, sql in migrations:
        if column_exists(cursor, table, col):
            print(f"  [OK] Column '{table}.{col}' already exists -- skipping.")
        else:
            try:
                cursor.execute(sql)
                print(f"  [ADDED] Column '{table}.{col}'.")
            except Exception as e:
                print(f"  [ERROR] Failed to add column '{table}.{col}': {e}")

    conn.commit()
    conn.close()
    print("\nAuth migration complete.")

if __name__ == "__main__":
    run()
