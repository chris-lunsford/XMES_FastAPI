from datetime import datetime, date
from fastapi import HTTPException
from assembly_work_stations import ASSEMBLY_WORK_STATIONS
from work_station_groups import WORK_STATION_GROUPS
from models import *
import pymssql
import pytz

######################################################

# def connect_to_db():
#     server = "cfx-azure-server.database.windows.net"
#     user = "MatthewC"
#     password = "CFX-4500!"
#     database = "CFX-DW-AzSQLDB"

#     try:
#         conn = pymssql.connect(server, user, password, database)
#         return conn  # Return the connection object
#     except Exception as e:
#         print(f"Database connection failed: {str(e)}")
#         return None  # Return None if connection failed

def connect_to_db():
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


# def connect_to_db2():
#     server = "cfx-azure-server.database.windows.net"
#     user = "Chrisl"
#     password = "CFX-4500!"
#     database = "cfx-primary-datastore"

#     try:
#         conn = pymssql.connect(server, user, password, database)
#         return conn  # Return the connection object
#     except Exception as e:
#         print(f"Database connection failed: {str(e)}")
#         return None  # Return None if connection failed

####################################################### 


def fetch_last_timestamp():
    conn = connect_to_db()
    if conn is None:
         print("Failed to connect to the database.")
         return
    
    cursor = conn.cursor()

    try:
        query = f"""
           SELECT RESOURCE, MAX(TIMESTAMP) as LastScan
           FROM dbo.Fact_Machining_Scans
           GROUP BY RESOURCE; 
        """
        cursor.execute(query)
        rows = cursor.fetchall()  # Fetch all rows returned by the SQL query
        results = {row[0]: row[1] for row in rows}  # Create a dict with RESOURCE as key and LastScan as value
    except Exception as e:
            print("Failed to load timestamps", e)
            return {}
    finally:
        cursor.close()
        conn.close()
    
    return results



########################################################


def get_resource_group(RESOURCE):
    """Return the group for a given work area, or the work area itself if no group is defined."""
    return WORK_STATION_GROUPS.get(RESOURCE, RESOURCE)

def get_resources_in_group(group):
    """Retrieve all RESOURCEs that are part of the specified group."""
    # If the group itself is a RESOURCE (no other RESOURCEs in its group), return it in a list
    if group in WORK_STATION_GROUPS.values():
        return [res for res, grp in WORK_STATION_GROUPS.items() if grp == group]
    return [group]  # Return the RESOURCE itself if it's not a group


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
        SELECT RESOURCE, COUNT(BARCODE) AS ScanCount
        FROM dbo.Fact_Machining_Scans
        """

        # Add conditions based on the provided dates
        conditions = []
        if start_date:
            conditions.append(f"TimeStamp >= '{start_date}'")
        if end_date:
            conditions.append(f"TimeStamp <= '{end_date}'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY RESOURCE;"

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


def barcode_scan_to_db(BARCODE, ORDERID, TIMESTAMP, EMPLOYEEID, RESOURCE, CUSTOMERID, forceContinue=False):
    conn = connect_to_db()
    if conn is None:
        print("Failed to connect to the database.")
        raise Exception("Failed to connect to the database.")  # Raise an exception if the connection fails

    cursor = conn.cursor()

    try:
        # First, check if the BARCODE is expected in dbo.View_Part_Data
        expected_system_check_query = """
            SELECT BARCODE FROM dbo.View_Part_Data
            WHERE BARCODE = %s
        """
        cursor.execute(expected_system_check_query, (BARCODE,))
        expected_entry = cursor.fetchone()

        if not expected_entry:
            raise ValueError("BARCODE not expected in the system")
        
        # Translate the specific work area to its routing group
        RESOURCE_group = WORK_STATION_GROUPS.get(RESOURCE, None)
        if RESOURCE_group is None:
            raise ValueError("Invalid work area specified")
        
        if not forceContinue:
            expected_RESOURCE_check_query = """
                SELECT BARCODE FROM dbo.View_Part_Data
                WHERE BARCODE = %s AND Info2 LIKE %s
            """

            like_pattern = f'%{RESOURCE_group}%'
            cursor.execute(expected_RESOURCE_check_query, (BARCODE, like_pattern))
            expected_entry = cursor.fetchone()

            if not expected_entry:
                raise ValueError("BARCODE not expected at work area")
            

        # Check for duplicate BARCODEs in dbo.Fact_Machining_Scans
        if CUSTOMERID != "TPS":
            check_query = """
                SELECT * FROM dbo.Fact_Machining_Scans
                WHERE BARCODE = %s AND RESOURCE = %s AND ORDERID = %s
            """
            cursor.execute(check_query, (BARCODE, RESOURCE, ORDERID))
            existing_entry = cursor.fetchone()

            if existing_entry:
                raise ValueError("Duplicate barcode; recut possible?")

        # Proceed with the insert if checks pass
        insert_query = """
            INSERT INTO dbo.Fact_Machining_Scans (
                BARCODE, ORDERID, TIMESTAMP, EMPLOYEEID, RESOURCE, RECUT, CUSTOMERID
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (BARCODE, ORDERID, TIMESTAMP, EMPLOYEEID, RESOURCE, 0, CUSTOMERID))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


############################################################


def update_recut_in_db(BARCODE, ORDERID, RESOURCE, RECUT):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            # First, fetch the current Recut value
            select_query = """
            SELECT RECUT FROM dbo.Fact_Machining_Scans
            WHERE BARCODE = %s AND ORDERID = %s AND RESOURCE = %s
            """
            cursor.execute(select_query, (BARCODE, ORDERID, RESOURCE))
            result = cursor.fetchone()
            if result:
                current_recut = result[0]
                new_recut = current_recut + 1

                # Now, update the Recut value
                update_query = """
                UPDATE dbo.Fact_Machining_Scans
                SET RECUT = %s
                WHERE BARCODE = %s AND ORDERID = %s AND RESOURCE = %s
                """
                cursor.execute(update_query, (new_recut, BARCODE, ORDERID, RESOURCE))
                conn.commit()
            else:
                raise ValueError("BARCODE not found in database.")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()



############################################################


