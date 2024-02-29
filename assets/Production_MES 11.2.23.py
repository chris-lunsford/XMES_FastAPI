import tkinter as tk
from tkinter import ttk, messagebox
import pymssql
from datetime import datetime

def connect_to_db():
    server = "cfx-azure-server.database.windows.net"
    user = "MatthewC"
    password = "CFX-4500!"
    database = "CFX-DW-AzSQLDB"

    return pymssql.connect(server, user, password, database)


def update_sql(resource, barcode, employee_id):
    conn = connect_to_db()
    part_id = barcode[-len("PartID"):]  # Assuming PartID is a fixed length at the end of the barcode
    base_id = barcode[:-len(part_id)]
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor = conn.cursor()
    cursor.execute(f"UPDATE DBA.XMesProductionForm SET {resource} = %s, {resource}EmpID = %s WHERE BaseID = %s AND PartID = %s",
                   (timestamp, employee_id, base_id, part_id))
    conn.commit()
    conn.close()
    messagebox.showinfo("Info", "Data updated successfully!")


def submit_data():
    resource = resource_combobox.get()
    employee_id = emp_id_entry.get()
    barcode = barcode_entry.get()
    update_sql(resource, barcode, employee_id)


app = tk.Tk()
app.title("MES Barcode System")

# Resources
resources = ["AC1", "AS1", "AS2", "AS3", "AS4", "AS5", "AS6", "EB1", "EB2", "EB3", "EB4", "EBZ", "HD1", "HD2", "PR1",
             "PR2", "PS1", "PS2", "PS3", "PS4", "QC1", "SC1", "TR1", "TR2", "TR3", "TR4"]

# Create a label and dropdown for resources
tk.Label(app, text="Select Resource:").pack(pady=10)
resource_combobox = ttk.Combobox(app, values=resources)
resource_combobox.pack(pady=10)

# Create an entry for Employee ID
tk.Label(app, text="Enter Employee ID:").pack(pady=10)
emp_id_entry = tk.Entry(app)
emp_id_entry.pack(pady=10)

# Create an entry for Barcode
tk.Label(app, text="Scan the barcode:").pack(pady=10)
barcode_entry = tk.Entry(app)
barcode_entry.pack(pady=10)

# Submit button
submit_btn = tk.Button(app, text="Submit", command=submit_data)
submit_btn.pack(pady=20)

app.mainloop()
