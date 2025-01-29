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


def connect_to_db2():
    server = "cfx-azure-server.database.windows.net"
    user = "Chrisl"
    password = "CFX-4500!"
    database = "cfx-primary-datastore"

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
                COUNT(CASE WHEN INFO2 LIKE '%PBZ%' THEN BARCODE END) AS PBZ,
                COUNT(CASE WHEN INFO2 LIKE '%SCZ%' THEN BARCODE END) AS SCZ,                
                COUNT(DISTINCT BARCODE) AS Total
            FROM dbo.View_WIP
            WHERE OrderID = %s AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (OrderID))
            result = cursor.fetchone()
            keys = ['PSZ', 'TRZ', 'EBZ', 'PRZ', 'HRZ', 'HDZ', 'GMZ','PBZ', 'SCZ', "Total"]
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

def fetch_uptime_downtime(resource):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")    
    try:
        with conn.cursor() as cursor:
            query = """
            DECLARE @resource NVARCHAR(50) = %s;
            DECLARE @today DATE = CAST(GETDATE() AS DATE);
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    *,
                    LAG(Timestamp) OVER (PARTITION BY Resource ORDER BY Timestamp) AS PrevTimestamp
                FROM
                    [DBA].[Fact_WIP]
                WHERE
                    Resource = @resource
                    AND CAST(Timestamp AS DATE) = @today
            ),
            Gaps AS (
                SELECT
                    *,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, Timestamp) > @gap OR PrevTimestamp IS NULL THEN 1
                        ELSE 0
                    END AS IsGap,
                    DATEDIFF(MINUTE, PrevTimestamp, Timestamp) AS GapDuration
                FROM
                    Scans
            ),
            GroupedScans AS (
                SELECT
                    *,
                    SUM(IsGap) OVER (ORDER BY Timestamp ROWS UNBOUNDED PRECEDING) AS GroupID
                FROM
                    Gaps
            ),
            RunTimes AS (
                SELECT
                    Resource,
                    GroupID,
                    MIN(Timestamp) AS StartTime,
                    MAX(Timestamp) AS EndTime
                FROM
                    GroupedScans
                GROUP BY
                    Resource,
                    GroupID
            ),
            Downtime AS (
                SELECT
                    SUM(GapDuration) AS TotalDowntimeInMinutes
                FROM
                    Gaps
                WHERE
                    GapDuration > @gap
            ),
            RunTime AS (
                SELECT
                    SUM(DATEDIFF(MINUTE, StartTime, EndTime)) AS TotalRunTimeInMinutes
                FROM
                    RunTimes
            )
            SELECT
                R.TotalRunTimeInMinutes,
                D.TotalDowntimeInMinutes
            FROM
                RunTime R, Downtime D;
            """
            cursor.execute(query, (resource))
            result = cursor.fetchall()        
            return result
    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"Database query failed {e}")
    finally:
        conn.close()




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



############################################################



def fetch_last_scan(resource):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")    
    try:
        cursor = conn.cursor()
        query = """
        SELECT TOP 1 Barcode, EmployeeID, Timestamp
        FROM [DBA].[Fact_WIP]
        WHERE Resource = %s
        ORDER BY Timestamp DESC;
        """
        cursor.execute(query, (resource))
        result = cursor.fetchone()
        if result:
            return {
                'Barcode': result[0],
                'EmployeeID': result[1],
                'Timestamp': result[2]
            }
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def fetch_joblist_daterange(resource, start_date, end_date):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    try:
        cursor = conn.cursor()
        query = """
        SELECT DISTINCT ORDERID
        FROM [DBA].[Fact_WIP]
        WHERE Resource = %s
            AND Timestamp > %s AND Timestamp < %s
        ORDER BY OrderID
        """
        cursor.execute(query, (resource, start_date, end_date))
        results = cursor.fetchall() 
        return results
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
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



