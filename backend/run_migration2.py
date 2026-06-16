import sqlite3

def run_migration():
    conn = sqlite3.connect("ocr_database.db")
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE documents ADD COLUMN status VARCHAR DEFAULT 'PENDING'")
        conn.commit()
        print("Successfully added status column to documents table.")
    except sqlite3.OperationalError as e:
        print(f"Migration error (might already exist): {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