def get_employee_areaparts_count(EMPLOYEEID, RESOURCE):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(BARCODE)
            FROM dbo.Fact_Machining_Scans
            WHERE EMPLOYEEID = %s AND RESOURCE = %s AND CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EMPLOYEEID, RESOURCE, formatted_date))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def get_employee_totalparts_count(EMPLOYEEID):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(BARCODE)
            FROM dbo.Fact_Machining_Scans
            WHERE EMPLOYEEID = %s AND CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EMPLOYEEID, formatted_date))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_area_scanned_count(ORDERID, RESOURCE, EMPLOYEEID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query = """
            SELECT COUNT(BARCODE)
            FROM dbo.Fact_Machining_Scans
            WHERE ORDERID = %s
            AND (RESOURCE = %s AND EMPLOYEEID = %s)
            """
            cursor.execute(select_query, (ORDERID, RESOURCE, EMPLOYEEID))
            (count, ) = cursor.fetchone()
            return count or 0
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_machinegroup_scan_count(ORDERID, RESOURCE):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    # Get the RESOURCE group (or the RESOURCE itself if it's not in a group)
    RESOURCE_Group = get_resource_group(RESOURCE)
    RESOURCEs_in_group = get_resources_in_group(RESOURCE_Group)

    try:
        with conn.cursor() as cursor:
            # Modify the query to select scans for all RESOURCEs in the group or the RESOURCE itself
            select_query = """
            SELECT COUNT(BARCODE)
            FROM dbo.Fact_Machining_Scans
            WHERE ORDERID = %s AND RESOURCE IN %s
            """
            # Use tuple conversion to handle list formatting in SQL query properly
            cursor.execute(select_query, (ORDERID, tuple(RESOURCEs_in_group)))
            (count, ) = cursor.fetchone()
            return count or 0
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_totalarea_count(ORDERID, RESOURCE):
    Formatted_RESOURCE = f'%{RESOURCE}%'

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:            
            Formatted_RESOURCE = f'%{RESOURCE}%'
            select_query = """
            SELECT COUNT(BARCODE)
            FROM dbo.View_Part_Data
            WHERE ORDERID = %s AND INFO2 LIKE %s
            AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (ORDERID, Formatted_RESOURCE))
                
            (count,) = cursor.fetchone()
            return count or 0  # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def get_order_total_count(ORDERID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT COUNT(BARCODE)
            FROM dbo.View_Part_Data
            WHERE ORDERID = %s 
            AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (ORDERID))
            (count,) = cursor.fetchone()
            return count or 0 # Return 0 if count is None
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################


def get_order_part_counts(ORDERID):
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
            FROM dbo.View_Part_Data
            WHERE ORDERID = %s AND (CNC_BARCODE1 IS NULL OR CNC_BARCODE1 <> '')
            """
            cursor.execute(select_query, (ORDERID))
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
                cursor.execute("SELECT BARCODE, RESOURCE FROM dbo.Fact_Machining_Scans WHERE ORDERID = %s", (order_id,))
                return cursor.fetchall()
        finally:
            conn.close()
    else:
        raise Exception("Failed to connect to the database")

def process_scanned_order_part_counts_data(data):
    grouped_counts = {}
    for row in data:
        BARCODE = row['BARCODE']
        RESOURCE = row['RESOURCE']
        group = WORK_STATION_GROUPS.get(RESOURCE, "Unknown")
        if group not in grouped_counts:
            grouped_counts[group] = set()
        grouped_counts[group].add(BARCODE)
    return {group: len(BARCODEs) for group, BARCODEs in grouped_counts.items()}


############################################################



def get_employee_joblist_day(EMPLOYEEID):
    today = date.today()
    formatted_date = today.strftime('%Y-%m-%d')  # Adjust the format if needed

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query= """
            SELECT DISTINCT ORDERID
            FROM dbo.Fact_Machining_Scans
            WHERE EMPLOYEEID = %s and CONVERT(date, Timestamp) = %s
            """
            cursor.execute(select_query, (EMPLOYEEID, formatted_date))
            result = cursor.fetchall()
            job_list = [job[0] for job in result]  # Extract JobID from each tuple
            return job_list
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()



############################################################


def get_jobid_notifications(ORDERID):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            select_query="""
            SELECT DATE_SUBMITTED, ROWID, NOTIFICATION_TYPE, ORDER_NOTIFICATION
            FROM dbo.Fact_Xmes_Notifications
            WHERE ORDERID = %s
            ORDER BY DATE_SUBMITTED DESC
            """
            cursor.execute(select_query, (ORDERID))
            result = cursor.fetchall()
            notification_list = [notification for notification in result]
            return notification_list
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()


############################################################



def submit_order_notification(ORDERID, NOTIFICATION_TYPE, ORDER_NOTIFICATION, SUBMITTED_BY):
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            submit_query=f"""
            INSERT INTO dbo.Fact_Xmes_Notifications
            (ORDERID, NOTIFICATION_TYPE, ORDER_NOTIFICATION, DATE_SUBMITTED, SUBMITTED_BY)
            VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(submit_query, (ORDERID, NOTIFICATION_TYPE, ORDER_NOTIFICATION, current_date, SUBMITTED_BY))
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
            DELETE FROM dbo.Fact_Xmes_Notifications
            WHERE ROWID = %s
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


async def get_not_scanned_parts(ORDERID: str):
    query = """
    SELECT
        vw.BARCODE,
        vw.INFO1 AS Description
    FROM
        dbo.View_Part_Data vw
    WHERE
        vw.ORDERID = %s
        AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.Fact_Machining_Scans fw
            WHERE fw.BARCODE = vw.BARCODE
            AND fw.RESOURCE IN ('SC1', 'SC2')
            AND fw.ORDERID = vw.ORDERID
        )
    ORDER BY BARCODE
    """
    try:
        conn = connect_to_db()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(query, (ORDERID,))
        result = cursor.fetchall()
        cursor.close()
        conn.close()
        return result
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise


    ############################################################


async def get_not_scanned_byarea(ORDERID: str, RESOURCE: str):
    work_group = WORK_STATION_GROUPS.get(RESOURCE)
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
            dbo.View_Part_Data vw
        WHERE
            vw.ORDERID = %s
            AND vw.INFO2 LIKE %s
            AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.Fact_Machining_Scans fw
                WHERE fw.BARCODE = vw.BARCODE
                AND fw.RESOURCE LIKE %s
                AND fw.ORDERID = vw.ORDERID
            )
        ORDER BY BARCODE
        """
        formatted_RESOURCE = f'%{work_group}%'
        cursor.execute(query, (ORDERID, formatted_RESOURCE, RESOURCE))
        result = cursor.fetchall()       
        
        cursor.close()
        conn.close()
        return result
    
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise



############################################################

