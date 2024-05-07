from datetime import datetime, timedelta
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

        

# def barcode_scan_to_db(Barcode, JobID, Timestamp, EmployeeID, Resource, CustomerID):
#     conn = connect_to_db()
#     if conn is None:
#         print("Failed to connect to the database.")
#         raise Exception("Failed to connect to the database.")  # Raise an exception if the connection fails

#     cursor = conn.cursor()

#     try:
#         if CustomerID !=  "TPS":
#             check_query = f"""
#                 SELECT * FROM dba.XMesSimpleData
#                 WHERE Barcode = '{Barcode}'
#                 AND Resource = '{Resource}'
#                 AND JobID = '{JobID}'
#                 """
#             cursor.execute(check_query)
#             existing_entry = cursor.fetchone()

#             if existing_entry:
#                 raise ValueError("Duplicate barcode")
        
#         insert_query = f"""
#             INSERT INTO dba.XMesSimpleData (
#                 Barcode, JobID, Timestamp, EmployeeID, Resource, Recut, CustomerID
#                 )
#             VALUES (
#                 '{Barcode}', '{JobID}', '{Timestamp}', '{EmployeeID}', '{Resource}', 0, '{CustomerID}'
#                 )
#             """
#         cursor.execute(insert_query)
#         conn.commit()
#     finally:
#         conn.close()

















############################################################




def fetch_order_data(order_id):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        return [], []  # Return empty lists for rows and column names

    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM DBA.XMesProductionForm WHERE BaseID LIKE %s", ('%' + order_id + '%',))
        columns = [column[0] for column in cursor.description]  # Get column names
        rows = cursor.fetchall()
        return rows, columns
    except Exception as e:
        print(f"Failed to fetch order data: {e}")
        return [], []  # Return empty lists for rows and column names
    finally:
        conn.close()


def update_sql(resource, barcode, employee_id):
    conn = None
    try:
        conn = connect_to_db()

        parts = barcode.split('-')
        if len(parts) < 3:
            raise ValueError("Barcode format error: Expected at least two hyphens.")
       
        base_id = '-'.join(parts[:-1])  
        part_id = parts[-1] 

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        resource_col = f"{resource}"
        emp_id_col = f"{resource}EmpID"

        debug_query = f"""
        UPDATE DBA.XMesProductionForm
        SET {resource_col} = '{timestamp}', {emp_id_col} = '{employee_id}'
        WHERE BaseID = '{base_id}' AND PartID = '{part_id}'
        """
        print("Debug SQL Query:", debug_query)
        
        query = f"""
        UPDATE DBA.XMesProductionForm
        SET {resource_col} = %s, {emp_id_col} = %s
        WHERE BaseID = %s AND PartID = %s
        """
        cursor = conn.cursor()
        cursor.execute(query, (timestamp, employee_id, base_id, part_id))
        conn.commit()

    except Exception as e:
        print(f"Error updating the database: {str(e)}")
        if conn:
            conn.rollback()  # Rollback the transaction in case of an error
        raise

    finally:
        if conn:
            conn.close()  # Always close the connection


def get_part_count(self):
        # Connect to the database
        conn = connect_to_db()
        cursor = conn.cursor()

        # Get the current date
        current_date = datetime.now().date()

        # Determine the date range based on the selected radio button
        if self.radioButton_today.isChecked():
            date_range_start = current_date
            date_range_end = current_date
        elif self.radioButton_week.isChecked():
            date_range_start = current_date - timedelta(days=current_date.weekday())
            date_range_end = date_range_start + timedelta(days=6)
        elif self.radioButton_month.isChecked():
            date_range_start = current_date.replace(day=1)
            date_range_end = current_date.replace(day=1).replace(month=current_date.month % 12 + 1) - timedelta(days=1)

        # Query the database for count of PS1 within the date range
        query = '''
                SELECT COUNT(*)
                FROM your_table_name
                WHERE DATE(PS1) BETWEEN ? AND ?
                '''
        cursor.execute(query, (date_range_start, date_range_end))
        count = cursor.fetchone()[0]

        # Close the connection
        conn.close()

        return count


def fetch_notifications(order_id):
    conn = connect_to_db()
    cursor = conn.cursor()

    # Debug: print the order_id and query
    print("Order ID:", order_id)

    current_date = datetime.now().date()

     # Initialize query
    query = '''            
            SELECT TOP 1 NotificationType
            FROM DBA.Fact_XMESNotifications
            WHERE OrderID LIKE %s
            AND NotificationType IS NOT NULL
            ORDER BY DateSubmitted DESC
            '''

    cursor.execute(query, ('%' + order_id + '%',))
    result = cursor.fetchone()

    # Debug: print the raw result of the fetch
    print("Raw fetch result:", result)

     # Close the connection
    cursor.close() 
    conn.close()

    if result:
        notification = result[0]
        print("Notification:", notification)  # Debug: print the notification
        return notification
    else:
        return "No notifications."


def submit_notification(order_id, notification_detail, notification_type, employee_name):
    conn = None
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        conn = connect_to_db()

        OrderID_col = f"OrderID"
        NotificationType_col = f"NotificationType"
        OrderNotification_col = f"OrderNotification"
        DateSubmitted_col = f"DateSubmitted"
        SubmittedBy_col = f"SubmittedBy"
    
        query = f"""
        INSERT INTO DBA.Fact_XMESNotifications
        (OrderID, NotificationType, OrderNotification, DateSubmitted, SubmittedBy)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor = conn.cursor()
        cursor.execute(query, (order_id, notification_detail, notification_type, current_date, employee_name))
        conn.commit()

    except Exception as e:
        print(f"Error updating the database: {str(e)}")
        if conn:
            conn.rollback()  # Rollback the transaction in case of an error
        raise

    finally:
        if conn:
            conn.close()  # Always close the connection
 



def fetch_part_count_by_machine(order_id, machine_codes):
    conn = None
    total_part_count = 0
    try:
        conn = connect_to_db()

        with conn.cursor() as cursor:
            for machine_code in machine_codes:
                query = """
                SELECT COUNT(*)
                FROM DBA.XMesProductionForm 
                WHERE OrderID = %s AND PartRouting LIKE %s
                """
                machine_code_pattern = f"%{machine_code}%"
                cursor.execute(query, (order_id, machine_code_pattern))
                part_count = cursor.fetchone()[0]
                total_part_count += part_count  # Sum the counts for each machine code
    except Exception as e:
        print(f"Error fetching part count for {machine_codes}: {str(e)}")
    finally:
        if conn:
            conn.close()  # Make sure to close the connection
    return total_part_count


def fetch_scanned_part_count(order_id, resource_codes):
    conn = None
    total_scanned_part_count = 0
    try:
        conn = connect_to_db()  # Make sure this function is properly defined to establish a connection to your database

        with conn.cursor() as cursor:
            # Build a dynamic query based on the resource codes
            query_parts = []
            for resource_code in resource_codes:
                query_parts.append(f"SUM(CASE WHEN {resource_code} IS NOT NULL AND {resource_code} != '' THEN 1 ELSE 0 END)")
            query_select = " + ".join(query_parts)
            query = f"""
                SELECT {query_select}
                FROM DBA.XMesProductionForm  
                WHERE OrderID = %s
                """
            cursor.execute(query, (order_id,))
            total_scanned_part_count = cursor.fetchone()[0]
    except Exception as e:
        print(f"Error fetching scanned part count for {resource_codes}: {str(e)}")
    finally:
        if conn:
            conn.close()  # Always close the connection.
    return total_scanned_part_count