from datetime import datetime, date
from work_station_groups import WORK_STATION_GROUPS
import pymssql

######################################################

def connect_to_db():
    server = "cfx-azure-server.database.windows.net"
    user = "MatthewC"
    password = "CFX-4500!"
    database = "CFX-DW-AzSQLDB"

    try:
        conn = pymssql.connect(server, user, password, database)
        return conn  # Return the connection object
    except Exception as e:
        print(f"Database connection failed: {str(e)}")
        return None  # Return None if connection failed

#######################################################    

def fetch_last_timestamp():
    conn = connect_to_db()
    if conn is None:
         print("Failed to connect to the database.")
         return
    
    cursor = conn.cursor()

    try:
        query = f"""
           SELECT Resource, MAX(TimeStamp) as LastScan
           FROM DBA.Fact_WIP
           GROUP BY Resource; 
        """
        cursor.execute(query)
        rows = cursor.fetchall()  # Fetch all rows returned by the SQL query
        results = {row[0]: row[1] for row in rows}  # Create a dict with Resource as key and LastScan as value
    except Exception as e:
            print("Failed to load timestamps", e)
            return {}
    finally:
        cursor.close()
        conn.close()
    
    return results



########################################################



def fetch_machine_part_counts(start_date=None, end_date=None):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        return

    cursor = conn.cursor()

    try:
        # Construct the base query
        query = """
        SELECT Resource, COUNT(Barcode) AS ScanCount
        FROM DBA.Fact_WIP
        """

        # Add conditions based on the provided dates
        conditions = []
        if start_date:
            conditions.append(f"TimeStamp >= '{start_date}'")
        if end_date:
            conditions.append(f"TimeStamp <= '{end_date}'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY Resource;"

        cursor.execute(query)
        rows = cursor.fetchall()
        results = {row[0]: row[1] for row in rows}
        return results or 0
    except Exception as e:
        print("Failed to load scan counts", e)
        return {}
    finally:
        cursor.close()
        conn.close()
    
   


############################################################


def barcode_scan_to_db(Barcode, OrderID, Timestamp, EmployeeID, Resource, CustomerID):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        raise Exception("Failed to connect to the database.")  # Raise an exception if the connection fails

    cursor = conn.cursor()

    try:
        # First, check if the barcode is expected in dbo.View_WIP
        expected_check_query = """
            SELECT Barcode FROM dbo.View_WIP
            WHERE Barcode = %s
        """
        cursor.execute(expected_check_query, (Barcode,))
        expected_entry = cursor.fetchone()

        if not expected_entry:
            raise ValueError("Barcode not expected in the system")

        # Check for duplicate barcodes in DBA.Fact_WIP
        if CustomerID != "TPS":
            check_query = """
                SELECT * FROM DBA.Fact_WIP
                WHERE Barcode = %s AND Resource = %s AND OrderID = %s
            """
            cursor.execute(check_query, (Barcode, Resource, OrderID))
            existing_entry = cursor.fetchone()

            if existing_entry:
                raise ValueError("Duplicate barcode")

        # Proceed with the insert if checks pass
        insert_query = """
            INSERT INTO DBA.Fact_WIP (
                Barcode, OrderID, Timestamp, EmployeeID, Resource, Recut, CustomerID
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (Barcode, OrderID, Timestamp, EmployeeID, Resource, 0, CustomerID))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


############################################################


def update_recut_in_db(Barcode, OrderID, Resource, Recut):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            # First, fetch the current Recut value
            select_query = """
            SELECT Recut FROM DBA.Fact_WIP
            WHERE Barcode = %s AND OrderID = %s AND Resource = %s
            """
            cursor.execute(select_query, (Barcode, OrderID, Resource))
            result = cursor.fetchone()
            if result:
                current_recut = result[0]
                new_recut = current_recut + 1

                # Now, update the Recut value
                update_query = """
                UPDATE DBA.Fact_WIP
                SET Recut = %s
                WHERE Barcode = %s AND OrderID = %s AND Resource = %s
                """
                cursor.execute(update_query, (new_recut, Barcode, OrderID, Resource))
                conn.commit()
            else:
                raise ValueError("Barcode not found in database.")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()



############################################################


def get_employee_areaparts_count(EmployeeID, Resource):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(Barcode)
            FROM DBA.Fact_WIP
            WHERE EmployeeID = %s AND Resource = %s AND CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EmployeeID, Resource, formatted_date))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def get_employee_totalparts_count(EmployeeID):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(Barcode)
            FROM DBA.Fact_WIP
            WHERE EmployeeID = %s AND CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EmployeeID, formatted_date))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_area_scanned_count(OrderID, Resource, EmployeeID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query = """
            SELECT COUNT(BARCODE)
            FROM dba.Fact_WIP
            WHERE OrderID = %s
            AND (Resource = %s AND EmployeeID = %s)
            """
            cursor.execute(select_query, (OrderID, Resource, EmployeeID))
            (count, ) = cursor.fetchone()
            return count or 0
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_totalarea_count(OrderID, Resource):
    Formatted_Resource = f'%{Resource}%'

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            # Check if the Resource is 'SCZ' and modify the behavior
            if Resource == 'SCZ':
                # For SCZ, count all barcodes regardless of CNC_BARCODE1
                select_query = """
                SELECT COUNT(BARCODE)
                FROM dbo.View_WIP
                WHERE OrderID = %s
                AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
                """
                cursor.execute(select_query, (OrderID,))
            else:
                # For other resources, use the original query
                Formatted_Resource = f'%{Resource}%'
                select_query = """
                SELECT COUNT(BARCODE)
                FROM dbo.View_WIP
                WHERE OrderID = %s AND INFO2 LIKE %s
                AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
                """
                cursor.execute(select_query, (OrderID, Formatted_Resource))
            
            (count,) = cursor.fetchone()
            return count or 0  # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def get_order_total_count(OrderID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(BARCODE)
            FROM dbo.View_WIP
            WHERE OrderID = %s 
            AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (OrderID))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_part_counts(OrderID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT
                COUNT(CASE WHEN INFO2 LIKE '%PSZ%' THEN BARCODE END) AS PSZ,
                COUNT(CASE WHEN INFO2 LIKE '%TRZ%' THEN BARCODE END) AS TRZ,
                COUNT(CASE WHEN INFO2 LIKE '%EBZ%' THEN BARCODE END) AS EBZ,
                COUNT(CASE WHEN INFO2 LIKE '%PRZ%' THEN BARCODE END) AS PRZ,
                COUNT(CASE WHEN INFO2 LIKE '%HRZ%' THEN BARCODE END) AS HRZ,
                COUNT(CASE WHEN INFO2 LIKE '%HDZ%' THEN BARCODE END) AS HDZ,
                COUNT(CASE WHEN INFO2 LIKE '%GMZ%' THEN BARCODE END) AS GMZ,
                COUNT(DISTINCT BARCODE) AS Total
            FROM dbo.View_WIP
            WHERE OrderID = %s AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (OrderID))
            result = cursor.fetchone()
            keys = ['PSZ', 'TRZ', 'EBZ', 'PRZ', 'HRZ', 'HDZ', 'GMZ', 'Total']
            counts = {key: result[i] for i, key in enumerate(keys)}
            counts['SCZ'] = counts['Total']  # Set SCZ count as the total count
            return counts
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################




def fetch_scanned_order_part_counts_data(order_id):
    conn = connect_to_db()
    if conn is not None:
        try:
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute("SELECT Barcode, Resource FROM DBA.Fact_WIP WHERE OrderID = %s", (order_id,))
                return cursor.fetchall()
        finally:
            conn.close()
    else:
        raise Exception("Failed to connect to the database")

def process_scanned_order_part_counts_data(data):
    grouped_counts = {}
    for row in data:
        barcode = row['Barcode']
        resource = row['Resource']
        group = WORK_STATION_GROUPS.get(resource, "Unknown")
        if group not in grouped_counts:
            grouped_counts[group] = set()
        grouped_counts[group].add(barcode)
    return {group: len(barcodes) for group, barcodes in grouped_counts.items()}


############################################################



def get_employee_joblist_day(EmployeeID):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT DISTINCT OrderID
            FROM DBA.Fact_WIP
            WHERE EmployeeID = %s and CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EmployeeID, formatted_date))
            result = cursor.fetchall()
            job_list = [job[0] for job in result]  # Extract JobID from each tuple
            return job_list
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()



############################################################


def get_jobid_notifications(OrderID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query="""
            SELECT DateSubmitted, RowID, NotificationType, OrderNotification
            FROM dba.Fact_XMesNotifications
            WHERE OrderID = %s
            ORDER BY DateSubmitted DESC
            """
            cursor.execute(select_query, (OrderID))
            result = cursor.fetchall()
            notification_list = [notification for notification in result]
            return notification_list
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def submit_order_notification(OrderID, NotificationType, OrderNotification, SubmittedBy):
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            submit_query=f"""
            INSERT INTO DBA.Fact_XMesNotifications
            (OrderID, NotificationType, OrderNotification, DateSubmitted, SubmittedBy)
            VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(submit_query, (OrderID, NotificationType, OrderNotification, current_date, SubmittedBy))
            conn.commit()
            return "Success"
    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"Database query failed {e}")
    finally:
        if conn:
            conn.close()


