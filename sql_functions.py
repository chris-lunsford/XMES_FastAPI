from datetime import datetime, timedelta, date
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
           FROM DBA.XMesSimpleData
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
        FROM DBA.XMesSimpleData
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
        return results
    except Exception as e:
        print("Failed to load scan counts", e)
        return {}
    finally:
        cursor.close()
        conn.close()
    
   


############################################################


def barcode_scan_to_db(Barcode, JobID, Timestamp, EmployeeID, Resource, CustomerID):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        raise Exception("Failed to connect to the database.")  # Raise an exception if the connection fails

    cursor = conn.cursor()

    try:
        if CustomerID != "TPS":
            check_query = """
                SELECT * FROM dba.XMesSimpleData
                WHERE Barcode = %s AND Resource = %s AND JobID = %s
            """
            cursor.execute(check_query, (Barcode, Resource, JobID))
            existing_entry = cursor.fetchone()

            if existing_entry:
                raise ValueError("Duplicate barcode")
        
        insert_query = """
            INSERT INTO dba.XMesSimpleData (
                Barcode, JobID, Timestamp, EmployeeID, Resource, Recut, CustomerID
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (Barcode, JobID, Timestamp, EmployeeID, Resource, 0, CustomerID))
        conn.commit()
    finally:
        conn.close()


############################################################


def update_recut_in_db(Barcode, JobID, Resource, Recut):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            # First, fetch the current Recut value
            select_query = """
            SELECT Recut FROM dba.XMesSimpleData
            WHERE Barcode = %s AND JobID = %s AND Resource = %s
            """
            cursor.execute(select_query, (Barcode, JobID, Resource))
            result = cursor.fetchone()
            if result:
                current_recut = result[0]
                new_recut = current_recut + 1

                # Now, update the Recut value
                update_query = """
                UPDATE dba.XMesSimpleData
                SET Recut = %s
                WHERE Barcode = %s AND JobID = %s AND Resource = %s
                """
                cursor.execute(update_query, (new_recut, Barcode, JobID, Resource))
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
            FROM dba.XMesSimpleData
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
            FROM dba.XMesSimpleData
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



def get_employee_joblist_day(EmployeeID):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT DISTINCT JobID
            FROM dba.XMesSimpleData
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


def get_jobid_notifications(JobID):
    OrderID = JobID
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



def submit_order_notification(JobID, NotificationType, OrderNotification, SubmittedBy):
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
            cursor.execute(submit_query, (JobID, NotificationType, OrderNotification, current_date, SubmittedBy))
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