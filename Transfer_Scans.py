import pymssql

def connect_to_db():
    server = "cfx-azure-server.database.windows.net"
    user = "MatthewC"
    password = "CFX-4500!"
    database = "CFX-DW-AzSQLDB"

    try:
        conn = pymssql.connect(server, user, password, database)
        return conn
    except Exception as e:
        print(f"Database connection failed: {str(e)}")
        return None

def connect_to_db2():
    server = "cfx-azure-server.database.windows.net"
    user = "Chrisl"
    password = "CFX-4500!"
    database = "cfx-primary-datastore"

    try:
        conn = pymssql.connect(server, user, password, database)
        return conn
    except Exception as e:
        print(f"Database connection failed: {str(e)}")
        return None

def transfer_data():
    # Connect to Source DB
    source_conn = connect_to_db()
    if not source_conn:
        print("Could not connect to source database.")
        return

    # Connect to Destination DB
    dest_conn = connect_to_db2()
    if not dest_conn:
        print("Could not connect to destination database.")
        source_conn.close()
        return

    try:
        source_cursor = source_conn.cursor()
        dest_cursor = dest_conn.cursor()

        # Fetch data with explicit column mapping
        source_cursor.execute("""
            SELECT 
                Barcode,
                OrderID,
                Timestamp,
                CONVERT(NVARCHAR(10), EmployeeID) AS EmployeeID,
                Resource,
                Recut,
                CustomerID
            FROM [DBA].[Fact_WIP]
        """)
        
        rows = source_cursor.fetchall()
        total_source_rows = len(rows)

        if not rows:
            print("No data found in source table.")
            return

        # Prepare INSERT statement with mapped destination columns
        insert_query = """
            INSERT INTO [dbo].[Fact_Machining_Scans] (
            BARCODE,
            ORDERID,
            TIMESTAMP,
            EMPLOYEEID,
            RESOURCE,
            RECUT,
            CUSTOMERID
        ) 
            SELECT %s, %s, %s, %s, %s, %s, %s
            WHERE NOT EXISTS (
                SELECT 1 FROM [dbo].[Fact_Machining_Scans]
                WHERE BARCODE = %s
                AND ORDERID = %s
                AND TIMESTAMP = %s
                AND EMPLOYEEID = %s
                AND RESOURCE = %s
                AND RECUT = %s
                AND CUSTOMERID = %s
        )
        """

        batch_size = 1000
        inserted_rows = 0  # Track successful inserts

        for i in range(0, total_source_rows, batch_size):
            batch = rows[i:i + batch_size]

            # Modify batch data to have duplicate params for WHERE clause
            transformed_batch = [(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[0], row[1], row[2], row[3], row[4], row[5], row[6]) for row in batch]

            dest_cursor.executemany(insert_query, transformed_batch)
            inserted_count = dest_cursor.rowcount  # Get number of rows actually inserted
            dest_conn.commit()

            inserted_rows += inserted_count  # Add to total inserted count

        print(f"Successfully transferred {inserted_rows} new rows.")

    except Exception as e:
        print(f"Error during data transfer: {str(e)}")

    finally:
        # Close connections
        source_conn.close()
        dest_conn.close()

# Run the transfer
transfer_data()
