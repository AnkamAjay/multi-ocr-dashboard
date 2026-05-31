import sqlite3

def migrate():
    conn = sqlite3.connect("ocr_database.db")
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE annotation_summary ADD COLUMN source_file_type VARCHAR DEFAULT 'IMAGE'")
        cursor.execute("ALTER TABLE annotation_summary ADD COLUMN total_pages INTEGER DEFAULT 1")
        print("Added columns to annotation_summary")
    except Exception as e:
        print(f"Error on annotation_summary: {e}")

    try:
        cursor.execute("ALTER TABLE page_corrections ADD COLUMN source_file_type VARCHAR DEFAULT 'IMAGE'")
        cursor.execute("ALTER TABLE page_corrections ADD COLUMN total_pages INTEGER DEFAULT 1")
        print("Added columns to page_corrections")
    except Exception as e:
        print(f"Error on page_corrections: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
