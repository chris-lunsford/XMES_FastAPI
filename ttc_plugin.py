import sys
import os
import pandas as pd
import io
from io import BytesIO, StringIO
from azure.storage.blob import BlobServiceClient
from ttc_routing_groups import ttc_saw_routing_groups, ttc_nested_routing_groups

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Response
from fastapi.responses import StreamingResponse
from typing import List


routing_dict = ttc_saw_routing_groups

router = APIRouter()

@router.post("/process/")
async def process_file(response: Response, file: UploadFile = File(...), order_id: str = Form(...)):
    response.set_cookie(key="my_cookie", value="cookie_value", samesite="None")
    try:
        content = await file.read()

        if file.filename.endswith('.csv'):
            # Decode content and remove trailing commas from each line
            content_str = content.decode('utf-8')
            content_str = '\n'.join(line.rstrip(',') for line in content_str.splitlines())

            # Use the cleaned string as the CSV data
            data = io.StringIO(content_str)
            df = pd.read_csv(data, header=0)  # Assuming the first row is the header
            print("process DF:\n", df)

            # Process the DataFrame
            new_df = modify_csv_in_memory(order_id, df)

            # Prepare the processed data for download
            output = BytesIO()
            new_df.to_csv(output, index=False, header=True)
            output.seek(0)
            upload_to_blob(output.getvalue(), "xmes/Tailor Closet/Buy Outs", f'{order_id}TTC-NonManuf.csv')


            return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={order_id}TTC-Productlist-NonManuf.csv"})

        elif file.filename.endswith('.pnx'):
            # Process PNX file
            df = modify_pnx_in_memory(order_id, content)
            output_pnx = BytesIO()
            df.to_csv(output_pnx, index=False, header=False, sep=',')
            output_pnx.seek(0)

            output_csv = BytesIO()
            df.to_csv(output_csv, index=False, header=True, sep=',')
            output_csv.seek(0)
            upload_to_blob(output_csv.getvalue(), "xmes/Tailor Closet/Parts List", f'{order_id}TTC.csv')

            return StreamingResponse(output_pnx, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={order_id}TTC.pnx"})

        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/")
async def check_status():
    # Endpoint to check the status or health of the TTC plugin
    return {"status": "running"}

# Additional TTC-specific endpoints can be added here




blob_service_client = BlobServiceClient.from_connection_string(
            'DefaultEndpointsProtocol=https;AccountName=cfxdatalakestorage;AccountKey=9jXagnDtv973aRwumV2Gt7PCxcFPLenFMlaVufJTxjqR2K4q9vxZf2k0tu8W6KzMBH6Ud++uW/60+AStmB3GHA==;EndpointSuffix=core.windows.net'
            )


def upload_to_blob(file_content: bytes, container_name: str, blob_name: str):
    try:
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        blob_client.upload_blob(file_content, overwrite=True)
        print("File uploaded to Azure")
    except Exception as e:
        raise


def handleFiles(files):
    pass


def find_routing(desc):
    # Ensure the description is a string and trimmed for whitespace
    desc = str(desc).strip()

    # Print the description being checked for debugging
    # print(f"Routing Check for: {desc}")

    # Special cases handling with debug output
    if 'RPM' in desc:
        # print("Matched RPM Special Case")
        return 'SCZ'
    if 'CTOP - Laminate' in desc:
        # print("Matched CTOP - Laminate Special Case")
        return 'PSZ'

    # Exact matches check with debug output
    for routing, parts in routing_dict.items():
        if desc in parts:  # This checks if description is exactly in the list
            # print(f"Matched Exact Description for Routing: {routing}")
            return routing

    # Default fallback with debug output
    print("Returned DEFAULT_ROUTING")
    return 'DEFAULT_ROUTING'
    

def modify_csv_in_memory(order_id, csv_data):
    try:
        # Check if csv_data is already a DataFrame and correctly structured
        if not isinstance(csv_data, pd.DataFrame):
            raise ValueError("Expected csv_data to be a DataFrame with correct columns")

        # Print the DataFrame for debugging to ensure columns are aligned correctly
        print("Initial DataFrame:\n", csv_data.head())

        # Ensure 'Qty' is numeric and correctly aligned
        csv_data['Qty'] = pd.to_numeric(csv_data['Qty'], errors='raise')

        # Additional data cleaning and type adjustments
        numeric_columns = ['Cut Width', 'Cut Height', 'Cut Depth', 'Cost', 'Weight']
        for col in numeric_columns:
            csv_data[col] = pd.to_numeric(csv_data[col], errors='coerce').fillna(0)
            if col in ['Cut Width', 'Cut Height', 'Cut Depth']:
                csv_data[col] *= 25.4  # Convert from inches to millimeters

        # Expand rows based on 'Qty'
        expanded_rows = []
        for _, row in csv_data.iterrows():
            qty = int(row['Qty'])  # Get the original quantity for expansion
            for _ in range(qty):
                new_row = row.copy()
                new_row['Qty'] = 1  # Set 'Qty' to 1 for each expanded row
                expanded_rows.append(new_row)

        # Create new DataFrame from expanded rows
        new_df = pd.DataFrame(expanded_rows)
        new_df.reset_index(drop=True, inplace=True)  # Reset index to avoid any duplicate index issues

        # Add ORDERID and BARCODE to the new DataFrame
        new_df['ORDERID'] = f'{order_id}TTC'
        new_df['BARCODE'] = [f'{order_id}TTC{5000 + i}' for i in range(len(new_df))]
        new_df['ROUTING'] = new_df.iloc[:, 2].apply(find_routing)

        return new_df

    except ValueError as ve:
        print(f"Value error occurred: {ve}")
        raise HTTPException(status_code=400, detail=f"Data formatting error: {ve}")
    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

def modify_pnx_in_memory(order_id, file_content: bytes):
    try:
        # Convert the input bytes into a BytesIO object to simulate a file
        data = BytesIO(file_content)
        
        # Read the content into a DataFrame
        df = pd.read_csv(data, header=None, delimiter=',', skip_blank_lines=True)
        
        # Handle potential trailing delimiters by dropping the last NaN column
        if df.iloc[:, -1].isnull().all():
            df = df.iloc[:, :-1]  # Drop the last column if it is entirely NaN

        # Modify the DataFrame: Add ORDERID, BARCODE, and ROUTING columns
        df['ORDERID'] = f'{order_id}TTC'
        df['BARCODE'] = [f'{order_id}TTC{1000 + i}' for i in range(len(df))]
        df['ROUTING'] = df.iloc[:, 2].apply(find_routing)  # Assuming find_routing is defined

        return df  # Return the modified DataFrame

    except Exception as e:
        print(f"An error occurred: {e}")
        raise e  # Handle or log the exception as needed
    
