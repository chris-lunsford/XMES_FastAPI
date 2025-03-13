from datetime import datetime
import datetime
import pytz
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Request, HTTPException, Query, Response
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List

from work_stations import WORK_STATIONS
from work_station_groups import WORK_STATION_GROUPS
from assembly_work_stations import ASSEMBLY_WORK_STATIONS
from customer_ids import CUSTOMER_IDS
from notification_types import NOTIFICATION_TYPES
from defect_types import DEFECT_TYPES
from defect_actions import DEFECT_ACTIONS
from sql_functions import *
from models import *
from ttc_plugin import router as ttc_router



app = FastAPI()


# Include TTC Plugin router with a specific prefix
app.include_router(
    ttc_router,
    prefix="/ttc-plugin",  # Prefix all TTC plugin routes
    tags=["TTC Plugin"]    # Organize documentation by tags
)


templates  = Jinja2Templates(directory="templates")


app.mount("/templates", StaticFiles(directory="templates"), name="templates")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")



@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return PlainTextResponse(str(exc), status_code=400)


@app.get('/', tags=["Pages"], response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/home', tags=["Pages"], response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get('/machine-production', tags=["Pages"])
async def production(request: Request):
    return templates.TemplateResponse("machine_production.html", {"request": request})

@app.get('/assembly-production', tags=["Pages"])
async def production(request: Request):
    return templates.TemplateResponse("assembly_production.html", {"request": request})

@app.get('/machine-dashboard', tags=["Pages"])
async def machine_dashboard(request: Request):
    return templates.TemplateResponse("machinedashboard.html", {"request": request})

@app.get('/notification', tags=["Pages"])
async def notification(request: Request):
    return templates.TemplateResponse("submitnotification.html", {"request": request})

@app.get('/order-dashboard', tags=["Pages"])
async def order_dashboard(request: Request):
    return templates.TemplateResponse("orderdashboard.html", {"request": request})

@app.get('/defect-dashboard', tags=["Pages"])
async def defect_dashboard(request: Request):
    return templates.TemplateResponse("defectdashboard.html", {"request": request})

@app.get('/ttc-plugin', tags=["Pages"], response_class=HTMLResponse)
async def ttc_plugin(request: Request, response: Response):
    # Set the cookie if it's not already set
    if "my_cookie" not in request.cookies:
        response.set_cookie(key="my_cookie", value="cookie_value", samesite="None")
    
    # Render the TTC Plugin template
    return templates.TemplateResponse("ttcplugin.html", {"request": request})

 

@app.get('/api/work-stations', tags=["Lists"])
async def get_work_stations():
    return WORK_STATIONS

@app.get('/api/assembly-work-stations', tags=["Lists"])
async def get_work_stations():
    return ASSEMBLY_WORK_STATIONS


class WorkStationGroups(BaseModel):
    groups: Dict[str, str]

@app.get("/api/work-station-groups", tags=["Lists"], response_model=WorkStationGroups)
async def get_work_station_groups():
    return WorkStationGroups(groups=WORK_STATION_GROUPS)


@app.get('/api/customer-ids', tags=["Lists"])
async def get_customer_ids():
    return CUSTOMER_IDS

@app.get('/api/defect-types', tags=["Lists"])
async def get_defect_types():
    return DEFECT_TYPES

@app.get('/api/defect-actions', tags=["Lists"])
async def get_defect_actions():
    return DEFECT_ACTIONS

@app.get("/api/machine-status", tags=["Machine Status"])
async def machine_status():
    last_timestamps = fetch_last_timestamp()
    return last_timestamps



class DateForm(BaseModel):
    startDate: Optional[str]
    endDate: Optional[str] 

@app.post('/api/dateForm', tags=["Machine Status"])
async def machine_part_counts(form_data: DateForm):
    if form_data.startDate is None or form_data.endDate is None:
        raise HTTPException(status_code=400, detail="Start date and end date are required.")
    results = fetch_machine_part_counts(form_data.startDate, form_data.endDate)
    if not results:
        raise HTTPException(status_code=404, detail="No data found for given dates")
    return results



class BarcodeData(BaseModel):
    Barcode: str
    OrderID: str
    EmployeeID: str
    Resource: str
    CustomerID: str
    forceContinue: bool = False  

@app.post('/api/barcode-scan-Submit', tags=["Machine Production"])
async def handle_barcode_scan_to_db(data: BarcodeData):
    try:
        # Create a timezone object for Eastern Time
        eastern = pytz.timezone('America/New_York')
        # Get the current time in UTC
        now_utc = datetime.now(pytz.utc)
        # Convert the current time from UTC to Eastern Time
        now_eastern = now_utc.astimezone(eastern)
        # Format the timestamp as a string without timezone information, suitable for SQL Server
        timestamp = now_eastern.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]  # Trims microseconds to milliseconds

        result = barcode_scan_to_db(
            data.Barcode, 
            data.OrderID, 
            timestamp,
            data.EmployeeID,
            data.Resource,
            data.CustomerID,
            forceContinue=data.forceContinue  # Pass the forceContinue flag to the function
            )
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        if "Duplicate barcode; recut possible?" in str(e):
            return JSONResponse(status_code=200, content={'warning': "duplicate_barcode", 'detail': str(e)})
        elif "not expected at work area" in str(e):
            return JSONResponse(status_code=200, content={'warning': "not_at_resource", "detail": str(e)})
        elif "not expected in the system" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        # Log the full stack trace to help diagnose the issue
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An error occurred while processing the request.")
    