def fetch_runtime_machines(orderid):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")

    # Use the existing WORK_STATION_GROUPS mapping
    from work_station_groups import WORK_STATION_GROUPS

    # Prepare the machine to work group mappings for SQL
    machine_group_values = ',\n'.join(
        f"('{machine}', '{group}')" for machine, group in WORK_STATION_GROUPS.items()
    )

    # Get all machines
    all_machines = list(WORK_STATION_GROUPS.keys())
    resource_placeholders = ','.join(['%s'] * len(all_machines))
    params = tuple(all_machines) + (orderid,)

    try:
        with conn.cursor() as cursor:
            query = f"""
            DECLARE @gap INT = 15;

            -- CTE for machine to work group mapping
            WITH MachineGroups AS (
                SELECT * FROM (VALUES
                    {machine_group_values}
                ) AS MG(Machine, WorkGroup)
            ),
            Scans AS (
                SELECT
                    Resource,
                    Timestamp,
                    CAST(Timestamp AS DATE) AS ScanDate,
                    LAG(Timestamp) OVER (PARTITION BY Resource, CAST(Timestamp AS DATE) ORDER BY Timestamp) AS PrevTimestamp
                FROM
                    [DBA].[Fact_WIP]
                WHERE
                    Resource IN ({resource_placeholders})
                    AND OrderID = %s
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
                    SUM(UptimeMinutes) AS MachineTime
                FROM
                    DailyUptime
                GROUP BY
                    Resource
            ),
            WorkGroupUptime AS (
                SELECT
                    ISNULL(MG.WorkGroup, TU.Resource) AS WorkGroup,
                    SUM(TU.MachineTime) AS MachineTime
                FROM
                    TotalUptime TU
                LEFT JOIN
                    MachineGroups MG
                ON
                    TU.Resource = MG.Machine
                GROUP BY
                    ISNULL(MG.WorkGroup, TU.Resource)
            )
            SELECT
                WorkGroup AS Resource,
                MachineTime
            FROM
                WorkGroupUptime

            UNION ALL

            SELECT
                'Total' AS Resource,
                SUM(MachineTime) AS MachineTime
            FROM
                WorkGroupUptime;
            """

            cursor.execute(query, params)
            results = cursor.fetchall()
            return {res[0]: res[1] for res in results}
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


################################################################


# def fetch_parts_in_article(barcode, loadAll):
#     conn = connect_to_db2()
#     if conn is None:
#         raise Exception("Failed to connect to the database.")
#     try:
#         cursor = conn.cursor()

#         # Query to check if ARTICLE_ID is null
#         check_query = """
#         SELECT ARTICLE_ID 
#         FROM dbo.Part
#         WHERE BARCODE = %s
#         """
#         cursor.execute(check_query, (barcode,))
#         result = cursor.fetchone()

#         if not result or result[0] is None:
#             # If ARTICLE_ID is null or no row is found
#             return {"message": "No related part or article data available for the provided barcode."}

#         if loadAll:
#             # Fetch all parts for the article
#             query = """
#             WITH BarcodeRow AS (
#                 SELECT ORDERID, ARTICLE_ID
#                 FROM dbo.Part
#                 WHERE BARCODE = %s 
#             )
#             SELECT p.BARCODE, p.INFO1, p.INFO2
#             FROM dbo.Part p
#             INNER JOIN BarcodeRow br
#             ON p.ORDERID = br.ORDERID AND p.ARTICLE_ID = br.ARTICLE_ID
#             WHERE p.COLOR1 IS NOT NULL AND p.COLOR1 != '_'
#             ORDER BY BARCODE
#             """
#         else:
#             # Fetch only the specific part represented by the scanned barcode
#             query = """
#             SELECT BARCODE, INFO1, INFO2
#             FROM dbo.Part
#             WHERE BARCODE = %s
#             ORDER BY BARCODE
#             """
#         cursor.execute(query, (barcode,))
#         columns = [desc[0] for desc in cursor.description]  # Get column names
#         results = [dict(zip(columns, row)) for row in cursor.fetchall()]  # Convert rows to dictionaries
#         return results
#     except Exception as e:
#         raise Exception(f"Database query failed: {e}")
#     finally:
#         conn.close()