async def get_not_scanned_bymachinegroup(ORDERID: str, RESOURCE: str):
    # This retrieves machine codes from groups, ensure this mapping is available and correct
    group_members = [k for k, v in WORK_STATION_GROUPS.items() if v == RESOURCE]
    if not group_members:
        raise HTTPException(status_code=400, detail="Invalid work area or group")

    try:
        conn = connect_to_db()
        cursor = conn.cursor(as_dict=True)
        
        # Prepare placeholders for the SQL query
        placeholders = ', '.join(['%s'] * len(group_members))

        query = f"""
        WITH LatestRESOURCEs AS (
            SELECT
                fw.BARCODE,
                fw.RESOURCE,
                fw.TIMESTAMP,
                ROW_NUMBER() OVER (PARTITION BY fw.BARCODE ORDER BY fw.TIMESTAMP DESC) AS rn
            FROM
                dbo.Fact_Machining_Scans fw
        )
        SELECT
            vw.BARCODE,
            vw.CNC_BARCODE1,
            vw.INFO1 AS Description,
            vw.INFO2 AS Routing,
            lr.RESOURCE AS LastRESOURCE,
            lr.TIMESTAMP 
        FROM
            dbo.View_Part_Data vw
        LEFT JOIN
            LatestRESOURCEs lr ON vw.BARCODE = lr.BARCODE AND lr.rn = 1
        WHERE
            vw.ORDERID = %s
            AND vw.INFO2 LIKE %s
            AND (vw.CNC_BARCODE1 IS NULL OR vw.CNC_BARCODE1 <> '')
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.Fact_Machining_Scans fw
                WHERE fw.BARCODE = vw.BARCODE
                AND fw.RESOURCE IN ({placeholders})
                AND fw.ORDERID = vw.ORDERID
            )
        ORDER BY BARCODE
        """
        formatted_RESOURCE = f'%{RESOURCE}%'
        # Ensure that the parameters are in tuple form
        parameters = tuple([ORDERID, formatted_RESOURCE] + group_members)        
        
        cursor.execute(query, parameters)
        print(RESOURCE, parameters)
        result = cursor.fetchall()
        
    except Exception as e:
        print("Error in executing SQL: ", e)
        raise
    finally:
        cursor.close()
        conn.close()

    return result



############################################################


def generate_packlist(ORDERID: str):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    cursor = conn.cursor()
    try:        
        query = """
        SELECT v.BARCODE, v.INFO1, v.LENGTH, v.WIDTH, v.THICKNESS, v.MATNAME, f.TIMESTAMP, v.INFO4, v.INFO3, v.CNC_BARCODE1, v.CUSTOMER
        FROM dbo.View_Part_Data v
        LEFT JOIN dbo.Fact_Machining_Scans f 
            ON v.BARCODE = f.BARCODE 
            AND f.ORDERID = v.ORDERID
            AND f.RESOURCE IN ('SC1', 'SC2')
        WHERE v.ORDERID = %s
        AND v.BARCODE IS NOT NULL
        AND (v.CNC_BARCODE1 IS NULL OR v.CNC_BARCODE1 <> '')
        ORDER BY INFO4 DESC, INFO3;
        """
        cursor.execute(query, (ORDERID,))
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


def generate_packlist2(ORDERID: str):
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
        FROM dbo.View_Part_Data v
        WHERE v.ORDERID = %s
        GROUP BY
            v.INFO4, v.INFO1, v.LENGTH, v.WIDTH, v.THICKNESS, v.MATNAME
        ORDER BY v.INFO4 DESC, v.INFO1, v.MATNAME;
        """
        cursor.execute(query, (ORDERID,))
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



def submit_defect(ORDERID, DEFECT_TYPE, DEFECT_DETAILS, DEFECT_ACTION, EMPLOYEEID, RESOURCE, BARCODE):
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    try:
        with conn.cursor() as cursor:
            submit_query=f"""
            INSERT INTO dbo.Fact_Defects
            (ORDERID, DEFECT_TYPE, DEFECT_DETAILS, DEFECT_ACTION, DATE_SUBMITTED, EMPLOYEEID, RESOURCE, BARCODE)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(submit_query, (ORDERID, DEFECT_TYPE, DEFECT_DETAILS, DEFECT_ACTION, current_date, EMPLOYEEID, RESOURCE, BARCODE))
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
            SELECT ORDERID, DEFECT_TYPE, DEFECT_DETAILS, DEFECT_ACTION, DATE_SUBMITTED, EMPLOYEEID, RESOURCE, BARCODE
            FROM dbo.Fact_Defects
            WHERE 1=1
            """
    params = []
    # Append conditions and parameters to the list as needed
    if order_id:
        query += " AND ORDERID = %s"
        params.append(order_id)
    if defect_type:
        query += " AND DEFECT_TYPE = %s"
        params.append(defect_type)
    if defect_action:
        query += " AND DEFECT_ACTION = %s"
        params.append(defect_action)
    if work_area:
        query += " AND RESOURCE = %s"
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

def fetch_uptime_downtime(RESOURCE):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")    
    try:
        with conn.cursor() as cursor:
            query = """
            DECLARE @RESOURCE NVARCHAR(50) = %s;
            DECLARE @today DATE = CAST(GETDATE() AS DATE);
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    *,
                    LAG(TIMESTAMP) OVER (PARTITION BY RESOURCE ORDER BY TIMESTAMP) AS PrevTimestamp
                FROM
                    dbo.Fact_Machining_Scans
                WHERE
                    RESOURCE = @RESOURCE
                    AND CAST(TIMESTAMP AS DATE) = @today
            ),
            Gaps AS (
                SELECT
                    *,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP) > @gap OR PrevTimestamp IS NULL THEN 1
                        ELSE 0
                    END AS IsGap,
                    DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP) AS GapDuration
                FROM
                    Scans
            ),
            GroupedScans AS (
                SELECT
                    *,
                    SUM(IsGap) OVER (ORDER BY TIMESTAMP ROWS UNBOUNDED PRECEDING) AS GroupID
                FROM
                    Gaps
            ),
            RunTimes AS (
                SELECT
                    RESOURCE,
                    GroupID,
                    MIN(TIMESTAMP) AS StartTime,
                    MAX(TIMESTAMP) AS EndTime
                FROM
                    GroupedScans
                GROUP BY
                    RESOURCE,
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
            cursor.execute(query, (RESOURCE))
            result = cursor.fetchall()        
            return result
    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"Database query failed {e}")
    finally:
        conn.close()




