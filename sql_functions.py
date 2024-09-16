from datetime import datetime, date
from fastapi import HTTPException
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


def get_resource_group(Resource):
    """Return the group for a given work area, or the work area itself if no group is defined."""
    return WORK_STATION_GROUPS.get(Resource, Resource)

def get_resources_in_group(group):
    """Retrieve all resources that are part of the specified group."""
    # If the group itself is a resource (no other resources in its group), return it in a list
    if group in WORK_STATION_GROUPS.values():
        return [res for res, grp in WORK_STATION_GROUPS.items() if grp == group]
    return [group]  # Return the resource itself if it's not a group


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


def barcode_scan_to_db(Barcode, OrderID, Timestamp, EmployeeID, Resource, CustomerID, forceContinue=False):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        raise Exception("Failed to connect to the database.")  # Raise an exception if the connection fails

    cursor = conn.cursor()

    try:
        # First, check if the barcode is expected in dbo.View_WIP
        expected_system_check_query = """
            SELECT Barcode FROM dbo.View_WIP
            WHERE Barcode = %s
        """
        cursor.execute(expected_system_check_query, (Barcode,))
        expected_entry = cursor.fetchone()

        if not expected_entry:
            raise ValueError("Barcode not expected in the system")
        
        # Translate the specific work area to its routing group
        resource_group = WORK_STATION_GROUPS.get(Resource, None)
        if resource_group is None:
            raise ValueError("Invalid work area specified")
        
        if not forceContinue:
            expected_resource_check_query = """
                SELECT Barcode FROM dbo.View_WIP
                WHERE Barcode = %s AND Info2 LIKE %s
            """

            like_pattern = f'%{resource_group}%'
            cursor.execute(expected_resource_check_query, (Barcode, like_pattern))
            expected_entry = cursor.fetchone()

            if not expected_entry:
                raise ValueError("Barcode not expected at work area")
            

        # Check for duplicate barcodes in DBA.Fact_WIP
        if CustomerID != "TPS":
            check_query = """
                SELECT * FROM DBA.Fact_WIP
                WHERE Barcode = %s AND Resource = %s AND OrderID = %s
            """
            cursor.execute(check_query, (Barcode, Resource, OrderID))
            existing_entry = cursor.fetchone()

            if existing_entry:
                raise ValueError("Duplicate barcode; recut possible?")

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


def get_order_machinegroup_scan_count(OrderID, Resource):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    # Get the resource group (or the resource itself if it's not in a group)
    Resource_Group = get_resource_group(Resource)
    resources_in_group = get_resources_in_group(Resource_Group)

    try:
        with conn.cursor() as cursor:
            # Modify the query to select scans for all resources in the group or the resource itself
            select_query = """
            SELECT COUNT(BARCODE)
            FROM dba.Fact_WIP
            WHERE OrderID = %s AND Resource IN %s
            """
            # Use tuple conversion to handle list formatting in SQL query properly
            cursor.execute(select_query, (OrderID, tuple(resources_in_group)))
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
                COUNT(CASE WHEN INFO2 LIKE '%SCZ%' THEN BARCODE END) AS SCZ,
                COUNT(DISTINCT BARCODE) AS Total
            FROM dbo.View_WIP
            WHERE OrderID = %s AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (OrderID))
            result = cursor.fetchone()
            keys = ['PSZ', 'TRZ', 'EBZ', 'PRZ', 'HRZ', 'HDZ', 'GMZ', 'SCZ', "Total"]
            counts = {key: result[i] for i, key in enumerate(keys)}            
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


async def get_not_scanned_byarea(OrderID: str, Resource: str):
    work_group = WORK_STATION_GROUPS.get(Resource)
    if not work_group:
        raise HTTPException(status_code=400, detail="Invalid work area")
    
    try:
        conn = connect_to_db()
        cursor = conn.cursor(as_dict=True)

        query = """
        SELECT
            vw.BARCODE,
            vw.INFO1 AS Description
        FROM
            [dbo].[View_WIP] vw
        WHERE
            vw.ORDERID = %s
            AND vw.INFO2 LIKE %s
            AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
            AND NOT EXISTS (
                SELECT 1
                FROM [DBA].[Fact_WIP] fw
                WHERE fw.BARCODE = vw.BARCODE
                AND fw.RESOURCE LIKE %s
                AND fw.ORDERID = vw.ORDERID
            )
        ORDER BY BARCODE
        """
        formatted_resource = f'%{work_group}%'
        cursor.execute(query, (OrderID, formatted_resource, Resource))
        result = cursor.fetchall()       
        
        cursor.close()
        conn.close()
        return result
    
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise



############################################################

