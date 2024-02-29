from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from sql_functions import fetch_order_data



app = FastAPI()

templates  = Jinja2Templates(directory="templates")

app.mount("/templates", StaticFiles(directory="templates"), name="templates")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.get('/', response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/home', response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get('/link1')
async def link1(request: Request):
    return templates.TemplateResponse("Link1.html", {"request": request})

@app.get('/link2')
async def link2(request: Request):
    return templates.TemplateResponse("Link2.html", {"request": request})

@app.get('/link3')
async def link3(request: Request):
    return templates.TemplateResponse("Link3.html", {"request": request})


@app.post('/submit_form')
async def submit_form(request: Request,
                      order_id: str = Form(...)):
    rows, columns = fetch_order_data(order_id)  # Use the function to fetch data

    # Pass the fetched data to the results view
    return templates.TemplateResponse("results_fragment.html", {"request": request, "rows": rows, "columns": columns})