def connect_and_prepare_query(RESOURCEs, start_date=None, end_date=None):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    
    RESOURCE_placeholders = ','.join(['%s'] * len(RESOURCEs))
    params = tuple(RESOURCEs)

    if start_date:
        params += (start_date,)
    if end_date:
        params += (end_date,)

    return conn, RESOURCE_placeholders, params



def fetch_uptime_all(RESOURCEs, start_date=None, end_date=None):
    conn, RESOURCE_placeholders, params = connect_and_prepare_query(RESOURCEs, start_date, end_date)
    
    try:
        with conn.cursor() as cursor:
            query = f"""
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    RESOURCE,
                    TIMESTAMP,
                    CAST(TIMESTAMP AS DATE) AS ScanDate,
                    LAG(TIMESTAMP) OVER (PARTITION BY RESOURCE, CAST(TIMESTAMP AS DATE) ORDER BY TIMESTAMP) AS PrevTimestamp
                FROM
                    dbo.Fact_Machining_Scans
                WHERE
                    RESOURCE IN ({RESOURCE_placeholders})
            """

            if start_date:
                query += " AND CAST(TIMESTAMP AS DATE) >= %s"
                params += (start_date,)
            if end_date:
                query += " AND CAST(TIMESTAMP AS DATE) <= %s"
                params += (end_date,)

            query += f"""
            ),
            Gaps AS (
                SELECT
                    RESOURCE,
                    ScanDate,
                    TIMESTAMP,
                    PrevTimestamp,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP) >= @gap THEN DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP)
                        ELSE 0
                    END AS GapDuration
                FROM
                    Scans
            ),
            DailyUptime AS (
                SELECT
                    RESOURCE,
                    ScanDate,
                    SUM(CASE WHEN PrevTimestamp IS NULL THEN 0 ELSE DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP) - GapDuration END) AS UptimeMinutes
                FROM
                    Gaps
                GROUP BY
                    RESOURCE,
                    ScanDate
            ),
            TotalUptime AS (
                SELECT
                    RESOURCE,
                    SUM(UptimeMinutes) AS TotalUptimeMinutes
                FROM
                    DailyUptime
                GROUP BY
                    RESOURCE
            )
            SELECT
                RESOURCE,
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



def fetch_downtime_all(RESOURCEs, start_date=None, end_date=None):
    conn, RESOURCE_placeholders, params = connect_and_prepare_query(RESOURCEs, start_date, end_date)
    
    try:
        with conn.cursor() as cursor:
            query = f"""
            DECLARE @gap INT = 15;

            WITH Scans AS (
                SELECT
                    RESOURCE,
                    TIMESTAMP,
                    CAST(TIMESTAMP AS DATE) AS ScanDate,
                    LAG(TIMESTAMP) OVER (PARTITION BY RESOURCE, CAST(TIMESTAMP AS DATE) ORDER BY TIMESTAMP) AS PrevTimestamp
                FROM
                    dbo.Fact_Machining_Scans
                WHERE
                    RESOURCE IN ({RESOURCE_placeholders})
            """

            if start_date:
                query += " AND CAST(TIMESTAMP AS DATE) >= %s"
                params += (start_date,)
            if end_date:
                query += " AND CAST(TIMESTAMP AS DATE) <= %s"
                params += (end_date,)

            query += f"""
            ),
            Gaps AS (
                SELECT
                    RESOURCE,
                    ScanDate,
                    CASE 
                        WHEN DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP) >= @gap THEN DATEDIFF(MINUTE, PrevTimestamp, TIMESTAMP)
                        ELSE 0
                    END AS GapDuration
                FROM
                    Scans
            ),
            DailyDowntime AS (
                SELECT
                    RESOURCE,
                    ScanDate,
                    SUM(GapDuration) AS DowntimeMinutes
                FROM
                    Gaps
                GROUP BY
                    RESOURCE,
                    ScanDate
            ),
            TotalDowntime AS (
                SELECT
                    RESOURCE,
                    SUM(DowntimeMinutes) AS TotalDowntimeMinutes
                FROM
                    DailyDowntime
                GROUP BY
                    RESOURCE
            )
            SELECT
                RESOURCE,
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



def fetch_last_scan(RESOURCE):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")    
    try:
        cursor = conn.cursor()
        query = """
        SELECT TOP 1 BARCODE, EMPLOYEEID, TIMESTAMP
        FROM dbo.Fact_Machining_Scans
        WHERE RESOURCE = %s
        ORDER BY TIMESTAMP DESC;
        """
        cursor.execute(query, (RESOURCE))
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



def fetch_joblist_daterange(RESOURCE, start_date, end_date):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    try:
        cursor = conn.cursor()
        query = """
        SELECT DISTINCT ORDERID
        FROM dbo.Fact_Machining_Scans
        WHERE RESOURCE = %s
            AND Timestamp > %s AND Timestamp < %s
        ORDER BY ORDERID
        """
        cursor.execute(query, (RESOURCE, start_date, end_date))
        results = cursor.fetchall() 
        return results
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()     
    



############################################################





def connect_and_prepare_query(RESOURCEs, start_date=None, end_date=None):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to database.")
    
    RESOURCE_placeholders = ','.join(['%s'] * len(RESOURCEs))
    params = tuple(RESOURCEs)

    if start_date:
        params += (start_date,)
    if end_date:
        params += (end_date,)

    return conn, RESOURCE_placeholders, params



def fetch_runtime_machines(ORDERID):
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
    RESOURCE_placeholders = ','.join(['%s'] * len(all_machines))
    params = tuple(all_machines) + (ORDERID,)

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
                    RESOURCE,
                    Timestamp,
                    CAST(Timestamp AS DATE) AS ScanDate,
                    LAG(Timestamp) OVER (PARTITION BY RESOURCE, CAST(Timestamp AS DATE) ORDER BY Timestamp) AS PrevTimestamp
                FROM
                    dbo.Fact_Machining_Scans
                WHERE
                    RESOURCE IN ({RESOURCE_placeholders})
                    AND ORDERID = %s
            ),
            Gaps AS (
                SELECT
                    RESOURCE,
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
                    RESOURCE,
                    ScanDate,
                    SUM(CASE WHEN PrevTimestamp IS NULL THEN 0 ELSE DATEDIFF(MINUTE, PrevTimestamp, Timestamp) - GapDuration END) AS UptimeMinutes
                FROM
                    Gaps
                GROUP BY
                    RESOURCE,
                    ScanDate
            ),
            TotalUptime AS (
                SELECT
                    RESOURCE,
                    SUM(UptimeMinutes) AS MachineTime
                FROM
                    DailyUptime
                GROUP BY
                    RESOURCE
            ),
            WorkGroupUptime AS (
                SELECT
                    ISNULL(MG.WorkGroup, TU.RESOURCE) AS WorkGroup,
                    SUM(TU.MachineTime) AS MachineTime
                FROM
                    TotalUptime TU
                LEFT JOIN
                    MachineGroups MG
                ON
                    TU.RESOURCE = MG.Machine
                GROUP BY
                    ISNULL(MG.WorkGroup, TU.RESOURCE)
            )
            SELECT
                WorkGroup AS RESOURCE,
                MachineTime
            FROM
                WorkGroupUptime

            UNION ALL

            SELECT
                'Total' AS RESOURCE,
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




