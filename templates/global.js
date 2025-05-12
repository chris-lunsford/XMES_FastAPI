function showLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'block';
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}


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

function populateAssemblyWorkAreas() {
    fetch('/api/assembly-work-stations')
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

function populateDefectTypes() {
    fetch('/api/defect-types')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('defect-type');
            if (select) {
                // Clear existing options before adding new ones
                select.innerHTML = '';
                data.forEach(defectType => {
                    let option = new Option(defectType, defectType);
                    select.add(option);
                });
            } else {
                console.log('Defect Type select element not found');
            }
        })
        .catch(error => console.error('Error fetching defect types:', error));
}

function populateDefectActions() {
    fetch('/api/defect-actions')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('defect-action');
            if (select) {
                // Clear existing options before adding new ones
                select.innerHTML = '';
                data.forEach(defectAction => {
                    let option = new Option(defectAction, defectAction);
                    select.add(option);
                });
            } else {
                console.log('Defect Type select element not found');
            }
        })
        .catch(error => console.error('Error fetching defect types:', error));
}


function showScanResult(success) {
    const overlay = document.getElementById('scan-result-overlay');
    const icon = document.getElementById('scan-result-icon');

    if (success) {
        icon.classList.remove('scan-failure');
        icon.classList.add('scan-success');
        icon.textContent = '✔'; // Green check mark
        console.log('Showing success icon');
    } else {
        icon.classList.remove('scan-success');
        icon.classList.add('scan-failure');
        icon.textContent = '✘'; // Red X mark
        console.log('Showing failure icon');
    }

    overlay.style.visibility = 'visible'; // Show the overlay

    // Hide the overlay after 2 seconds
    setTimeout(() => {
        overlay.style.visibility = 'hidden';
    }, 2000);
}


