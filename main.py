from datetime import datetime
import pytz
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional

from work_stations import WORK_STATIONS
from work_station_groups import WORK_STATION_GROUPS
from customer_ids import CUSTOMER_IDS
from notification_types import NOTIFICATION_TYPES
from sql_functions import *



app = FastAPI()

templates  = Jinja2Templates(directory="templates")

app.mount("/templates", StaticFiles(directory="templates"), name="templates")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return PlainTextResponse(str(exc), status_code=400)


@app.get('/', response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/home', response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get('/production')
async def production(request: Request):
    return templates.TemplateResponse("production.html", {"request": request})

@app.get('/machine-dashboard')
async def machine_dashboard(request: Request):
    return templates.TemplateResponse("machinedashboard.html", {"request": request})

@app.get('/notification')
async def notification(request: Request):
    return templates.TemplateResponse("submitnotification.html", {"request": request})

@app.get('/order-dashboard')
async def notification(request: Request):
    return templates.TemplateResponse("orderdashboard.html", {"request": request})

def get_resource_group(Resource):
    """Return the group for a given work area, or the work area itself if no group is defined."""
    return WORK_STATION_GROUPS.get(Resource, Resource)

@app.get('/api/work-stations')
async def get_work_stations():
    return WORK_STATIONS

@app.get('/api/customer-ids')
async def get_customer_ids():
    return CUSTOMER_IDS

@app.get("/api/machine-status")
async def machine_status():
    last_timestamps = fetch_last_timestamp()
    return last_timestamps



class DateForm(BaseModel):
    startDate: Optional[str]
    endDate: Optional[str] 

@app.post('/api/dateForm')
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

@app.post('/api/barcode-scan-Submit')
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
            data.CustomerID
            )
        return {"message": "Entry added successfully", "result": result}
    except ValueError as e:  # Specific handling for known exceptions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # Generic exception handling
        raise HTTPException(status_code=500, detail="An error occurred while processing the request.")
    



class BarcodeRecutData(BaseModel):
    Barcode: str
    OrderID: str
    Resource: str
    Recut: int

@app.post('/api/update-recut-status')
async def update_recut_status(data: BarcodeRecutData):
    try:
        print("Received data for recut:", data)
        result = update_recut_in_db(data.Barcode, data.OrderID, data.Resource, data.Recut)
        return {"message": "Recut status updated successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get('/api/employee-areaparts-count')
async def employee_areaparts_count(EmployeeID, Resource):
    try:
        count = get_employee_areaparts_count(EmployeeID, Resource)
        return {"area_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get('/api/employee-totalparts-count')
async def employee_totalparts_count(EmployeeID):
    try:
        count = get_employee_totalparts_count(EmployeeID)
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/order-total-area-count')
async def order_totalarea_count(OrderID, Resource):
    Resource_Group = get_resource_group(Resource)
    try:
        count = get_order_totalarea_count(OrderID, Resource_Group)
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/order-total-count')
async def order_total_count(OrderID):
    try:
        count = get_order_total_count(OrderID)
        return {"total_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/employee-joblist-day/')
async def employee_joblist_day(EmployeeID):
    try:
        job_list = get_employee_joblist_day(EmployeeID)
        return {"job_list": job_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/jobid-notifications')
async def jobid_notifications(OrderID):
    try:
        notification_list = get_jobid_notifications(OrderID)
        return {"notification_list": notification_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/notification-types')
async def get_notification_types():
    return NOTIFICATION_TYPES


class NotificationData(BaseModel):
    OrderID: str
    NotificationType: str
    OrderNotification: str
    SubmittedBy: str


@app.post('/api/submit-order-notification')
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
    

@app.delete('/api/delete-order-notification')
async def handle_delete_order_notificatino(notificationID: int):
    try:
        result = delete_order_notification(notificationID)
        return {"message": result}
    except ConnectionError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    


@app.get('/api/order-part-counts')
async def handle_order_part_counts(OrderID):
    try:
        counts = get_order_part_counts(OrderID)
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get('/api/scanned-order-part-counts')
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
    



    