###################################################



def fetch_parts_in_article(BARCODE, loadAll):
    """
    1) If the scanned part (or any ancestor) belongs to a sub-assembly that requires assembly
       (i.e., a parent with INFO2 == 'SAZ'), return ONLY that sub-assembly's children.
       - This covers scanning a child part or the parent itself of an upstream sub-assembly.

    2) Otherwise, show the entire cabinet with the 'hybrid' logic:
       - parent + NAZ => hide parent, show children
       - parent + == SAZ => show parent, hide children
       - all other parts => shown

    If loadAll is False, we skip the filtering logic and simply return the single scanned part.
    """

    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    try:
        cursor = conn.cursor()

        # ------------------------------------------------
        # STEP 1: Identify the scanned part
        # ------------------------------------------------
        scanned_query = """
            SELECT
                p.ORDERID,
                p.ARTICLE_ID,
                p.ID,
                p.INFO2,
                p.PARENTID
            FROM dbo.Part p
            WHERE p.BARCODE = %s
        """
        cursor.execute(scanned_query, (BARCODE,))
        scanned_row = cursor.fetchone()

        if not scanned_row:
            return {"message": "No part found for that BARCODE."}

        order_id, article_id, scanned_id, scanned_info2, scanned_parentid = scanned_row
        if not article_id:
            return {"message": "No article data available for the provided BARCODE."}

        scanned_info2 = (scanned_info2 or "").upper()

        # ------------------------------------------------
        # If loadAll = False => Return ONLY the scanned part, no additional logic
        # ------------------------------------------------
        if not loadAll:
            # Just fetch the single part's details (similar to your old function),
            # making sure we return a list-of-dicts for consistency
            single_part_query = """
                SELECT 
                    p.ORDERID,
                    p.ID, 
                    p.PARENTID, 
                    p.BARCODE, 
                    p.INFO1, 
                    p.INFO2,
                    a.INFO3 AS CabinetNumber,
                    p.ARTICLE_ID
                FROM dbo.Part p
                LEFT JOIN dbo.Article a 
                    ON p.ORDERID = a.ORDERID
                    AND p.ARTICLE_ID = a.ID                
                WHERE p.BARCODE = %s
            """
            cursor.execute(single_part_query, (BARCODE, ))
            columns = [desc[0] for desc in cursor.description]
            single_row = cursor.fetchone()

            if not single_row:
                return {"message": "No part data found for the provided BARCODE."}

            part_data = dict(zip(columns, single_row))
            # You can add or remove fields here if you like, or join Article for CabinetNumber
            # return [part_data]
            return {
                "parts": part_data
            }

        # ------------------------------------------------
        # STEP 2: (loadAll = True) Fetch the entire cabinet
        # ------------------------------------------------
        cabinet_query = """
            SELECT 
                p.ORDERID,
                p.ID, 
                p.PARENTID, 
                p.BARCODE, 
                p.INFO1, 
                p.INFO2, 
                a.INFO3 AS CabinetNumber,
                p.ARTICLE_ID
            FROM dbo.Part p
            LEFT JOIN dbo.Article a 
                ON p.ORDERID = a.ORDERID 
               AND p.ARTICLE_ID = a.ID
            WHERE p.ORDERID = %s 
              AND p.ARTICLE_ID = %s
            ORDER BY BARCODE
        """
        cursor.execute(cabinet_query, (order_id, article_id))

        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        if not rows:
            return {"message": "No parts or article data found for this cabinet."}

        all_parts = [dict(zip(columns, r)) for r in rows]
        part_dict = {p["ID"]: p for p in all_parts}

        # ------------------------------------------------
        # STEP 3: Check for upstream sub-assembly needing assembly
        # ------------------------------------------------
        def get_parent_id(pid):
            return part_dict[pid]["PARENTID"] if pid in part_dict else None

        def get_info2(pid):
            return (part_dict[pid].get("INFO2") or "").upper() if pid in part_dict else ""

        def has_children(pid):
            return any(child for child in all_parts if child["PARENTID"] == pid)

        current_id = scanned_id
        assembly_parent_id = None

        # Walk up the chain until no more parents
        while True:
            parent_id = get_parent_id(current_id)
            if not parent_id:
                break

            parent_info2 = get_info2(parent_id)
            # If that parent is a sub-assembly requiring assembly:
            if has_children(parent_id) and parent_info2 == "SAZ":
                assembly_parent_id = parent_id
                break
            else:
                current_id = parent_id

        if assembly_parent_id:
            # Return only that sub-assembly's children
            sub_assembly_children = [
                p for p in all_parts if p["PARENTID"] == assembly_parent_id
            ]
            if not sub_assembly_children:
                return {"message": "No children found for that sub-assembly."}
            return {
                "parts": sub_assembly_children,
                "is_sub_assembly": True  # Flag indicating these are sub-assembly children
            }

        # ------------------------------------------------
        # STEP 4: Logic for the entire cabinet
        # ------------------------------------------------
        used_as_parent_ids = {part["PARENTID"] for part in all_parts if part["PARENTID"]}
        final_parts = []

        for part in all_parts:
            pid = part["ID"]
            parent_id = part["PARENTID"]
            info2 = (part["INFO2"] or "").upper()
            is_parent = (pid in used_as_parent_ids)

            if is_parent:
                # Parent + NAZ => hide parent, show children
                if info2 == "NAZ":
                    continue
                else:
                    # Parent + != NAZ => show parent, hide children
                    final_parts.append(part)
            else:
                # Not a parent => child or top-level
                if parent_id:
                    parent_part = part_dict.get(parent_id)
                    if parent_part:
                        parent_info2 = (parent_part.get("INFO2") or "").upper()
                        if parent_info2 == "NAZ":
                            # Child of NAZ => keep
                            final_parts.append(part)
                        else:
                            # Child of non-NAZ => hide
                            continue
                    else:
                        # Parent not found => keep by default
                        final_parts.append(part)
                else:
                    # Top-level (no parent) => keep
                    final_parts.append(part)

        if not final_parts:
            return {"message": "No parts left after hybrid filtering."}

        return {
            "parts": final_parts,
            "is_sub_assembly": False  # Flag indicating these are not sub-assembly children
        }

    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close()



