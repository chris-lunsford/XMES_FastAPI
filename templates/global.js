async function updateMachineBorders() {
    try {
        console.log('Making API call to update machine borders');
        const response = await fetch('/api/machine-status');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // This strips time part, keeping only the date

        for (const [resource, lastScan] of Object.entries(data)) {
            const machineElement = document.getElementById(`machine-${resource}`);
            if (machineElement) {
                const lastScanDate = new Date(lastScan);
                const lastScanDay = new Date(lastScanDate.getFullYear(), lastScanDate.getMonth(), lastScanDate.getDate()); // This strips time part, keeping only the date

                const diffMinutes = (now - lastScanDate) / 60000; // convert milliseconds to minutes

                if (lastScanDay.getTime() === today.getTime()) { // Checks if the scan was today
                    if (diffMinutes < 5) {
                        machineElement.style.borderColor = 'green'; // Less than 5 minutes ago today
                    } else if (diffMinutes < 15) {
                        machineElement.style.borderColor = 'yellow'; // More than 5 minutes but less than 15 minutes ago today
                    } else if (diffMinutes > 15) {
                        machineElement.style.borderColor = 'red'; // More than 15 minutes ago today
                    }
                } else {
                    machineElement.style.borderColor = ''; // Default color if no scan today
                }
            }
        }
    } catch (error) {
        console.error('Failed to update machine borders:', error);
        // Optionally handle the error more gracefully in the UI
    }
}
// document.addEventListener('DOMContentLoaded', updateMachineBorders);



//**********************************/

function initializeDateInputs() {
    console.log('About to initialize dates');
    var today = new Date(); // Use the Date object to manipulate dates
    var todayStr = today.toISOString().substr(0, 10);

    var tomorrow = new Date(today); // Create a new Date object for tomorrow
    tomorrow.setDate(today.getDate() + 1); // Increment the day by one
    var tomorrowStr = tomorrow.toISOString().substr(0, 10);

    var startDateInput = document.getElementById('start-date');
    var endDateInput = document.getElementById('end-date');
    var hiddenStartDateInput = document.getElementById('today-start-date');
    var hiddenEndDateInput = document.getElementById('today-end-date');
    
    console.log('Start Date Input:', startDateInput);
    console.log('End Date Input:', endDateInput);

    if (startDateInput && endDateInput && hiddenStartDateInput && hiddenEndDateInput) {
        startDateInput.value = todayStr;
        endDateInput.value = tomorrowStr;
        hiddenStartDateInput.value = todayStr;
        hiddenEndDateInput.value = tomorrowStr;

        // Log to console for debugging
        console.log('Date inputs initialized. Start Date:', todayStr, 'End Date:', tomorrowStr);
    } else {
        console.error('One or more date inputs are missing.');
    }
}


//**********************************/



function updateDateInputs(selectedOption) {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Add one day to today's date
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    switch (selectedOption) {
        case 'today':
            setDateInputs(todayStr, tomorrowStr);
            disableDatePickers();
            break;
        case 'week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - (today.getDay() || 7) + 1);  // Set to Monday of this week
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);  // Sunday of this week
            setDateInputs(startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]);
            disableDatePickers();
            break;
        case 'month':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);  // Last day of the current month
            setDateInputs(startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]);
            disableDatePickers();
            break;
        case 'custom':
            enableDatePickers();
            break;
    }
}

function setDateInputs(startDate, endDate) {
    console.log("Setting dates to:", startDate, endDate);
    document.getElementById('today-start-date').value = startDate;
    document.getElementById('today-end-date').value = endDate;
    document.getElementById('start-date').value = startDate;
    document.getElementById('end-date').value = endDate;
}

function disableDatePickers() {
    document.getElementById('start-date').disabled = true;
    document.getElementById('end-date').disabled = true;
}

function enableDatePickers() {
    const startDatePicker = document.getElementById('start-date');
    const endDatePicker = document.getElementById('end-date');

    // Check if the pickers have valid dates set; if not, initialize to today's date
    const today = new Date().toISOString().split('T')[0];
    if (!startDatePicker.value) startDatePicker.value = today;
    if (!endDatePicker.value) endDatePicker.value = today;

    startDatePicker.disabled = false;
    endDatePicker.disabled = false;
}