class BarcodeRecutData(BaseModel):
    Barcode: str
    OrderID: str
    Resource: str
    Recut: int

@app.post('/api/update-recut-status', tags=["Machine Production"])
async def update_recut_status(data: BarcodeRecutData):
    try:
        print("Received data for recut:", data)
        result = update_recut_in_db(data.Barcode, data.OrderID, data.Resource, data.Recut)
        return {"message": "Recut status updated successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get('/api/employee-areaparts-count', tags=["Part Counts"])
async def employee_areaparts_count(EmployeeID, Resource):
    try:
        count = get_employee_areaparts_count(EmployeeID, Resource)
        return {"area_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get('/api/employee-totalparts-count', tags=["Part Counts"])
async def employee_totalparts_count(EmployeeID):
    try:
        count = get_employee_totalparts_count(EmployeeID)
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/order-area-scanned-count', tags=["Part Counts"])
async def order_area_scanned_count(OrderID, Resource, EmployeeID):
    try:
        count = get_order_area_scanned_count(OrderID, Resource, EmployeeID)
        return {"scanned_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/order-total-area-count', tags=["Part Counts"])
async def order_totalarea_count(OrderID, Resource):
    Resource_Group = get_resource_group(Resource)
    try:
        count = get_order_totalarea_count(OrderID, Resource_Group)
        return {"area_total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/order-machinegroup-scan-count', tags=["Part Counts"])
async def order_machinegroup_scan_count(OrderID, Resource):
    try:
        count = get_order_machinegroup_scan_count(OrderID, Resource)
        return {"order_machinegroup_scan_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/order-total-count', tags=["Part Counts"])
async def order_total_count(OrderID):
    try:
        count = get_order_total_count(OrderID)
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/employee-joblist-day/', tags=["Machine Production"])
async def employee_joblist_day(EmployeeID):
    try:
        job_list = get_employee_joblist_day(EmployeeID)
        return {"job_list": job_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/jobid-notifications', tags=["Job Notifications"])
async def jobid_notifications(OrderID):
    try:
        notification_list = get_jobid_notifications(OrderID)
        return {"notification_list": notification_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/notification-types', tags=["Lists"])
async def get_notification_types():
    return NOTIFICATION_TYPES


class NotificationData(BaseModel):
    OrderID: str
    NotificationType: str
    OrderNotification: str
    SubmittedBy: str


@app.post('/api/submit-order-notification', tags=["Job Notifications"])
async def handle_submit_order_notification(data: NotificationData):
    try:
        result = submit_order_notification(
            data.OrderID, 
            data.NotificationType, 
            data.OrderNotification, 
            data.SubmittedBy)
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))
    

@app.delete('/api/delete-order-notification', tags=["Job Notifications"])
async def handle_delete_order_notificatino(notificationID: int):
    try:
        result = delete_order_notification(notificationID)
        return {"message": result}
    except ConnectionError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    


@app.get('/api/order-part-counts', tags=["Part Counts"])
async def handle_order_part_counts(OrderID):
    try:
        counts = get_order_part_counts(OrderID)
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/scanned-order-part-counts', tags=["Part Counts"])
async def handle_scanned_order_part_counts(OrderID: str):
    loop = asyncio.get_running_loop()
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        data = await loop.run_in_executor(executor, fetch_scanned_order_part_counts_data, OrderID)
        counts = process_scanned_order_part_counts_data(data)
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        executor.shutdown(wait=True)
    

@app.get('/api/parts-not-scanned-by-shipping', tags=["Part Not Scanned"])
async def handle_parts_not_scanned_by_shipping(OrderID: str):
    try:
        return await get_not_scanned_parts(OrderID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/parts-not-scanned-by-area', tags=["Part Not Scanned"])
async def handle_parts_not_scanned_by_area(OrderID: str, Resource: str):
    try:
        return await get_not_scanned_byarea(OrderID, Resource)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/parts-not-scanned-by-group', tags=["Part Not Scanned"])
async def handle_parts_not_scanned_by_group(OrderID: str, Resource: str):
    try:
        return await get_not_scanned_bymachinegroup(OrderID, Resource)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# Define a custom filter for converting mm to inches
def mm_to_inches(value):
    if value is None:
        return ''
    try:
        inches = round(value * 0.0393701, 3)  # Convert mm to inches and round to 2 decimal places
        return f"{inches:.3f}in"
    except (ValueError, TypeError):
        return value
    
# Define a custom filter for formatting the timestamp
def format_date(value):
    if value is None:
        return ''
    try:
        print(f"Original value: {value}")  # Debugging line
        formatted_date = value.strftime("%m-%d-%Y | %H:%M")
        print(f"Formatted date: {formatted_date}")  # Debugging line
        return formatted_date
    except (ValueError, TypeError)as e:
        print(f"Error formatting date: {e}")  # Debugging line
        return value

# Register the filter with Jinja2
templates.env.filters['mm_to_inches'] = mm_to_inches
templates.env.filters['format_date'] = format_date


@app.get('/api/generate-packlist', tags=["Packlist"])
async def handle_generate_packlist(request: Request, OrderID: str):
    try:
        data, customer_name = generate_packlist(OrderID)
        return templates.TemplateResponse("packlist_template.html", {
            "request": request,
            "data": data,
            "order_id": OrderID,
            "customer_name": customer_name 
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/generate-packlist2', tags=["Packlist"])
async def handle_generate_packlist2(request: Request, OrderID: str):
    try:
        data, customer_name = generate_packlist2(OrderID)
        return templates.TemplateResponse("packlist_template2.html", {
            "request": request,
            "data": data,
            "order_id": OrderID,
            "customer_name": customer_name 
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class DefectData(BaseModel):
    OrderID: str
    DefectType: str
    DefectDetails: str
    DefectAction: str
    EmployeeID: str
    Resource: str
    Barcode: str

@app.post('/api/submit-defect', tags=["Defects"])
async def handle_submit_defect(data: DefectData):
    try:
        result = submit_defect(
            data.OrderID, 
            data.DefectType, 
            data.DefectDetails, 
            data.DefectAction,
            data.EmployeeID,
            data.Resource,
            data.Barcode
            )
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/fetch-defects', tags=["Defects"])
async def handle_fetch_defects(order_id: Optional[str] = None, 
                               defect_type: Optional[str] = None, 
                               defect_action: Optional[str] = None, 
                               work_area: Optional[str] = None):
    try:
        result = fetch_defect_list(order_id, defect_type, defect_action, work_area)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/fetch-uptime-all', tags=["Runtime"])
async def handle_fetch_uptime_all(
    resources: List[str] = Query(WORK_STATIONS),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
    ):
    try:
        result = fetch_uptime_all(resources, start_date, end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/fetch-downtime-all', tags=["Runtime"])
async def handle_fetch_downtime_all(
    resources: List[str] = Query(WORK_STATIONS),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
    ):
    try:
        result = fetch_downtime_all(resources, start_date, end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/fetch-last-scan', tags=["Machine Status"])
async def handle_fetch_last_scan(resource: str):
    try:
        result = fetch_last_scan(resource)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/fetch-joblist-daterange', tags=["Machine Status"])
async def handle_fetch_joblist_daterange(resource: str, start_date: str, end_date: str):
    try:
        result = fetch_joblist_daterange(resource, start_date, end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/fetch-runtime-machines', tags=["Order Status"])
async def handle_fetch_runtime_machines(orderid: str):
    try:
        result = fetch_runtime_machines(orderid)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/fetch-parts-in-article', tags=["Assembly Production"])
async def handle_fetch_parts_in_article(barcode: str, loadAll: bool = True):
    try:
        result = fetch_parts_in_article(barcode, loadAll)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=(e))   
    
 
@app.get('/api/fetch-used-article', tags=["Assembly Production"])
def handle_fetch_used_cabinet(identifier: str):  
    try:
        result = fetch_used_article(identifier)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detial=(e))


@app.get('/api/check_part_status/', tags=["Assembly Production"])
async def handle_check_part_status(barcode: str):
    try:
        status = check_part_status(barcode)
        return(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post('/api/check-parts-exist', tags=["Assembly Production"])
async def check_parts_exist(data: dict):
    try:
        barcodes = data.get("barcodes", [])
        if not barcodes:
            raise HTTPException(status_code=400, detail="No barcodes provided")

        existing_barcodes = check_parts_exist_in_db(barcodes)
        return {"existingBarcodes": existing_barcodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/submit-parts-usage', tags=["Assembly Production"])
async def handle_submit_parts_usage(data: dict):
    try:
        eastern = pytz.timezone('America/New_York')
        now_eastern = datetime.now(pytz.utc).astimezone(eastern)

        parts = data.get("parts", [])
        if not parts:
            raise HTTPException(status_code=400, detail="No parts provided")

        result = submit_parts_usage(parts, now_eastern)
        return {"message": "Entries added successfully", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))  


@app.post('/api/start-article-time', tags=["Assembly Production"])
async def handle_start_article_time(article: ArticleTimeData):
    try:
        # Create a timezone object for Eastern Time
        eastern = pytz.timezone('America/New_York')
        # Get the current time in UTC and convert to Eastern Time
        now_utc = datetime.now(pytz.utc)
        timestamp = now_utc.astimezone(eastern)

        result = start_article_time(article, timestamp)
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/stop-article-time', tags=["Assembly Production"])
async def handle_stop_article_time(article: ArticleTimeData):
    try:
        # Create a timezone object for Eastern Time
        eastern = pytz.timezone('America/New_York')
        # Get the current time in UTC and convert to Eastern Time
        now_utc = datetime.now(pytz.utc)
        timestamp = now_utc.astimezone(eastern)

        result = stop_article_time(article, timestamp)
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/complete-article-time', tags=["Assembly Production"])
async def handle_complete_article_time(article: ArticleTimeData):
    try:
        # Create a timezone object for Eastern Time
        eastern = pytz.timezone('America/New_York')
        # Get the current time in UTC and convert to Eastern Time
        now_utc = datetime.now(pytz.utc)
        timestamp = now_utc.astimezone(eastern)

        result = complete_article_time(article, timestamp)
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))
    


@app.post('/api/fetch-assembly-job-status', tags=["Assembly Order Status"])
async def handle_fetch_assembly_job_status(ORDERID):
    try:
        result = fetch_assembly_job_status(ORDERID)
        return {"result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail=str(e))