def fetch_parts_in_article(barcode, loadAll):
    conn = connect_to_db2()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        cursor = conn.cursor()

        # Query to check if ARTICLE_ID is null
        check_query = """
        SELECT ORDERID, ARTICLE_ID 
        FROM dbo.Part
        WHERE BARCODE = %s
        """
        cursor.execute(check_query, (barcode,))
        result = cursor.fetchone()

        if not result or result[1] is None:
            # If ARTICLE_ID is null or no row is found
            return {"message": "No related part or article data available for the provided barcode."}

        # Extract ORDERID and ARTICLE_ID
        order_id, article_id = result

        if loadAll:
            # Fetch all parts for the article, ensuring uniqueness by combining ORDERID and ARTICLE_ID
            query = """
            WITH BarcodeRow AS (
                SELECT ORDERID, ARTICLE_ID
                FROM dbo.Part
                WHERE BARCODE = %s 
            )
            SELECT 
                p.BARCODE, 
                p.INFO1, 
                p.INFO2, 
                a.INFO3 AS CabinetNumber
            FROM dbo.Part p
            INNER JOIN BarcodeRow br
                ON p.ORDERID = br.ORDERID AND p.ARTICLE_ID = br.ARTICLE_ID
            LEFT JOIN dbo.Article a
                ON br.ORDERID = a.ORDERID AND br.ARTICLE_ID = a.ID
            WHERE p.COLOR1 IS NOT NULL AND p.COLOR1 != '_'
			AND CNC_BARCODE1 IS NOT NULL AND CNC_BARCODE1 != ''
            ORDER BY p.BARCODE

            """
        else:
            # Fetch only the specific part represented by the scanned barcode
            # ensuring uniqueness by combining ORDERID and ARTICLE_ID
            query = """
            SELECT BARCODE, INFO1, INFO2
            FROM dbo.Part
            WHERE BARCODE = %s
            ORDER BY BARCODE
            """
        cursor.execute(query, (barcode,))
        columns = [desc[0] for desc in cursor.description]  # Get column names
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]  # Convert rows to dictionaries

        # Check if results are empty and include CabinetNumber if available
        if not results:
            return {"message": "No parts or article data available for the provided barcode."}

        return results
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


###################################################




def check_sub_assembly_status(barcode):
    """
    1) Look for the BARCODE in dbo.View_Part_Data to get the PARENTID.
       - If PARENTID is NULL or empty, return {"message": "No article data available"}.
    2) If there is a PARENTID, look in dbo.Part for the row with this BARCODE to get that row's PARENTID.
    3) Then check if dbo.Part has a row where 'ID' = the PARENTID from step (2).
       - If yes => Part belongs to a sub-assembly.
       - If no  => Part does not belong to a sub-assembly.
    """

    conn = connect_to_db2()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    try:
        cursor = conn.cursor()

        # STEP 1: Check if the BARCODE has a parent in the View_Part_Data
        check_parentid_query = """
            SELECT PARENTID
            FROM dbo.View_Part_Data
            WHERE BARCODE = %s
        """
        cursor.execute(check_parentid_query, (barcode,))
        result = cursor.fetchone()

        # If no row returned or PARENTID is None/empty => no article data
        if not result or not result[0]:
            return {"message": "No article data available for the provided barcode."}

        # We have a PARENTID from View_Part_Data
        parentid_from_view = result[0]

        # STEP 2: Look in dbo.Part for the row of this barcode and get its PARENTID
        check_part_query = """
            SELECT PARENTID, ORDERID
            FROM dbo.Part
            WHERE BARCODE = %s
        """
        cursor.execute(check_part_query, (barcode,))
        part_row = cursor.fetchone()

        # If no row in dbo.Part for this barcode, it might be an anomaly,
        # but let's handle it gracefully
        if not part_row:
            return {"message": "Part not found in dbo.Part, cannot determine sub-assembly status."}

        part_parentid, part_orderid = part_row  # The PARENTID for this specific part

        # STEP 3: Check if there is a row in dbo.Part where ID = part_parentid
        #         If found, also retrieve INFO2 to check if it's 'NAZ'.
        check_sub_assembly_query = """
            SELECT ID, INFO2
            FROM dbo.Part
            WHERE ID = %s
              AND ORDERID = %s
        """
        cursor.execute(check_sub_assembly_query, (part_parentid, part_orderid))
        sub_assembly_row = cursor.fetchone()

        if not sub_assembly_row:
            return {"message": "This part does not belongs to a sub-assembly."}
        else:
            # Found parent row => part belongs to a sub-=assembly
            _, parent_info2 = sub_assembly_row

            # Check if parent INFO2 indicates no assembly required
            if parent_info2 == "NAZ":
                return {
                    "message": "This part belongs to a sub-=assembly with NO assembly required"
                }
            else:
                return {
                    "message": "This part belongs to a sub-assembly with assembly required"
                }
            
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()
        

###################################################