###################################################



def fetch_used_article(identifier):
    try:
        conn = connect_to_db()
        if conn is None:
            raise Exception("Failed to connect to the database.")
        
        cursor = conn.cursor()
        query = """
            SELECT 
                USED_ORDERID AS ORDERID,                
                BARCODE,
                DESCRIPTION AS INFO1,
                CAB_INFO3 AS CabinetNumber,
                USED_ARTICLEID AS ARTICLE_ID
            FROM dbo.Fact_Part_Usage
            WHERE USED_IDENTIFIER = %s
        """
        cursor.execute(query, (identifier,))
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        if not rows:
            return {"message": "No parts or article data found for this cabinet."}
        # Convert each row into a dict
        all_parts = [dict(zip(columns, row)) for row in rows]

        # Return them under a "parts" key for consistency
        return {"parts": all_parts}
    except Exception as e:
        raise Exception(f"Database query failed: {e}")
    finally:
        conn.close



###################################################


def check_parts_exist_in_db(BARCODEs):
    try:
        conn = connect_to_db()
        if conn is None:
            raise Exception("Failed to connect to the database.")

        cursor = conn.cursor()
        query = f"SELECT BARCODE FROM dbo.Fact_Part_Usage WHERE BARCODE IN ({','.join(['%s'] * len(BARCODEs))})"
        cursor.execute(query, tuple(BARCODEs))
        existing_BARCODEs = {row[0] for row in cursor.fetchall()}

        conn.close()
        return existing_BARCODEs
    except Exception as e:
        raise e
    finally:
        if conn:
            conn.close()




def submit_parts_usage(parts, timestamp):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    cursor = conn.cursor()
    try:
        insert_query = """
            INSERT INTO dbo.Fact_Part_Usage (
                [BARCODE], [DESCRIPTION], [CAB_INFO3], [ORIGINAL_ORDERID], [ORIGINAL_ARTICLEID], [TIMESTAMP], 
                [EMPLOYEEID], [RESOURCE], [CUSTOMERID],  
                [STATUS], [USED_ORDERID], [USED_ARTICLEID], [USED_IDENTIFIER]
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = [
            (
                part["Barcode"], part["Description"], part["Cab_Info3"], part["OrderID"], part["Article_ID"], timestamp,
                part["EmployeeID"], part["Resource"], part["CustomerID"],
                part["Status"], part["Used_OrderID"], part["Used_ArticleID"], part["Used_Identifier"]
            ) for part in parts
        ]

        # Execute multiple insert queries at once
        cursor.executemany(insert_query, values)
        conn.commit()

        return {"message": "Insert successful", "rows_affected": cursor.rowcount}

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


   

###################################################


 
def start_article_time(article:ArticleTimeData, timestamp: datetime):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    cursor = conn.cursor()
    try:

        query_status = """
            SELECT TOP 1 STATUS
            FROM dbo.Fact_Assembly_Time_Tracking
            WHERE ARTICLE_IDENTIFIER = %s
            AND RESOURCE = %s
            ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(query_status, (article.ARTICLE_IDENTIFIER, article.RESOURCE)) # ✅ Ensure this is a tuple
        last_status_row = cursor.fetchone()

        if last_status_row:
            last_status = last_status_row[0] # ✅ Extract status from the tuple
            if last_status == "Complete":
                raise ValueError("This article has already been marked complete. No new entry added.")


        # Step 1: Check the last recorded entry
        query_last_entry = """
            SELECT TOP 1 START_TIME, STOP_TIME 
            FROM dbo.Fact_Assembly_Time_Tracking 
            WHERE ARTICLE_IDENTIFIER = %s 
            AND RESOURCE = %s
            ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(query_last_entry, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        last_entry = cursor.fetchone()

        if last_entry:
            last_start_time, last_stop_time = last_entry

            # ❌ If last entry was a START_TIME without a STOP_TIME, raise a ValueError
            if last_start_time and not last_stop_time:
                raise ValueError("A start time has already been recorded without a corresponding stop. Please submit a stop time first.")
            
        # Step 2: Insert new START_TIME
        insert_query = """
            INSERT INTO dbo.Fact_Assembly_Time_Tracking (
                ARTICLE_IDENTIFIER, ORDERID, CAB_INFO3, ARTICLE_ID, 
                EMPLOYEEID, RESOURCE, CUSTOMERID, 
                STATUS, START_TIME
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
                article.ARTICLE_IDENTIFIER, article.ORDERID, article.CAB_INFO3, article.ARTICLE_ID,
            article.EMPLOYEEID, article.RESOURCE, article.CUSTOMERID,
            "In Progress", timestamp
            ) 

        # Execute multiple insert queries at once
        cursor.execute(insert_query, values)
        conn.commit()

        return {"message": "Insert successful", "rows_affected": cursor.rowcount}

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