async function handleBarcodeScan_to_DB() {
    let employeeID = document.getElementById('employee-id').value;
    let workArea = document.getElementById('work-area').value;
    let customerID = document.getElementById('customer-id').value;
    let orderID = document.getElementById('order-id').value;
    let barcode = document.getElementById('barcode').value;
    let statusMessage = document.getElementById('status-message');

    if (!employeeID || !workArea || !customerID || !orderID || !barcode) {
        statusMessage.textContent = 'All fields must be filled out!';
        statusMessage.style.color = 'red';
        resetBarcodeField();
        showScanResult(false); // Show failure icon
        return Promise.reject('Required fields are missing.');
    }
    
    try {
        const payload = {
            EmployeeID: employeeID,
            Resource: workArea,
            CustomerID: customerID,
            OrderID: orderID,
            Barcode: barcode,
            forceContinue: false  // initially set to false
        };

        let response = await fetch('/api/barcode-scan-Submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        let data = await response.json();

        if (response.status >= 400) {
            throw new Error(data.detail || 'Server error');
        }

        // Handle warning about unexpected resource area
        if (data.warning && data.warning === 'not_at_resource') {
            if (!confirm("This part is not expected at this area. Do you want to continue?")) {
                console.log('User chose not to continue.');
                statusMessage.textContent = "Scan cancelled by user.";
                statusMessage.style.color = 'red';
                showScanResult(false);
                return;
            } else {
                console.log('User chose to continue despite warning.');
                statusMessage.textContent = 'Proceeding with scan...';
                statusMessage.style.color = 'orange';
                payload.forceContinue = true;                
            }
        }

        // Repeat the API call if the user decided to continue despite the warning
        if (payload.forceContinue) {
            response = await fetch('/api/barcode-scan-Submit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            data = await response.json();
            if (response.status >= 400) {
                throw new Error(data.detail || 'Server error during force continue');
            }
        }

        // Now handle duplicate barcode scenario
        if (data.warning && data.warning === 'duplicate_barcode') {
            if (confirm("Duplicate barcode detected. Is this a recut part?")) {
                console.log('User confirmed recut.');
                statusMessage.textContent = 'Updating recut status...';
                statusMessage.style.color = 'orange';

                const recutData = {
                    Barcode: barcode,
                    OrderID: orderID,
                    Resource: workArea,
                    Recut: 1  // Assuming this increments the recut count by 1
                };

                const recutResponse = await fetch('/api/update-recut-status', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(recutData)
                });
                const recutResult = await recutResponse.json();
                if (recutResponse.status >= 400) {
                    throw new Error(recutResult.detail || 'Server error during recut update');
                }
                console.log('Recut status updated:', recutResult);
                statusMessage.textContent = 'Recut status updated successfully.';
                statusMessage.style.color = 'green';
                showScanResult(true); // Show success icon
            } else {
                console.log('User denied recut.');
                statusMessage.textContent = "Scan cancelled by user.";
                statusMessage.style.color = 'red';
                showScanResult(false);
                return;
            }
        }

        if (!data.warning) {
            console.log('Success:', data);
            statusMessage.textContent = 'Barcode scan successful.';
            statusMessage.style.color = 'green';
            showScanResult(true); // Show success icon
        }
    } catch (error) {
        console.error('Error:', error);
        statusMessage.textContent = 'Error scanning barcode: ' + error.message;
        statusMessage.style.color = 'red';
        showScanResult(false); // Show failure icon
    } finally {
        resetBarcodeField();
    }
}

async function updateRecutStatus(barcode, orderID, workArea) {
    const payload = JSON.stringify({
        Barcode: barcode,
        OrderID: orderID,
        Resource: workArea,
        Recut: 1  // Assuming Recut is an integer and is a required field
    });
    
    console.log("Sending payload:", payload);
    
    try {
        const response = await fetch('/api/update-recut-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload
        });

        if (!response.ok) {
            throw new Error('Failed to update recut status: ' + response.statusText);
        }

        const data = await response.json();
        console.log('Recut status updated:', data);
        document.getElementById('status-message').textContent = 'Barcode updated as a recut.';
        document.getElementById('status-message').style.color = 'green';
    } catch (error) {
        console.error('Error updating recut status:', error);
        document.getElementById('status-message').textContent = 'Failed to update recut status: ' + error.message;
        document.getElementById('status-message').style.color = 'red';
    }
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
    console.log('Submitting data:', {employeeID, workArea});
    
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



function fetchAreaGroupCount(orderID, workArea) {
    console.log('Submitting data:', {orderID, workArea});
    
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
    console.log('Submitting data:', {employeeID});
    
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
    const url = `/api/employee-joblist-day/?EmployeeID=${employeeID}`;

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



function fetchJobNotifications(OrderID) {
    const url = `/api/jobid-notifications?OrderID=${OrderID}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch notifications from the server');
            }
            return response.json();
        })
        .then(data => {
            const notificationListElement = document.getElementById('notification-list');
            notificationListElement.innerHTML = ''; // Clear existing notifications

            const ul = document.createElement('ul'); // Create a single <ul>

            if (data.notification_list && data.notification_list.length > 0) {
                data.notification_list.forEach(notification => {
                    const li = document.createElement('li');
                    const dateOnly = notification[0].split('T')[0]; // Split the timestamp and take only the date part
                    const reformattedDate = formatDate(dateOnly); // Call function to reformat the date
                    const messageWithBreaks = notification[3].replace(/\n/g, '<br><br>'); // Replace newline characters with HTML <br>
                    li.innerHTML = `
                        <p>Type: ${notification[2]}</p>
                        <p>Date: ${reformattedDate}</p>
                        <p><br>${messageWithBreaks}</p>
                    `;
                    ul.appendChild(li); // Append each <li> to the single <ul>
                });
            } else {
                ul.innerHTML = '<li>No notifications found.</li>';
            }

            notificationListElement.appendChild(ul);
        })
        .catch(error => {
            console.error('Error fetching notifications:', error);
            document.getElementById('notification-list').innerHTML = '<ul><li>Error loading notifications.</li></ul>';
        });
}

function formatDate(dateStr) {
    const dateParts = dateStr.split('-'); // Split the date into parts
    return `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`; // Reformat to MM-DD-YYYY
}


function fetchOrderAreaScannedCount(orderID, workArea, employeeID) {
    if (!orderID) {
        console.error('Order ID required.');
        return;
    }
    console.log('Submitting data:', {orderID, workArea, employeeID});
    
    // Construct the query string
    const queryParams = new URLSearchParams({
        OrderID: orderID,
        Resource: workArea,
        EmployeeID: employeeID
    });

    // Append query parameters to the URL
    const url = `/api/order-area-scanned-count?${queryParams.toString()}`;
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
            document.getElementById('ordercount-area').textContent = data.scanned_count;
        })
        .catch(error => console.error('Failed to fetch parts count:', error));
}


function fetchMachineGroupScanCount(orderID, workArea) {
    console.log('Submitting data:', {orderID, workArea});

    const queryParams = new URLSearchParams({
        OrderID: orderID,
        Resource: workArea
    });
   
    const url = `/api/order-machinegroup-scan-count?${queryParams.toString()}`;
    console.log('Fetching scans from machine group:', url);

    return fetch (url)
    .then(response => {
        console.log('Response recieved');
        if (!response.ok) {
            throw new Error('Failed to fetch data from server');            
        }
        return response.json();        
    })
    .then(data => {
        console.log('Data received:', data);
        // document.getElementById('ordercount-area').textContent = data.order_machinegroup_scan_count;
        document.getElementById('ordercount-scanned-area').textContent = data.order_machinegroup_scan_count;
        return data;        
    })
    .catch(error => {
        console.error('Failed to fetch scan count:', error);
    throw error;
    });
}


function fetchOrderTotalAreaCount(orderID, workArea) {    
    console.log('Submitting data:', { orderID, workArea});
    
    // Construct the query string
    const queryParams = new URLSearchParams({
        OrderID: orderID,
        Resource: workArea
    });

    // Append query parameters to the URL
    const url = `/api/order-total-area-count?${queryParams.toString()}`;
    console.log('Fetching parts count from:', url); // Debug: log the URL being requested

    return fetch(url)
        .then(response => {
            console.log('Response received'); // Debug: confirm response received
            if (!response.ok) {
                throw new Error('Failed to fetch data from server');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data); // Debug: log the data received
            document.getElementById('ordercount-total-area').textContent = data.area_total_count;
            return data;
        })
        .catch(error => {
            console.error('Failed to fetch parts count:', error);
            throw error;
        });
    }


function fetchOrderTotalCount(orderID) {
    if (!orderID) {
        console.error('Order ID required.');
        return;
    }
    console.log('Submitting data:', { orderID});
    
    // Construct the query string
    const queryParams = new URLSearchParams({
        OrderID: orderID
    });

    // Append query parameters to the URL
    const url = `/api/order-total-count?${queryParams.toString()}`;
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
            document.getElementById('ordercount-total-order').textContent = data.total_count;
        })
        .catch(error => console.error('Failed to fetch parts count:', error));
}



/**********************************************************/
/* Production Dashboard */










/**********************************************************/
/* Notification Dashboard */



function populateNotificationTypes() {
    fetch('/api/notification-types')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('notification-type');
            if (select) {
                // Clear existing options before adding new ones
                select.innerHTML = '';
                data.forEach(notificationType => {
                    let option = new Option(notificationType, notificationType);
                    select.add(option);
                });
            } else {
                console.log('Notification Type select element not found');
            }
        })
        .catch(error => console.error('Error fetching Notification Types:', error));
}

function fetchExistingJobNotifications(orderID) {
    const url = `/api/jobid-notifications?OrderID=${orderID}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch notifications from the server');
            }
            return response.json();
        })
        .then(data => {
            const notificationListElement = document.getElementById('notification-list');
            notificationListElement.innerHTML = ''; // Clear existing notifications

            const ul = document.createElement('ul'); // Create a single <ul>

            if (data.notification_list && data.notification_list.length > 0) {
                data.notification_list.forEach(notification => {
                    const li = document.createElement('li');
                    const dateOnly = notification[0].split('T')[0]; // Split the timestamp and take only the date part
                    const reformattedDate = formatDate(dateOnly); // Call function to reformat the date
                    li.innerHTML = `
                        <p>Type: ${notification[2]}</p>
                        <p>Date: ${reformattedDate}</p> 
                        <p>-${notification[3]}</p>
                    `;
                    li.setAttribute('data-id', notification[1]); // Store the ID in a data attribute

                    li.addEventListener('click', function() {
                        const confirmed = confirm("Do you want to delete this notification?");
                        if (confirmed) {
                            console.log("Trying to delete notification")
                            deleteNotification(notification[1]); // Assuming notification[1] is the ID
                        }
                    });
                    ul.appendChild(li); // Append each <li> to the single <ul>
                });
            } else {
                ul.innerHTML = '<li>No notifications found.</li>';
            }

            notificationListElement.appendChild(ul);
        })
        .catch(error => {
            console.error('Error fetching notifications:', error);
            document.getElementById('notification-list').innerHTML = '<ul><li>Error loading notifications.</li></ul>';
        });
}