function updatePartCounts(data) {
    console.log('Making API call to update part counts');
    // First, reset all part count labels to "0"
    const partCountElements = document.querySelectorAll('[id^="part-count-"]');
    partCountElements.forEach(element => {
        element.textContent = "0";
    });

    // Now, update the labels that have new data
    Object.keys(data).forEach(machineId => {
        const partCountElement = document.getElementById(`part-count-${machineId}`);
        if (partCountElement) {
            partCountElement.textContent = data[machineId];
        }
    });
}


//**********************************/


function handleFormSubmit(formDataOrEvent) {
    let formData;
    if (formDataOrEvent instanceof Event) {
        formDataOrEvent.preventDefault();
        formData = new FormData(formDataOrEvent.target);
    } else {
        formData = formDataOrEvent; // Already FormData instance
    }

    let startDate = document.getElementById('start-date').value;
    let endDate = document.getElementById('end-date').value;

    if (!document.getElementById('start-date').disabled) {
        startDate = document.getElementById('start-date').value;
    }
    if (!document.getElementById('end-date').disabled) {
        endDate = document.getElementById('end-date').value;
    }

    console.log('Submitting dates:', { startDate, endDate });

    fetch('/api/dateForm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({startDate, endDate})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data && Object.keys(data).length > 0) {
            updatePartCounts(data); // Update UI with received data
            updateMachineBorders(); // Update machine borders whenever the form is submitted
        } else {
            // If data is empty, explicitly reset part counts
            resetPartCounts();
            console.log('No data returned for the given date range.');
        }
        // updateMachineBorders(); // Update machine borders even if no new data
    })
    .catch(error => {
        console.error('Error:', error);
        resetPartCounts(); // Resets part counts on error
        updateMachineBorders(); // Update machine borders on error
    });
}

function resetPartCounts() {
    const partCountElements = document.querySelectorAll('[id^="part-count-"]');
    partCountElements.forEach(element => {
        element.textContent = "0"; // Reset each part count to "0"
    });
}


function autoSubmitForm() {
    const form = document.getElementById('dateForm');
    if (form) {
        const formData = new FormData(form); // Gather form data
        handleFormSubmit(formData); // Assuming this is your function that handles form submission
    }
}




/**********************************************************/
/* Production Dashboard */

function populateCustomerIDs() {
    fetch('/api/customer-ids')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('customer-id');
            if (select) {
                // Clear existing options before adding new ones
                select.innerHTML = '';
                data.forEach(customerId => {
                    let option = new Option(customerId, customerId);
                    select.add(option);
                });
            } else {
                console.log('Customer ID select element not found');
            }
        })
        .catch(error => console.error('Error fetching customer IDs:', error));
}


function populateWorkAreas() {
    fetch('/api/work-stations')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('work-area');
            if (select) {
                // Clear existing options before adding new ones
                select.innerHTML = '';
                data.forEach(station => {
                    let option = new Option(station, station);
                    select.add(option);
                });
            } else {
                console.log('Work area select element not found');
            }
        })
        .catch(error => console.error('Error fetching work stations:', error));
}


function handleBarcodeScan_to_DB() {
    let employeeID = document.getElementById('employee-id').value;
    let workArea = document.getElementById('work-area').value;
    let customerID = document.getElementById('customer-id').value;
    let orderID = document.getElementById('order-id').value;
    let barcode = document.getElementById('barcode').value;
    let statusMessage = document.getElementById('status-message');

    // Check if all required fields are filled
    if (!employeeID || !workArea || !customerID || !orderID || !barcode) {
        statusMessage.textContent = 'All fields must be filled out!';
        statusMessage.style.color = 'red';
        return;
    }
   
    console.log('Submitting data:', { employeeID, workArea, customerID, orderID, barcode });

    fetch('/api/barcode-scan-Submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            EmployeeID: employeeID,
            Resource: workArea,
            CustomerID: customerID,
            JobID: orderID,
            Barcode: barcode
        })
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(result => {
        if (result.status >= 400) {  // Check for errors
            throw new Error(result.body.detail);  // Assuming the server sends back an error in 'detail'
        }
        console.log('Success:', result.body);
        statusMessage.textContent = 'Barcode scan successful!';
        statusMessage.style.color = 'green';
    })
    .catch((error) => {
        if (error.message.includes('Duplicate barcode')) {
            if (confirm("This barcode has been scanned before. Is this part a recut?")) {
                // If user confirms it's a recut, send another request to update the recut status
                updateRecutStatus(barcode, orderID, workArea);
            } else {
                // Handle the case where it's not a recut
                console.error("Duplicate barcode and not a recut.");
                document.getElementById('status-message').textContent = "Duplicate barcode error!";
                document.getElementById('status-message').style.color = 'red';
            }
        } else {
            console.error('Error:', error);
            document.getElementById('status-message').textContent = 'Error scanning barcode: ' + error.message;
            document.getElementById('status-message').style.color = 'red';
        }
    });
}