###################################################


 
def stop_article_time(article: ArticleTimeData, timestamp: datetime):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")

    cursor = conn.cursor()
    try:
        eastern = pytz.timezone('America/New_York')  # Define timezone

        # Step 1: Check the most recent scan
        query_last_entry = """
            SELECT TOP 1 START_TIME, STOP_TIME 
            FROM dbo.Fact_Assembly_Time_Tracking 
            WHERE ARTICLE_IDENTIFIER = %s 
            AND RESOURCE = %s
            ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(query_last_entry, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        last_entry = cursor.fetchone()

        if last_entry:
            last_start_time, last_stop_time = last_entry

            # If last entry was a STOP_TIME without a new START_TIME, prevent new stop
            if last_stop_time and (last_start_time is None or last_start_time < last_stop_time):
                raise ValueError("A stop time has already been recorded without a corresponding start. Please submit a start time first.")

        # Step 2: Get the latest START_TIME to calculate assembly time
        query_latest_start = """
            SELECT TOP 1 START_TIME 
            FROM dbo.Fact_Assembly_Time_Tracking 
            WHERE ARTICLE_IDENTIFIER = %s 
            AND RESOURCE = %s
            AND START_TIME IS NOT NULL 
            ORDER BY START_TIME DESC
        """
        cursor.execute(query_latest_start, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        latest_start_row = cursor.fetchone()

        assembly_time = None  # Default if no start time found

        if latest_start_row:
            start_time = latest_start_row[0]

            # Ensure START_TIME is timezone-aware
            if start_time.tzinfo is None:
                start_time = eastern.localize(start_time)  # Convert to Eastern Time

            # Ensure STOP_TIME is also in the same timezone
            timestamp = timestamp.astimezone(eastern)

            # Step 2: Calculate ASSEMBLY_TIME
            assembly_time = (timestamp - start_time).total_seconds()

        # Step 3: Insert stop time with assembly time
        insert_query = """
            INSERT INTO dbo.Fact_Assembly_Time_Tracking (
                ARTICLE_IDENTIFIER, ORDERID, CAB_INFO3, ARTICLE_ID, 
                EMPLOYEEID, RESOURCE, CUSTOMERID, 
                STATUS, STOP_TIME, ASSEMBLY_TIME
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            article.ARTICLE_IDENTIFIER, article.ORDERID, article.CAB_INFO3, article.ARTICLE_ID,
            article.EMPLOYEEID, article.RESOURCE, article.CUSTOMERID,
            "In Progress", timestamp, assembly_time
        )

        cursor.execute(insert_query, values)
        conn.commit()

        return {"message": "Stop time recorded with assembly time", "assembly_time": assembly_time}

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()



###################################################



