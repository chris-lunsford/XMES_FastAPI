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
    # Connect to Destination DB to get the latest timestamp
    dest_conn = connect_to_db2()
    if not dest_conn:
        print("Could not connect to destination database.")
        return

    try:
        dest_cursor = dest_conn.cursor()

        # Get the latest timestamp from Fact_Machining_Scans
        dest_cursor.execute("SELECT COALESCE(MAX([Timestamp]), '2000-01-01') FROM [dbo].[Fact_Machining_Scans]")
        latest_timestamp = dest_cursor.fetchone()[0]

        print(f"Fetching new records after: {latest_timestamp}")

    except Exception as e:
        print(f"Error fetching latest timestamp: {str(e)}")
        dest_conn.close()
        return

    finally:
        dest_conn.close()

    # Connect to Source DB to fetch new records
    source_conn = connect_to_db()
    if not source_conn:
        print("Could not connect to source database.")
        return

    try:
        source_cursor = source_conn.cursor()

        # Fetch only new records from Fact_WIP
        source_cursor.execute("""
            SELECT 
                Barcode,
                OrderID,
                [Timestamp],
                CONVERT(NVARCHAR(10), EmployeeID) AS EmployeeID,
                Resource,
                Recut,
                CustomerID
            FROM [DBA].[Fact_WIP]
            WHERE [Timestamp] > %s
        """, (latest_timestamp,))
        
        rows = source_cursor.fetchall()
        total_source_rows = len(rows)

        if not rows:
            print("No new data found. Nothing to transfer.")
            return

    except Exception as e:
        print(f"Error fetching new data: {str(e)}")
        source_conn.close()
        return

    finally:
        source_conn.close()

    # Insert only new rows into Fact_Machining_Scans
    dest_conn = connect_to_db2()
    if not dest_conn:
        print("Could not reconnect to destination database.")
        return

    try:
        dest_cursor = dest_conn.cursor()

        # Prepare optimized INSERT query
        insert_query = """
            INSERT INTO [dbo].[Fact_Machining_Scans] (
                BARCODE, ORDERID, [TIMESTAMP], EMPLOYEEID, RESOURCE, RECUT, CUSTOMERID
            ) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        # Batch process for performance
        batch_size = 1000
        inserted_rows = 0  

        for i in range(0, total_source_rows, batch_size):
            batch = rows[i:i + batch_size]
            dest_cursor.executemany(insert_query, batch)
            inserted_count = dest_cursor.rowcount
            dest_conn.commit()
            inserted_rows += inserted_count

        print(f"Successfully transferred {inserted_rows} new rows.")

    except Exception as e:
        print(f"Error inserting new data: {str(e)}")

    finally:
        dest_conn.close()

# Run the optimized transfer
transfer_data()