async def get_not_scanned_bymachinegroup(OrderID: str, Resource: str):
    # This retrieves machine codes from groups, ensure this mapping is available and correct
    group_members = [k for k, v in WORK_STATION_GROUPS.items() if v == Resource]
    if not group_members:
        raise HTTPException(status_code=400, detail="Invalid work area or group")

    try:
        conn = connect_to_db()
        cursor = conn.cursor(as_dict=True)
        
        # Prepare placeholders for the SQL query
        placeholders = ', '.join(['%s'] * len(group_members))

        query = f"""
        WITH LatestResources AS (
            SELECT
                fw.BARCODE,
                fw.RESOURCE,
                fw.Timestamp,
                ROW_NUMBER() OVER (PARTITION BY fw.BARCODE ORDER BY fw.TIMESTAMP DESC) AS rn
            FROM
                [DBA].[Fact_WIP] fw
        )
        SELECT
            vw.BARCODE,
            vw.CNC_BARCODE1,
            vw.INFO1 AS Description,
            vw.INFO2 AS Routing,
            lr.RESOURCE AS LastResource,
            lr.Timestamp 
        FROM
            [dbo].[View_WIP] vw
        LEFT JOIN
            LatestResources lr ON vw.BARCODE = lr.BARCODE AND lr.rn = 1
        WHERE
            vw.ORDERID = %s
            AND vw.INFO2 LIKE %s
            AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
            AND NOT EXISTS (
                SELECT 1
                FROM [DBA].[Fact_WIP] fw
                WHERE fw.BARCODE = vw.BARCODE
                AND fw.RESOURCE IN ({placeholders})
                AND fw.ORDERID = vw.ORDERID
            )
        ORDER BY BARCODE
        """
        formatted_resource = f'%{Resource}%'
        # Ensure that the parameters are in tuple form
        parameters = tuple([OrderID, formatted_resource] + group_members)        
        
        cursor.execute(query, parameters)
        print(Resource, parameters)
        result = cursor.fetchall()
        
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise
    finally:
        cursor.close()
        conn.close()

    return result



############################################################


def generate_packlist(OrderID: str):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    cursor = conn.cursor()
    try:        
        query = """
        SELECT v.BARCODE, v.INFO1, v.LENGTH, v.WIDTH, v.THICKNESS, v.MATNAME, f.Timestamp, v.INFO4, v.INFO3, v.CNC_BARCODE1, v.CUSTOMER
        FROM dbo.View_WIP v
        LEFT JOIN dba.Fact_WIP f 
            ON v.BARCODE = f.BARCODE 
            AND f.ORDERID = v.ORDERID
            AND f.Resource IN ('SC1', 'SC2')
        WHERE v.ORDERID = %s
        AND v.BARCODE IS NOT NULL
        AND (v.CNC_BARCODE1 IS NULL OR v.CNC_BARCODE1 <> '')
        ORDER BY INFO4 DESC, INFO3;
        """
        cursor.execute(query, (OrderID,))
        result = cursor.fetchall()
        print("Data fetched:", result)  # Debugging line
        customer_name = result[0][-1] if result else "No Customer"
        return result, customer_name
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise
    finally:
        cursor.close()
        conn.close()



############################################################


def generate_packlist2(OrderID: str):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    cursor = conn.cursor()
    try:
        query = """
        SELECT
            COUNT(*) AS Quantity,  -- Count the number of items in each group
            v.INFO4 AS Room,       -- Room
            v.INFO1 AS PartDescription,  -- Part description
            v.LENGTH,
            v.WIDTH,
            v.THICKNESS AS Height,
            v.MATNAME AS Material,  -- Material name
            MAX(v.CUSTOMER) AS CustomerName  -- Assuming customer name is in the same view
        FROM dbo.View_WIP v
        WHERE v.ORDERID = %s
        GROUP BY
            v.INFO4, v.INFO1, v.LENGTH, v.WIDTH, v.THICKNESS, v.MATNAME
        ORDER BY v.INFO4 DESC, v.INFO1, v.MATNAME;
        """
        cursor.execute(query, (OrderID,))
        result = cursor.fetchall()
        customer_name = result[0][-1] if result else "No Customer"
        return result, customer_name
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise
    finally:
        cursor.close()
        conn.close()


############################################################