from datetime import datetime
current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
print(current_date)



############################################################



def delete_order_notification(notificationID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query="""
            DELETE FROM dba.Fact_XMesNotifications
            WHERE RowID = %s
            """
            cursor.execute(select_query, (notificationID))
            conn.commit()
            return "Success"
    except Exception as e:
        conn.rollback()  # Ensure to rollback in case of failure
        raise RuntimeError(f"Database query failed: {e}")  # More specific exception for runtime errors
    finally:
        conn.close()



############################################################


async def get_not_scanned_parts(OrderID: str):
    query = """
    SELECT
        vw.BARCODE,
        vw.INFO1 AS Description
    FROM
        [dbo].[View_WIP] vw
    WHERE
        vw.ORDERID = %s
        AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
        AND NOT EXISTS (
            SELECT 1
            FROM [DBA].[Fact_WIP] fw
            WHERE fw.BARCODE = vw.BARCODE
            AND fw.RESOURCE IN ('SC1', 'SC2')
            AND fw.ORDERID = vw.ORDERID
        )
    ORDER BY BARCODE
    """
    try:
        conn = connect_to_db()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(query, (OrderID,))
        result = cursor.fetchall()
        cursor.close()
        conn.close()
        return result
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise


############################################################


def generate_packlist(OrderID: str):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    cursor = conn.cursor()
    try:        
        query = """
        SELECT v.BARCODE, v.INFO1, v.LENGTH, v.WIDTH, v.THICKNESS, v.MATID, f.Timestamp
        FROM dbo.View_WIP v
        LEFT JOIN dba.Fact_WIP f 
            ON v.BARCODE = f.BARCODE 
            AND f.ORDERID = v.ORDERID
            AND f.Resource IN ('SC1', 'SC2')
        WHERE v.ORDERID = %s
        AND v.BARCODE IS NOT NULL
        AND (v.CNC_BARCODE1 IS NULL OR v.CNC_BARCODE1 <> '')
        ORDER BY BARCODE;
        """
        cursor.execute(query, (OrderID,))
        result = cursor.fetchall()
        print("Data fetched:", result)  # Debugging line
        return result
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise
    finally:
        cursor.close()
        conn.close()


############################################################


