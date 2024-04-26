from fastapi import FastAPI, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from work_stations import WORK_STATIONS
from customer_ids import CUSTOMER_IDS
from sql_functions import fetch_last_timestamp, fetch_machine_part_counts



app = FastAPI()

templates  = Jinja2Templates(directory="templates")

app.mount("/templates", StaticFiles(directory="templates"), name="templates")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")


class DateForm(BaseModel):
    startDate: Optional[str]
    endDate: Optional[str] 


@app.get('/', response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/home', response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get('/production')
async def production(request: Request):
    return templates.TemplateResponse("production.html", {"request": request})

@app.get('/link2')
async def link2(request: Request):
    return templates.TemplateResponse("Link2.html", {"request": request})

@app.get('/link3')
async def link3(request: Request):
    return templates.TemplateResponse("Link3.html", {"request": request})

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

@app.post('/api/dateForm')
async def machine_part_counts(form_data: DateForm):
    if form_data.startDate is None or form_data.endDate is None:
        raise HTTPException(status_code=400, detail="Start date and end date are required.")
    results = fetch_machine_part_counts(form_data.startDate, form_data.endDate)
    if not results:
        raise HTTPException(status_code=404, detail="No data found for given dates")
    return results