def fetch_parts_with_subassembly_logic(barcode):
    """
    1) Check if there is article data for the barcode (dbo.Part → ARTICLE_ID).
       - If no, return: {"message": "No article data available for the provided barcode."}

    2) If there is article data, check sub-assembly status (via dbo.View_Part_Data → PARENTID).
       - If no PARENTID => not sub-assembly => return all article parts.
       - If yes PARENTID => check parent's dbo.Part row (ID, INFO2, ARTICLE_ID).
         * If no parent row => not a sub-assembly => return all.
         * If parent row => check INFO2:
             - INFO2 == 'NAZ' => sub-assembly with NO assembly => return all.
             - otherwise     => sub-assembly WITH assembly => return ONLY sub-assembly's parts.

    3) "All article parts" uses the same approach as `fetch_parts_in_article(loadAll=True)`.
       "Only sub-assembly parts" is the same approach but anchored on the parent's (ORDERID, ARTICLE_ID).
    """

    conn = connect_to_db2()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    try:
        cursor = conn.cursor()

        # ------------------------------------------------
        # STEP 1: Check if the barcode has an ARTICLE_ID
        # ------------------------------------------------
        check_article_query = """
            SELECT ORDERID, ARTICLE_ID
            FROM dbo.Part
            WHERE BARCODE = %s
        """
        cursor.execute(check_article_query, (barcode,))
        part_info = cursor.fetchone()

        if not part_info or part_info[1] is None:
            return {"message": "No article data available for the provided barcode."}

        order_id, article_id = part_info

        # ------------------------------------------------
        # STEP 2: Check sub-assembly status
        # ------------------------------------------------
        # 2a) Check if there's a PARENTID in dbo.Part
        check_parentid_query = """
            SELECT PARENTID
            FROM dbo.Part
            WHERE BARCODE = %s
        """
        cursor.execute(check_parentid_query, (barcode,))
        parentid_row = cursor.fetchone()

        # sub_assembly_required controls final return logic
        # sub_assembly_required = True => only sub-assembly parts
        # sub_assembly_required = False => all article parts
        sub_assembly_required = False

        if parentid_row and parentid_row[0]:
            # This indicates the part *may* belong to a sub-assembly
            possible_parent_id = parentid_row[0]

            # Look up the parent row in dbo.Part to confirm
            check_parent_row_query = """
                SELECT ID, INFO2, ARTICLE_ID
                FROM dbo.Part
                WHERE ID = %s
                  AND ORDERID = %s
            """
            cursor.execute(check_parent_row_query, (possible_parent_id, order_id))
            parent_row = cursor.fetchone()

            if parent_row:
                # Found a parent row, so sub-assembly is real
                parent_id, parent_info2, parent_article_id = parent_row

                if parent_info2 and parent_info2.upper() != "NAZ":
                    # Means sub-assembly *with* assembly required
                    sub_assembly_required = True
                    # We'll use parent's ARTICLE_ID to gather sub-assembly parts
                    sub_assembly_article_id = parent_article_id
                else:
                    # Sub-assembly is present but "NAZ" => no assembly required
                    sub_assembly_required = False
            else:
                # No parent row => treat it as not in a sub-assembly
                sub_assembly_required = False
        else:
            # No or empty PARENTID => not sub-assembly
            sub_assembly_required = False

        # ------------------------------------------------
        # STEP 3: Return the correct parts
        # ------------------------------------------------

        if not sub_assembly_required:
            # Return all parts for the entire article (like loadAll=True)
            # using the scanned barcode's (order_id, article_id).
            query = """
                WITH BarcodeRow AS (
                    SELECT ORDERID, ARTICLE_ID
                    FROM dbo.Part
                    WHERE BARCODE = %s
                )
                SELECT 
                    p.BARCODE, 
                    p.INFO1, 
                    p.INFO2, 
                    a.INFO3 AS CabinetNumber
                FROM dbo.Part p
                INNER JOIN BarcodeRow br
                    ON p.ORDERID = br.ORDERID 
                    AND p.ARTICLE_ID = br.ARTICLE_ID
                LEFT JOIN dbo.Article a
                    ON br.ORDERID = a.ORDERID
                    AND br.ARTICLE_ID = a.ID
                WHERE p.COLOR1 IS NOT NULL AND p.COLOR1 != '_'
                  AND p.CNC_BARCODE1 IS NOT NULL AND p.CNC_BARCODE1 != ''
                ORDER BY p.BARCODE
            """
            cursor.execute(query, (barcode,))
        else:
            # Return only the sub-assembly parts using the parent's ARTICLE_ID
            # (We assume the same ORDERID as the child part.)
            query = """
                WITH SubAssemblyRow AS (
                    SELECT %s AS ORDERID, %s AS ARTICLE_ID
                )
                SELECT
                    p.BARCODE,
                    p.INFO1,
                    p.INFO2,
                    a.INFO3 AS CabinetNumber
                FROM dbo.Part p
                INNER JOIN SubAssemblyRow sar
                    ON p.ORDERID = sar.ORDERID
                    AND p.ARTICLE_ID = sar.ARTICLE_ID
                LEFT JOIN dbo.Article a
                    ON sar.ORDERID = a.ORDERID
                    AND sar.ARTICLE_ID = a.ID
                WHERE p.COLOR1 IS NOT NULL AND p.COLOR1 != '_'
                  AND p.CNC_BARCODE1 IS NOT NULL AND p.CNC_BARCODE1 != ''
                ORDER BY p.BARCODE
            """
            # parent_article_id is from the parent's row in dbo.Part
            cursor.execute(query, (order_id, sub_assembly_article_id))

        # Convert rows → list of dictionaries
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        results = [dict(zip(columns, row)) for row in rows]

        if not results:
            return {"message": "No parts or article data available for the provided barcode."}

        return results

    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()
                