def submit_defect(OrderID, DefectType, DefectDetails, DefectAction, EmployeeID, Resource, Barcode):
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            submit_query=f"""
            INSERT INTO [DBA].[Fact_Defects]
            (OrderID, DefectType, DefectDetails, DefectAction, DateSubmitted, EmployeeID, Resource, Barcode)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(submit_query, (OrderID, DefectType, DefectDetails, DefectAction, current_date, EmployeeID, Resource, Barcode))
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


def fetch_defect_list(order_id=None, defect_type=None, defect_action=None, work_area=None):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    query=f"""
            SELECT OrderID, DefectType, DefectDetails, DefectAction, DateSubmitted, EmployeeID, Resource, Barcode
            FROM [DBA].[Fact_Defects]
            WHERE 1=1
            """
    params = []
    # Append conditions and parameters to the list as needed
    if order_id:
        query += " AND OrderID = %s"
        params.append(order_id)
    if defect_type:
        query += " AND DefectType = %s"
        params.append(defect_type)
    if defect_action:
        query += " AND DefectAction = %s"
        params.append(defect_action)
    if work_area:
        query += " AND Resource = %s"
        params.append(work_area)

    try:
        with conn.cursor(as_dict=True) as cursor:            
            cursor.execute(query, tuple(params))  # Pass parameters as a tuple           
            result = cursor.fetchall()
            print("Data fetched:", result)  # Debugging line
        return result
    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"Database query failed {e}")
    finally:
        conn.close()



############################################################



def connect_and_prepare_query(resources, start_date=None, end_date=None):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    
    resource_placeholders = ','.join(['%s'] * len(resources))
    params = tuple(resources)

    if start_date:
        params += (start_date,)
    if end_date:
        params += (end_date,)

    return conn, resource_placeholders, params



def fetch_uptime_all(resources, start_date=None, end_date=None):
    conn, resource_placeholders, params = connect_and_prepare_query(resources, start_date, end_date)
    
    try:
        with conn.cursor() as cursor:
            query = f"""
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    Resource,
                    Timestamp,
                    CAST(Timestamp AS DATE) AS ScanDate,
                    LAG(Timestamp) OVER (PARTITION BY Resource, CAST(Timestamp AS DATE) ORDER BY Timestamp) AS PrevTimestamp
                FROM
                    [DBA].[Fact_WIP]
                WHERE
                    Resource IN ({resource_placeholders})
            """

            if start_date:
                query += " AND CAST(Timestamp AS DATE) >= %s"
                params += (start_date,)
            if end_date:
                query += " AND CAST(Timestamp AS DATE) <= %s"
                params += (end_date,)

            query += f"""
            ),
            Gaps AS (
                SELECT
                    Resource,
                    ScanDate,
                    Timestamp,
                    PrevTimestamp,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, Timestamp) >= @gap THEN DATEDIFF(MINUTE, PrevTimestamp, Timestamp)
                        ELSE 0
                    END AS GapDuration
                FROM
                    Scans
            ),
            DailyUptime AS (
                SELECT
                    Resource,
                    ScanDate,
                    SUM(CASE WHEN PrevTimestamp IS NULL THEN 0 ELSE DATEDIFF(MINUTE, PrevTimestamp, Timestamp) - GapDuration END) AS UptimeMinutes
                FROM
                    Gaps
                GROUP BY
                    Resource,
                    ScanDate
            ),
            TotalUptime AS (
                SELECT
                    Resource,
                    SUM(UptimeMinutes) AS TotalUptimeMinutes
                FROM
                    DailyUptime
                GROUP BY
                    Resource
            )
            SELECT
                Resource,
                TotalUptimeMinutes
            FROM
                TotalUptime
            """

            cursor.execute(query, params)
            results = cursor.fetchall()
            return {res[0]: res[1] for res in results}
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()



def fetch_downtime_all(resources, start_date=None, end_date=None):
    conn, resource_placeholders, params = connect_and_prepare_query(resources, start_date, end_date)
    
    try:
        with conn.cursor() as cursor:
            query = f"""
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    Resource,
                    Timestamp,
                    CAST(Timestamp AS DATE) AS ScanDate,
                    LAG(Timestamp) OVER (PARTITION BY Resource, CAST(Timestamp AS DATE) ORDER BY Timestamp) AS PrevTimestamp
                FROM
                    [DBA].[Fact_WIP]
                WHERE
                    Resource IN ({resource_placeholders})
            """

            if start_date:
                query += " AND CAST(Timestamp AS DATE) >= %s"
                params += (start_date,)
            if end_date:
                query += " AND CAST(Timestamp AS DATE) <= %s"
                params += (end_date,)

            query += f"""
            ),
            Gaps AS (
                SELECT
                    Resource,
                    ScanDate,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, Timestamp) >= @gap THEN DATEDIFF(MINUTE, PrevTimestamp, Timestamp)
                        ELSE 0
                    END AS GapDuration
                FROM
                    Scans
            ),
            DailyDowntime AS (
                SELECT
                    Resource,
                    ScanDate,
                    SUM(GapDuration) AS DowntimeMinutes
                FROM
                    Gaps
                GROUP BY
                    Resource,
                    ScanDate
            ),
            TotalDowntime AS (
                SELECT
                    Resource,
                    SUM(DowntimeMinutes) AS TotalDowntimeMinutes
                FROM
                    DailyDowntime
                GROUP BY
                    Resource
            )
            SELECT
                Resource,
                TotalDowntimeMinutes
            FROM
                TotalDowntime
            """

            cursor.execute(query, params)
            results = cursor.fetchall()
            return {res[0]: res[1] for res in results}
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