function deleteNotification(notificationID) {
    const jobIdElement = document.getElementById('order-id-notificationpage');
    if (!jobIdElement || jobIdElement.value === "") {
        console.error("JobID element is missing or empty");
        return; // Exit the function if no JobID found
    }

    const OrderID = jobIdElement.value;
    fetch(`/api/delete-order-notification?notificationID=${notificationID}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to delete the notification');
        }
        return response.json();
    })
    .then(data => {
        alert('Notification deleted successfully!');
        fetchExistingJobNotifications(OrderID); // Refresh the list or handle the UI update here
    })
    .catch(error => {
        console.error('Error deleting notification:', error);
        alert('Error deleting notification.');
    });
}




/**********************************************************/
/* Order Dashboard */




function fetchOrderPartCounts(orderID, callback) {
    if (!orderID) {
        console.error('Order ID required.');
        return;
    }
    console.log('Submitting data:', { orderID });
    
    const queryParams = new URLSearchParams({ OrderID: orderID });
    const url = `/api/order-part-counts?${queryParams.toString()}`;
    console.log('Fetching parts count from:', url);

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch data from server');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            Object.entries(data).forEach(([machineCode, count]) => {
                const partCountElementId = `part-count-${machineCode}`;
                const partCountElement = document.getElementById(partCountElementId);
                if (partCountElement) {
                    partCountElement.textContent = count;
                    // Update border color based on count
                    const machineContainer = partCountElement.closest('.machine-container');
                    console.log(`Element found, updating: ${partCountElementId}`);
                    if (count > 0) {
                        machineContainer.classList.add('has-parts');
                        machineContainer.classList.remove('hidden'); // Ensure it's visible
                    } else {
                        machineContainer.classList.remove('has-parts');
                        machineContainer.classList.add('hidden'); // Hide if no parts
                    }
                } else {
                    console.error('Element not found:', partCountElementId);
                }
            });
            if (callback) callback();
        })
        .catch(error => {
            console.error('Failed to fetch parts count:', error);
            if (callback) callback(); // Call the callback even on error to handle cases where progress bar needs updating
        });
}


function fetchScannedOrderPartCounts(orderID, callback) {
    if (!orderID) {
        console.error('Order ID required.');
        return;
    }
    console.log('Submitting data:', { orderID });
    
    const queryParams = new URLSearchParams({ OrderID: orderID });
    const url = `/api/scanned-order-part-counts?${queryParams.toString()}`;
    console.log('Fetching parts count from:', url);

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch data from server');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            Object.entries(data).forEach(([machineCode, count]) => {
                const partCountElementId = `current-count-${machineCode}`;
                const partCountElement = document.getElementById(partCountElementId);
                if (partCountElement) {
                    partCountElement.textContent = count;                    
                } else {
                    console.error('Element not found:', partCountElementId);
                }
            });
            if (callback) callback();
        })
        .catch(error => {
            console.error('Failed to fetch parts count:', error);
            if (callback) callback(); // Call the callback even on error to handle cases where progress bar needs updating
        });
}



function fetchWorkStationGroups() {
    return fetch('/api/work-station-groups')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load workstation groups.');
            return response.json();
        })
        .then(data => data.groups)
        .catch(error => {
            console.error('Error fetching workstation groups:', error);
            return {}; // Return empty object to handle gracefully
        });
}




// Function to fetch parts not scanned and update the table
function fetchPartsNotScanned(orderID, workAreaField) {
    fetchWorkStationGroups().then(groups => {
        // Ensure groups are loaded and then use them
        const group = groups[workAreaField] || workAreaField; // Use fetched groups here
        console.log('Submitting data:', { orderID, group });

        fetch(`/api/parts-not-scanned-by-group?OrderID=${orderID}&Resource=${group}`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load parts data.');
                return response.json();
            })
            .then(data => {
                updatePartsTable(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }).catch(error => {
        console.error('Error loading workstation groups:', error);
    });
}

// Function to update the table with fetched data
function updatePartsTable(parts) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = ''; // Clear existing entries

    if (parts.length === 0) {
        const row = `<tr>
                        <td colspan="6">No parts found.</td>
                     </tr>`;
        tableBody.innerHTML = row;

    }else {
        parts.forEach(part => {
            const barcode = part.BARCODE || 'N/A';
            const cncBarcode = part.CNC_BARCODE1 || 'N/A';
            const description = part.Description || 'N/A';
            const routing = part.Routing || 'N/A';
            const lastresource = part.LastRESOURCE || 'N/A';
            const timestamp = part.TIMESTAMP ? formatLastScanDate(part.TIMESTAMP) : 'N/A';

            const row = `<tr>
                            <td>${barcode}</td>
                            <td>${cncBarcode}</td>
                            <td>${description}</td>
                            <td>${routing}</td>
                            <td>${lastresource}</td>
                            <td>${timestamp}</td>
                        </tr>`;
            tableBody.innerHTML += row;
        });
    }
}

function clearPartsTable() {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = ''; // Clear all existing rows
}



// Function to format the timestamp
function formatLastScanDate(timestamp) {
    const date = new Date(timestamp);
    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    return `${date.toLocaleDateString(undefined, options)} ${date.toLocaleTimeString(undefined, timeOptions)}`;
}




/**********************************************************/
/* Defect Dashboard */

function fetchDefectList() {
    const orderID = document.getElementById('order-id').value;
    const defectType = document.getElementById('defect-type').value;
    const defectAction = document.getElementById('defect-action').value;
    const workArea = document.getElementById('work-area').value;
    console.log('Fetching Defect List')

    const url = `/api/fetch-defects?` +
                `order_id=${encodeURIComponent(orderID)}&` +
                `defect_type=${encodeURIComponent(defectType)}&` +
                `defect_action=${encodeURIComponent(defectAction)}&` +
                `work_area=${encodeURIComponent(workArea)}`;

    fetch(url)
    .then(response => response.json())
    .then(data => {
        updateDefectTable(data);
    })
    .catch(error => console.error('Error fetching data:', error));
}


function updateDefectTable(defects) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    defects.forEach(defect => {
        const row = `<tr>
                        <td>${defect.OrderID}</td>
                        <td>${defect.DefectType}</td>
                        <td>${defect.DefectDetails}</td>
                        <td>${defect.DefectAction}</td>
                        <td class="date-cell">${defect.DateSubmitted}</td>
                        <td>${defect.EmployeeID}</td>
                        <td>${defect.Resource}</td>
                        <td>${defect.Barcode}</td>
                    </tr>`;
        tableBody.innerHTML += row;
    });

    // After table is updated, reformat date cells
    reformatDateElements();
}

// Object to store the direction for each column
var sortDirections = {};

function sortTable(columnIndex) {
    const table = document.getElementById("parts-table");
    let switching = true;

    // Check if the column has been sorted before and toggle direction
    if (sortDirections[columnIndex] && sortDirections[columnIndex] === "asc") {
        sortDirections[columnIndex] = "desc";
    } else {
        sortDirections[columnIndex] = "asc";
    }

    let direction = sortDirections[columnIndex]; // Get current direction for this column
    let shouldSwitch, i; // Declare outside the loop to ensure they are reset properly each time

    while (switching) {
        switching = false;
        const rows = table.getElementsByTagName("TR");

        // Loop through all rows except the header and the last one for comparison
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;

            // Get the two elements to compare, one from current row and one from the next
            const x = rows[i].getElementsByTagName("TD")[columnIndex];
            const y = rows[i + 1].getElementsByTagName("TD")[columnIndex];

            // Decide if switching should occur based on the direction
            if (direction === "asc") {
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            } else {
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            }
        }

        if (shouldSwitch) {
            // If a switch is needed, perform it and mark that a switch has been done
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        } else if (i === (rows.length - 2) && !shouldSwitch) {
            // If no switching has been done, stop the loop
            switching = false;
        }
    }
}

function reformatDateElements() {
    // Select all elements with the 'date-cell' class
    const dateCells = document.querySelectorAll('.date-cell');

    dateCells.forEach(cell => {
        // Get current content, which is in ISO 8601 format
        const isoDate = cell.textContent;

        // Create a date object
        const dateObj = new Date(isoDate);

        // Format the date as desired, here using toLocaleDateString for a simple example
        // You can specify options to change the appearance
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formattedDate = dateObj.toLocaleDateString(undefined, options);

        // Replace the cell content with the formatted date
        cell.textContent = formattedDate;
    });
}