###################################################



def fetch_parts_with_subassembly_logic2(barcode):
    
    conn = connect_to_db2()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    try:
        cursor = conn.cursor()

        # ------------------------------------------------
        # STEP 1: Check if the barcode has an ARTICLE_ID
        # ------------------------------------------------
        check_article_query = """
            SELECT PARENTID
            FROM dbo.View_Part_Data
            WHERE BARCODE = %s
        """
        cursor.execute(check_article_query, (barcode,))
        part_info = cursor.fetchone()

        if not part_info or part_info[0] is None:
            return {"message": "No article data available for the provided barcode."}
        
        

        # ------------------------------------------------
        # STEP 2: Check sub-assembly status
        # ------------------------------------------------
        # 2a) Check if there's a PARENTID in dbo.Part
        check_parentid_query = """
            SELECT ORDERID, PARENTID, ARTICLE_ID
            FROM dbo.Part
            WHERE BARCODE = %s
        """
        cursor.execute(check_parentid_query, (barcode,))
        parentid_row = cursor.fetchone()
        
        order_id, parent_id, article_id = parentid_row

        # sub_assembly_required controls final return logic
        # sub_assembly_required = True => only sub-assembly parts
        # sub_assembly_required = False => all article parts
        sub_assembly_required = False

        if parentid_row and parentid_row[1]:
            # This indicates the part *may* belong to a sub-assembly
            possible_parent_id = parentid_row[1]

            # Look up the parent row in dbo.Part to confirm
            check_parent_row_query = """
                SELECT ID, INFO2, ARTICLE_ID
                FROM dbo.Part
                WHERE ID = %s
                AND ORDERID = %s
            """
            cursor.execute(check_parent_row_query, (possible_parent_id, order_id))
            parent_row = cursor.fetchone()

            if parent_row:
                # Found a parent row, so sub-assembly is real
                parent_id, parent_info2, parent_article_id = parent_row

                if parent_info2 and parent_info2.upper() != "NAZ":
                    # Means sub-assembly *with* assembly required
                    sub_assembly_required = True
                    # We'll use parent's ARTICLE_ID to gather sub-assembly parts
                    sub_assembly_id = parent_id
                else:
                    # Sub-assembly is present but "NAZ" => no assembly required
                    sub_assembly_required = False
            else:
                # No parent row => treat it as not in a sub-assembly
                sub_assembly_required = False
        else:
            # No or empty PARENTID => not sub-assembly
            sub_assembly_required = False

        # ------------------------------------------------
        # STEP 3: Return the correct parts
        # ------------------------------------------------

        if not sub_assembly_required:
            # Return all parts for the entire article (like loadAll=True)
            # using the scanned barcode's (order_id, article_id).
            query = """
                WITH BarcodeRow AS (
                    SELECT ORDERID, ARTICLE_ID
                    FROM dbo.Part
                    WHERE BARCODE = %s
                )
                SELECT 
                    p.BARCODE, 
                    p.INFO1, 
                    p.INFO2, 
                    a.INFO3 AS CabinetNumber
                FROM dbo.Part p
                INNER JOIN BarcodeRow br
                    ON p.ORDERID = br.ORDERID 
                    AND p.ARTICLE_ID = br.ARTICLE_ID
                LEFT JOIN dbo.Article a
                    ON br.ORDERID = a.ORDERID
                    AND br.ARTICLE_ID = a.ID
                WHERE p.COLOR1 IS NOT NULL AND p.COLOR1 != '_'
                  AND p.CNC_BARCODE1 IS NOT NULL AND p.CNC_BARCODE1 != ''
                ORDER BY p.BARCODE
            """
            cursor.execute(query, (barcode,))
        else:
            # Return only the sub-assembly parts
            # We assume:
            #   order_id         = the parent's ORDERID
            #   parent_article_id = the parent's ARTICLE_ID
            #   sub_assembly_id   = the parent's ID (for PARENTID matching)

            query = """
                SELECT
                    p.BARCODE,
                    p.INFO1,
                    p.INFO2,
                    a.INFO3 AS CabinetNumber
                FROM dbo.Part p
                LEFT JOIN dbo.Article a
                    ON p.ORDERID = a.ORDERID
                    AND p.ARTICLE_ID = a.ID
                WHERE p.ORDERID = %s
                AND p.ARTICLE_ID = %s
                AND p.PARENTID = %s
                AND p.COLOR1 IS NOT NULL
                AND p.COLOR1 != '_'
                AND p.CNC_BARCODE1 IS NOT NULL
                AND p.CNC_BARCODE1 != ''
                ORDER BY p.BARCODE
            """

            cursor.execute(query, (order_id, parent_article_id, sub_assembly_id))

        # Convert rows → list of dictionaries
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        results = [dict(zip(columns, row)) for row in rows]

        if not results:
            return {"message": "No parts or article data available for the provided barcode."}

        return results

    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()




