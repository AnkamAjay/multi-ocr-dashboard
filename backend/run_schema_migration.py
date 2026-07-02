import sqlite3
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "ocr_database.db")
# Strip sqlite:/// if present
if DATABASE_URL.startswith("sqlite:///./"):
    db_path = DATABASE_URL.replace("sqlite:///./", "")
elif DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
else:
    db_path = DATABASE_URL

def column_exists(cursor, table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]
    return column_name in columns

def index_exists(cursor, index_name):
    cursor.execute(f"PRAGMA index_list('documents')")
    indexes = [idx[1] for idx in cursor.fetchall()]
    return index_name in indexes

def migrate():
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables_to_update = [
        ("documents", True),           # (table_name, should_index)
        ("annotation_summary", False),
        ("page_corrections", False),
        ("annotation_logs", False)
    ]

    try:
        for table_name, should_index in tables_to_update:
            # Check if table exists first
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not cursor.fetchone():
                print(f"Table '{table_name}' does not exist. Skipping.")
                continue

            # Check and add user_id column
            if not column_exists(cursor, table_name, "user_id"):
                print(f"Adding 'user_id' column to '{table_name}'...")
                # Note: SQLite supports adding a column with a FOREIGN KEY constraint via ALTER TABLE.
                # However, the constraint is only strictly enforced for new rows if PRAGMA foreign_keys = ON is active.
                # Because the new column is nullable (has no DEFAULT other than NULL), it is perfectly valid
                # and doesn't violate existing data, making this a safe, non-destructive operation.
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN user_id INTEGER REFERENCES users(id)")
                print(f"Successfully added 'user_id' to '{table_name}'.")
            else:
                print(f"Column 'user_id' already exists in '{table_name}'.")

            # Create index if needed
            if should_index:
                idx_name = f"ix_{table_name}_user_id"
                # For sqlite_master index check
                cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name=?", (idx_name,))
                if not cursor.fetchone():
                    print(f"Creating index '{idx_name}'...")
                    cursor.execute(f"CREATE INDEX {idx_name} ON {table_name} (user_id)")
                    print(f"Successfully created index '{idx_name}'.")
                else:
                    print(f"Index '{idx_name}' already exists.")

        conn.commit()
        print("\nMigration completed successfully!")
        
    except sqlite3.OperationalError as e:
        print(f"\nMigration failed with an operational error: {e}")
        conn.rollback()
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