function updateRecutStatus(barcode, orderID, workArea) {
    const payload = JSON.stringify({
        Barcode: barcode,
        JobID: orderID,
        Resource: workArea,
        Recut: 1  // Assuming Recut is an integer and is a required field
    });
    
    console.log("Sending payload:", payload);
    
    fetch('/api/update-recut-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: payload
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update recut status: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('Recut status updated:', data);
        document.getElementById('status-message').textContent = 'Barcode updated as a recut!';
        document.getElementById('status-message').style.color = 'green';
    })
    .catch(error => {
        console.error('Error updating recut status:', error);
        document.getElementById('status-message').textContent = 'Failed to update recut status.';
        document.getElementById('status-message').style.color = 'red';
    });
}


function enableEditing(element) {
    element.removeAttribute('readonly');  // Removes the readonly attribute when the field is focused
    element.style.backgroundColor = "#FFFFFF";  // Optional: change the background color to indicate editability
}


function fetchAreaPartsCount(employeeID, workArea) {
    if (!employeeID || !workArea) {
        console.error('Employee ID and Work Area are required.');
        return;
    }
    console.log('Submitting data:', { employeeID, workArea});
    
    // Construct the query string
    const queryParams = new URLSearchParams({
        EmployeeID: employeeID, // Ensure the parameter names match the server's expected names
        Resource: workArea
    });

    // Append query parameters to the URL
    const url = `/api/employee-areaparts-count?${queryParams.toString()}`;
    console.log('Fetching parts count from:', url); // Debug: log the URL being requested

    fetch(url)
        .then(response => {
            console.log('Response received'); // Debug: confirm response received
            if (!response.ok) {
                throw new Error('Failed to fetch data from server');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data); // Debug: log the data received
            document.getElementById('partcount-area').textContent = data.area_count;
        })
        .catch(error => console.error('Failed to fetch parts count:', error));
}


function fetchEETotalPartsCount(employeeID) {
    if (!employeeID) {
        console.error('Employee ID required.');
        return;
    }
    console.log('Submitting data:', { employeeID});
    
    // Construct the query string
    const queryParams = new URLSearchParams({
        EmployeeID: employeeID
    });

    // Append query parameters to the URL
    const url = `/api/employee-totalparts-count?${queryParams.toString()}`;
    console.log('Fetching parts count from:', url); // Debug: log the URL being requested

    fetch(url)
        .then(response => {
            console.log('Response received'); // Debug: confirm response received
            if (!response.ok) {
                throw new Error('Failed to fetch data from server');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data); // Debug: log the data received
            document.getElementById('partcount-emp').textContent = data.total_count;
        })
        .catch(error => console.error('Failed to fetch parts count:', error));
}


function fetchEEJobListDay(employeeID) {
    // Define the API URL with the employee ID as a query parameter
    const url = `/api/employee_joblist_day/?EmployeeID=${employeeID}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch job list from the server');
            }
            return response.json();
        })
        .then(data => {
            const jobListContainer = document.querySelector('.job-list');
            // Clear existing list items regardless of whether new ones are to be added
            jobListContainer.innerHTML = '';

            // Check if the job list is empty and handle accordingly
            if (data.job_list && data.job_list.length > 0) {
                // Append new list items for each job ID
                data.job_list.forEach(jobID => {
                    const listItem = document.createElement('ul');
                    listItem.textContent = jobID;
                    jobListContainer.appendChild(listItem);
                });
            } else {
                // Optionally, you can append a message saying no jobs found
                const noJobsMessage = document.createElement('ul');
                noJobsMessage.textContent = 'No jobs found.';
                jobListContainer.appendChild(noJobsMessage);
            }
        })
        .catch(error => {
            console.error('Error fetching job list:', error);
            // Optionally handle errors, e.g., show an error message in the UI
            const jobListContainer = document.querySelector('.job-list');
            jobListContainer.innerHTML = ''; // Ensure the list is cleared on error
            const errorMessage = document.createElement('ul');
            errorMessage.textContent = 'Error loading jobs.';
            jobListContainer.appendChild(errorMessage);
        });
}