###################################################



def fetch_parts_show_naz_children(barcode):
    """
    1) Identify which cabinet (ORDERID, ARTICLE_ID) the scanned barcode belongs to.
       - If no article data, return a message.
    2) Fetch ALL parts from the cabinet (including parents + children).
    3) Filter out children whose parent's INFO2 != 'NAZ'.
       i.e. If parent has 'NAZ' => keep children.
            If parent has anything else => exclude children.
    """

    conn = connect_to_db2()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    try:
        cursor = conn.cursor()

        # Step 1: Check article data for the barcode
        check_article_query = """
            SELECT ORDERID, ARTICLE_ID
            FROM dbo.Part
            WHERE BARCODE = %s
        """
        cursor.execute(check_article_query, (barcode,))
        row = cursor.fetchone()

        if not row or row[1] is None:
            return {"message": "No article data available for the provided barcode."}

        order_id, article_id = row

        # Step 2: Fetch all parts for this cabinet
        get_parts_query = """
            SELECT
                p.ID,
                p.PARENTID,
                p.BARCODE,
                p.INFO1,
                p.INFO2,
                a.INFO3 AS CabinetNumber
            FROM dbo.Part p
            LEFT JOIN dbo.Article a
                ON p.ORDERID = a.ORDERID
                AND p.ARTICLE_ID = a.ID
            WHERE p.ORDERID = %s
              AND p.ARTICLE_ID = %s              
            ORDER BY p.BARCODE
        """
        cursor.execute(get_parts_query, (order_id, article_id))
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        if not rows:
            return {"message": "No parts or article data found for this cabinet."}

        all_parts = [dict(zip(columns, r)) for r in rows]

        # Step 3: Filter out children if parent's INFO2 != 'NAZ'
        # Build a dict for quick parent lookups
        part_dict = { part["ID"]: part for part in all_parts }

        final_parts = []
        for part in all_parts:
            parent_id = part["PARENTID"]
            if parent_id and parent_id in part_dict:
                parent_info2 = part_dict[parent_id]["INFO2"]
                # If parent's info2 is something other than NAZ, skip the child
                if parent_info2 and parent_info2.upper() != "NAZ":
                    continue
            # Otherwise, keep the part (either no parent or parent's info2 == NAZ)
            final_parts.append(part)

        if not final_parts:
            return {"message": "No parts available after filtering (all children had non-NAZ parent)."}

        return final_parts

    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()