def complete_article_time(article: ArticleTimeData, timestamp: datetime):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    cursor = conn.cursor()
    try:
        eastern = pytz.timezone('America/New_York')  # Define timezone

         # Step 1: Check if the article is already marked as complete in Fact_Article_Status
        check_completion_query = """
            SELECT COUNT(*) 
            FROM dbo.Fact_Article_Status 
            WHERE ARTICLE_IDENTIFIER = %s 
            AND RESOURCE = %s
            AND STATUS = 'Complete'
        """
        cursor.execute(check_completion_query, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        existing_completion = cursor.fetchone()[0]

        if existing_completion > 0:
            raise ValueError("This article has already been marked as complete. No new entry added.")

         # Step 2: Check the last recorded entry to ensure it was a stop scan
        query_last_entry = """
            SELECT TOP 1 START_TIME, STOP_TIME 
            FROM dbo.Fact_Assembly_Time_Tracking 
            WHERE ARTICLE_IDENTIFIER = %s 
            AND RESOURCE = %s
            ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(query_last_entry, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        last_entry = cursor.fetchone()

        if last_entry:
            last_start_time, last_stop_time = last_entry

            # If last entry was a START_TIME without a STOP_TIME, prevent completion
            if last_start_time and not last_stop_time:
                raise ValueError("The last recorded scan was a start scan. A stop scan must be recorded before marking the article as complete.")

        # Step 3: Update the most recent STOP_TIME entry to "Complete"
        update_last_stop_query = """
            UPDATE dbo.Fact_Assembly_Time_Tracking
            SET STATUS = 'Complete'
            WHERE ARTICLE_IDENTIFIER = %s
            AND RESOURCE = %s
            AND STOP_TIME = (SELECT MAX(STOP_TIME) 
                             FROM dbo.Fact_Assembly_Time_Tracking 
                             WHERE ARTICLE_IDENTIFIER = %s
                             AND RESOURCE = %s)
        """
        cursor.execute(update_last_stop_query, (article.ARTICLE_IDENTIFIER, article.RESOURCE, article.ARTICLE_IDENTIFIER, article.RESOURCE))
        
        # Step 4: Calculate total assembly time (sum of all assembly times for the article)
        sum_assembly_time_query = """
            SELECT SUM(ASSEMBLY_TIME) 
            FROM dbo.Fact_Assembly_Time_Tracking 
            WHERE ARTICLE_IDENTIFIER = %s
            AND RESOURCE = %s
        """
        cursor.execute(sum_assembly_time_query, (article.ARTICLE_IDENTIFIER, article.RESOURCE))
        total_seconds = cursor.fetchone()[0]

        if total_seconds is None:
            total_seconds = 0  # Default to zero if no records exist

        # Convert total seconds to HH:MM:SS format
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        formatted_time = f"{hours:02}:{minutes:02}:{seconds:02}"

        # Step 3: Insert data into `dbo.Fact_Article_Status`
        insert_complete_status_query = """
            INSERT INTO dbo.Fact_Article_Status (
                ARTICLE_IDENTIFIER, ORDERID, CAB_INFO3, ARITICLE_ID,
                EMPLOYEEID, RESOURCE, CUSTOMERID,
                STATUS, TIMESTAMP, ASSEMBLY_TIME
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            article.ARTICLE_IDENTIFIER, article.ORDERID, article.CAB_INFO3, article.ARTICLE_ID,
            article.EMPLOYEEID, article.RESOURCE, article.CUSTOMERID,
            "Complete", timestamp, formatted_time  # Storing total assembly time as HH:MM:SS
        )

        cursor.execute(insert_complete_status_query, values)

        # Commit all transactions
        conn.commit()

        return {"message": "Article marked as complete", "total_assembly_time": formatted_time}


    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()



###################################################



def check_part_status(BARCODE):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    cursor = conn.cursor(as_dict=True)
    try:
        # Check if the part exists in Fact_Part_Usage
        check_part_usage_query = """
        SELECT USED_IDENTIFIER AS ARTICLE_IDENTIFIER
        FROM dbo.Fact_Part_Usage
        WHERE BARCODE = %s
        """
        cursor.execute(check_part_usage_query, (BARCODE,))
        part_record = cursor.fetchone() 

        if not part_record:
            return {"part_status": "new", "assembly_status": None, "article_status": None}
        
        article_id = part_record["ARTICLE_IDENTIFIER"]

        # Check assembly status in Fact_Assembly_Time_Tracking
        check_assembly_status_query = """
        SELECT TOP 1 START_TIME, STOP_TIME, STATUS
        FROM dbo.Fact_Assembly_Time_Tracking
        WHERE ARTICLE_IDENTIFIER = %s
        ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(check_assembly_status_query, (article_id,))
        assembly_record = cursor.fetchone()

        # Default to "No Record" if no assembly entry is found
        assembly_status = "no record"
        if assembly_record:
            status = assembly_record.get("STATUS", "").strip()  # Ensure safe access
            stop_time = assembly_record.get("STOP_TIME")  # Safe access to STOP_TIME

            if status == "In Progress" and stop_time is None:
                assembly_status = "running"
            elif status == "In Progress" and stop_time is not None:
                assembly_status = "stopped"
            elif status == "Complete":
                assembly_status = "complete"
        
        # Check if the article is completed in Article_Status
        check_article_status_query = """
        SELECT STATUS 
        FROM dbo.Fact_Article_Status
        WHERE ARTICLE_IDENTIFIER = %s
        """
        cursor.execute(check_article_status_query, (article_id,))
        article_record = cursor.fetchone()

        article_status = article_record["STATUS"] if article_record else "none"

        return {
            "part_status": "used",
            "assembly_status": assembly_status,
            "article_status": article_status,
            "article_identifier": article_id
        }
    finally:
        conn.close()



####################################################


def check_part_status_resource(BARCODE, RESOURCE):
    conn = connect_to_db()
    if conn is None:
        raise Exception("Failed to connect to the database.")
    
    cursor = conn.cursor(as_dict=True)
    try:
        # Check if the part exists in Fact_Part_Usage
        check_part_usage_query = """
        SELECT USED_IDENTIFIER AS ARTICLE_IDENTIFIER
        FROM dbo.Fact_Part_Usage
        WHERE BARCODE = %s
        """
        cursor.execute(check_part_usage_query, (BARCODE,))
        part_record = cursor.fetchone() 

        if not part_record:
            return {"part_status": "new", "assembly_status": None, "article_status": None}
        
        article_id = part_record["ARTICLE_IDENTIFIER"]

        # Check assembly status in Fact_Assembly_Time_Tracking
        check_assembly_status_query = """
        SELECT TOP 1 START_TIME, STOP_TIME, STATUS
        FROM dbo.Fact_Assembly_Time_Tracking
        WHERE ARTICLE_IDENTIFIER = %s
        AND RESOURCE = %s
        ORDER BY COALESCE(STOP_TIME, START_TIME) DESC
        """
        cursor.execute(check_assembly_status_query, (article_id, RESOURCE))
        assembly_record = cursor.fetchone()

        # Default to "No Record" if no assembly entry is found
        assembly_status = "no record"
        if assembly_record:
            status = assembly_record.get("STATUS", "").strip()  # Ensure safe access
            stop_time = assembly_record.get("STOP_TIME")  # Safe access to STOP_TIME

            if status == "In Progress" and stop_time is None:
                assembly_status = "running"
            elif status == "In Progress" and stop_time is not None:
                assembly_status = "stopped"
            elif status == "Complete":
                assembly_status = "complete"
        
        # Check if the article is completed in Article_Status
        check_article_status_query = """
        SELECT STATUS 
        FROM dbo.Fact_Article_Status
        WHERE ARTICLE_IDENTIFIER = %s
        AND RESOURCE = %s
        """
        cursor.execute(check_article_status_query, (article_id, RESOURCE))
        article_record = cursor.fetchone()

        article_status = article_record["STATUS"] if article_record else "none"

        return {
            "part_status": "used",
            "assembly_status": assembly_status,
            "article_status": article_status,
            "article_identifier": article_id
        }
    finally:
        conn.close()



####################################################
   


def fetch_assembly_order_status(ORDERID: str):
    """
    Fetch the assembly order status from the database.
    """
    conn = connect_to_db()
    if conn is None:
        raise ValueError("Failed to connect to the database.")
    
    cursor = conn.cursor()
    try:
        # Fetch articles with routing info
        query = """
        SELECT ORDERID, NAME, INFO1, INFO2, INFO3, ARTICLE_ID
        FROM dbo.Article
        WHERE ORDERID = %s
        """
        cursor.execute(query, (ORDERID,))
        articles = cursor.fetchall()

        result = []
        
        for article in articles:
            order_id, name, info1, info2, info3, article_id = article
            
            # Generate ARTICLE_IDENTIFIER (ORDERID_ARTICLE_ID)
            article_identifier = f"{order_id}_{article_id}"
            
            # Extract valid routing steps from INFO2
            routing_steps = [ws for ws in ASSEMBLY_WORK_STATIONS if ws and ws in info2]
            total_operations = len(routing_steps)

            if total_operations == 0:
                completion_percentage = "0%"
                completed_steps = 0
            else:
                # Dynamically format SQL with placeholders
                placeholders = ", ".join(["%s"] * len(routing_steps))
                sql_query = f"""
                    SELECT COUNT(DISTINCT RESOURCE) 
                    FROM dbo.Fact_Assembly_Time_Tracking 
                    WHERE ARTICLE_IDENTIFIER = %s 
                    AND RESOURCE IN ({placeholders}) 
                    AND STATUS = 'complete'
                """
                
                # Execute query with parameters (ARTICLE_IDENTIFIER first, then routing steps)
                cursor.execute(sql_query, (article_identifier, *routing_steps))
                
                completed_steps = cursor.fetchone()[0] or 0
                
                # Calculate completion percentage
                completion_percentage = f"{round((completed_steps / total_operations) * 100, 2)}%"

            result.append({
                "ORDERID": order_id,
                "NAME": name,
                "INFO1": info1,
                "INFO2": info2,
                "INFO3": info3,
                "ARTICLE_ID": article_id,
                "Completed_Steps": completed_steps,
                "Total_Operations": total_operations,
                "Completion_Percentage": completion_percentage
            })


        return result

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()



####################################################
   


def fetch_assembly_order_times(ORDERID):
    conn = connect_to_db()
    if conn is None:
        raise ValueError("Failed to connect to the database.")
    
    cursor = conn.cursor()
    try:
        # Fetch articles with routing info
        query = """
        SELECT 
            ORDERID, 
            RESOURCE, 
            SUM(ASSEMBLY_TIME) AS TOTAL_ASSEMBLY_TIME_SECONDS, 
            CAST(DATEADD(SECOND, SUM(ASSEMBLY_TIME), 0) AS TIME) AS TOTAL_ASSEMBLY_TIME
        FROM dbo.Fact_Assembly_Time_Tracking
        WHERE ORDERID = %s
        GROUP BY ORDERID, RESOURCE
        ORDER BY ORDERID, RESOURCE
        """
        cursor.execute(query, (ORDERID,))

        # Get column names from cursor description
        columns = [desc[0] for desc in cursor.description]
        
        # Convert each row to a dictionary
        result = [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]
        
        return result

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

        