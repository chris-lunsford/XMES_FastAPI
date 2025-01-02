/***** Assembly Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/assembly-production'].callback = initializeAssemblyProductionDashboard;
}



function initializeAssemblyProductionDashboard() {
    console.log("Initializing Assembly Production Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    // Initialize dashboard functionalities
    populateCustomerIDs(); // Populate customer IDs
    populateWorkAreas(); // Populate work areas
    populateDefectTypes();
    populateDefectActions();

    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.assemblyProductionDashboardInitialized) return;
    window.assemblyProductionDashboardInitialized = true;   
}


function setupEventHandlers() {
    console.log("Setting up event handlers");

    // Add general event listeners
    listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
    listenerManager.addListener(document.getElementById('report-defect'), 'click', handleReportDefect);
    listenerManager.addListener(document.getElementById('submit-defect-button'), 'click', handleSubmitButton);
    listenerManager.addListener(document, 'keydown', handleGlobalKeydown);

    // Add event listener for barcode field
    listenerManager.addListener(document.getElementById('barcode'), 'keydown', handleBarcodeKeyPress);
}


// let lastBarcodeSubmissionTime = 0; // Track the last barcode submission timestamp
if (typeof window.lastBarcodeSubmissionTime === 'undefined') {
    window.lastBarcodeSubmissionTime = 0;
  }
// const BARCODE_SUBMISSION_COOLDOWN_MS = 2000; // Set a 2-second cooldown
if (typeof window.BARCODE_SUBMISSION_COOLDOWN_MS === 'undefined') {
    window.BARCODE_SUBMISSION_COOLDOWN_MS = 2000;
}


async function fetchAndAddParts(barcode) {
    try {
        console.log(`Fetching parts for barcode: ${barcode}`);
        const response = await fetch(`/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const parts = await response.json();

        for (const part of parts) {
            const isChecked = checkAndHandleBarcode(part.BARCODE);

            if (isChecked === null) {
                // Add the part to the table if it is not already there
                addBarcodeToTable(part.BARCODE, part.INFO1, part.INFO2); // Assume INFO2 is Routing
            }
        }

        // Mark the scanned barcode as green
        const isScannedChecked = checkAndHandleBarcode(barcode);
        if (isScannedChecked) {
            alert('This barcode is already in the table and checked green.');
        } else if (isScannedChecked === false) {
            markBarcodeCheckedGreen(barcode);
        }
    } catch (error) {
        console.error("Failed to fetch parts:", error);
        alert("Error fetching parts: " + error.message);
    }
}


function checkAndHandleBarcode(barcode) {
    const partList = document.getElementById('partlist-list');
    const existingItems = Array.from(partList.children);

    for (const item of existingItems) {
        const span = item.querySelector('span[data-barcode]');
        const checkbox = item.querySelector('input[type="checkbox"]');

        if (span && span.getAttribute('data-barcode') === barcode) {
            // Return true if the barcode is found, along with its checked state
            return checkbox.checked;
        }
    }
    return null; // Return null if the barcode is not in the list
}


// function addBarcodeToList(barcode, description) {
//     const partList = document.getElementById('partlist-list');

//     // Check if the barcode exists in the list and handle it
//     if (checkAndHandleBarcode(barcode)) {
//         return; // If barcode is found and handled, don't add it again
//     }

//     // Create a new list item for the scanned barcode
//     const listItem = document.createElement('li');
//     listItem.style.display = "flex";
//     listItem.style.alignItems = "center";
//     listItem.style.gap = "10px";

//     // Create a checkbox
//     const checkbox = document.createElement('input');
//     checkbox.type = 'checkbox';
//     checkbox.style.cursor = 'pointer';

//     // Style the checkbox based on the checked state
//     checkbox.onchange = () => {
//         if (checkbox.checked) {
//             checkbox.style.accentColor = 'green';
//         } else {
//             checkbox.style.accentColor = '';
//         }
//     };

//     // Create a span to display the barcode and description
//     const barcodeText = document.createElement('span');
//     barcodeText.textContent = `${barcode} - ${description}`;
//     barcodeText.setAttribute('data-barcode', barcode); // Add data attribute for exact matching

//     // Add a remove button
//     const removeButton = document.createElement('button');
//     removeButton.textContent = 'X';
//     removeButton.onclick = () => {
//         partList.removeChild(listItem);
//     };

//     // Append the elements to the list item
//     listItem.appendChild(checkbox);
//     listItem.appendChild(barcodeText);
//     listItem.appendChild(removeButton);

//     // Append the list item to the part list
//     partList.appendChild(listItem);
// }

function addBarcodeToTable(barcode, description, routing) {
    const tableBody = document.getElementById('table-body');

    // Check if the barcode exists in the table
    const existingRows = Array.from(tableBody.children);
    for (const row of existingRows) {
        const span = row.querySelector('span[data-barcode]');
        if (span && span.getAttribute('data-barcode') === barcode) {
            return; // If barcode exists, do nothing
        }
    }

    // Create a new row
    const row = document.createElement('tr');

    // Create cells for barcode, description, routing, checkbox, and remove button
    const barcodeCell = document.createElement('td');
    const descriptionCell = document.createElement('td');
    const routingCell = document.createElement('td');
    const checkboxCell = document.createElement('td'); // New column for checkbox
    const removeCell = document.createElement('td'); // Optional: Remove button

    // Barcode cell with span
    const barcodeSpan = document.createElement('span');
    barcodeSpan.textContent = barcode;
    barcodeSpan.setAttribute('data-barcode', barcode); // Add data attribute for exact matching
    barcodeCell.appendChild(barcodeSpan);

    // Description cell
    descriptionCell.textContent = description || "N/A";

    // Routing cell
    routingCell.textContent = routing || "N/A";

    // Checkbox cell
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.cursor = 'pointer';
    checkbox.style.width = '16px';
    checkbox.style.height = '16px';
    checkbox.onchange = () => {
        if (checkbox.checked) {
            checkbox.style.backgroundColor = 'green'; // Change background to green
            checkbox.style.borderColor = 'green'; // Change border to green
        } else {
            checkbox.style.backgroundColor = ''; // Reset background
            checkbox.style.borderColor = ''; // Reset border
        }
    };
    checkboxCell.appendChild(checkbox);

    // Optional: Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
    removeButton.style.cursor = 'pointer';
    removeButton.onclick = () => {
        tableBody.removeChild(row);
    };
    removeCell.appendChild(removeButton);

    // Append all cells to the row
    row.appendChild(barcodeCell);
    row.appendChild(descriptionCell);
    row.appendChild(routingCell);
    row.appendChild(checkboxCell); // Append checkbox cell
    row.appendChild(removeCell); // Optional: Append remove button cell

    // Append the row to the table body
    tableBody.appendChild(row);
}


async function handleBarcodeKeyPress(event) {
    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();

        const barcodeInput = document.getElementById('barcode');
        const barcodeValue = barcodeInput.value.trim();

        if (!barcodeValue) {
            console.error('Barcode is empty');
            return;
        }

        const now = Date.now();
        if (now - lastBarcodeSubmissionTime < BARCODE_SUBMISSION_COOLDOWN_MS) {
            console.warn("Cooldown in effect. Ignoring duplicate scan.");
            return;
        }

        lastBarcodeSubmissionTime = now;

        // Clear the input field
        barcodeInput.value = '';

        // Fetch and add parts, including the scanned barcode
        await fetchAndAddParts(barcodeValue);
    }
}


// Global variables for barcode scanning
if (typeof scanning === 'undefined') {
    var scanning = false;
}
if (typeof barcode === 'undefined') {
    var barcode = '';
}
if (typeof scanTimeout === 'undefined') {
    var scanTimeout = null;
}


// Scan types configurations
var scanTypes = [
    {
        pattern: /^[A-Za-z0-9]{12}$/, // 12-digit barcode
        validator: isValidBarcode,
        handler: handleBarcode,
        targetId: 'barcode'
    },
    {
        pattern: /^\d{4}$/, // 4-digit employee ID
        validator: isValidEmployeeID,
        handler: handleEmployeeID,
        targetId: 'employee-id'
    },
    {
        pattern: /^[A-Za-z0-9]{3}$/, // 3-digit resource ID 
        validator: isValidResourceID, 
        handler: handleResourceID, 
        targetId: 'work-area' 
    }
];


// Global barcode detection logic, moved to a named function
function handleGlobalKeydown(e) {
    console.log("keydown detected");
    // Initialize scanning state if not already set
    if (!scanning) {
        scanning = true;
        barcode = '';
        clearTimeout(scanTimeout);
    }

    // Filter out non-alphanumeric keys and Enter key
    if (/^[A-Za-z0-9]$/.test(e.key)) {
        barcode += e.key; // Accumulate the character if it's alphanumeric
    } else if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission if any

        // Check each scan type and handle accordingly
        let handled = false;
        for (let type of scanTypes) {
            if (type.validator(barcode)) {
                type.handler(barcode, type.targetId);
                handled = true;
                break;
            }
        }
        if (!handled) {
            console.log("Unrecognized scan type:", barcode);
        }

        // Reset barcode for the next scan
        barcode = '';
        scanning = false;
    }

    // Reset the barcode accumulation if there is a pause (to detect a new scan)
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
        barcode = ''; // Clear the barcode if no keys are pressed within a short period
        scanning = false;
    }, 250); // Adjust the timeout as necessary for your scanner speed
}



// Validator functions
function isValidBarcode(code) {
    return scanTypes[0].pattern.test(code);
}

function isValidEmployeeID(code) {
    return scanTypes[1].pattern.test(code);
}

function isValidResourceID(code) {
    return scanTypes[2].pattern.test(code);
}


// Handler functions
function handleBarcode(code, targetId) {
    const barcodeInput = document.getElementById(targetId);
    barcodeInput.value = code; // Set the value from the scan
    // barcodeInput.focus(); // Set focus to the barcode input

    // Create a new event to simulate barcode entry
    const event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });

    // Dispatch the event to trigger handleDynamicInputs
    barcodeInput.dispatchEvent(event);

    // Directly invoke the processing logic instead of simulating an Enter key press
    processBarcodeInput(barcodeInput);    
}

function handleEmployeeID(code, targetId) {
    const employeeIDInput = document.getElementById(targetId);
    console.log('Employee ID before update:', employeeIDInput.value);  // Log the current value
    employeeIDInput.value = code;  // Update with new code
    console.log('Employee ID after update:', employeeIDInput.value);  // Confirm it updates
    employeeIDInput.dispatchEvent(new Event('change'));  // Ensure any change handlers are triggered
    document.activeElement.blur();
}

function handleResourceID(code, targetId) {
    const resourceIDInput = document.getElementById(targetId);
    console.log('Resource before update:', resourceIDInput.value);
    resourceIDInput.value = code;
    console.log('Resource after update:', resourceIDInput.value);
    resourceIDInput.dispatchEvent(new Event('change'));
    // document.getElementById(targetId).focus();
    document.activeElement.blur();
}


async function processBarcodeInput(barcodeInput) {
    console.log("Processing barcode input");

    // Check if the submission is within the cooldown period
    const now = Date.now();
    if (now - lastBarcodeSubmissionTime < BARCODE_SUBMISSION_COOLDOWN_MS) {
        console.log('Cooldown in effect, ignoring submission');
        return; // Skip submission
    }
    lastBarcodeSubmissionTime = now; // Update the last submission timestamp

    const form = barcodeInput.closest('form'); // Assuming the barcode input is within a form

    if (form && !form.checkValidity()) {
        form.reportValidity(); // Show validation messages if form is invalid
        return;
    }

    try {
        await handleBarcodeScan_to_DB(); // Wait for the DB operation to complete
        updatePartCountsOnScan();        // Then update parts counts
        updateEEJobListDay();            // Update other UI elements
        updateAreaProgressBar();
        document.activeElement.blur();
    } catch (error) {
        console.error('Failed to process barcode input:', error);
    }
}





// Handles dynamic inputs and changes specific to the production dashboard
function handleDynamicInputs(event) {
    // This ensures the correct handling of the orderID value
    const orderIDField = document.getElementById('order-id');
    const workAreaSelect = document.getElementById('work-area');
    const employeeIDField = document.getElementById('employee-id');

    const orderID = orderIDField ? orderIDField.value : null;
    const workArea = workAreaSelect ? workAreaSelect.value : null;
    const employeeID = employeeIDField ? employeeIDField.value : null;

    // Handle barcode input
    if (event.target.id === 'barcode' && event.target.value.length === 12) {
        orderIDField.value = event.target.value.substring(0, 8);
        fetchJobNotifications(orderIDField.value);
        // fetchOrderTotalCount(orderIDField.value);        

        if (workArea && workArea !== '') {
            fetchOrderTotalAreaCount(orderIDField.value, workAreaSelect.value);                        
        } else {
            console.log("Work Area not selected");
        }
    }

    // Listen for changes in 'employee-id' or 'work-area' elements
    if (event.target.id === 'employee-id' && employeeID.length === 4|| event.target.id === 'work-area') {
        updatePartCountsOnInputs(employeeID, workArea);

        if (orderID && orderID.length === 8 && workArea && workArea !== "" && employeeID) {
            fetchOrderAreaScannedCount(orderID, workArea, employeeID);
            // fetchOrderTotalAreaCount(orderID, workArea);
        }else if (orderID && orderID.length === 8 && workArea && workArea !== "") {
            // fetchOrderTotalAreaCount(orderID, workArea);
        }
    } else if (event.target.id === 'employee-id' && employeeID.length != 0) {
        resetEmployeeData();
    }

    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id' && orderID.length === 8) {
        fetchJobNotifications(orderID);
        // fetchOrderTotalCount(orderID);

        // Verify that the work area has a valid selection
        if (workArea && workArea !== "") {
            // fetchOrderTotalAreaCount(orderID, workArea);
            updateAreaProgressBar();
        } else {
            console.log("Order ID or Work Area is not properly selected.");
            // Optionally, alert the user or handle the error in the UI
        }

        if (employeeID) {
            fetchOrderAreaScannedCount(orderID, workArea, employeeID);
        }
    } else if (event.target.id === 'order-id' && orderID.length != 0) {
        resetNotifications()
        resetMissingPartsTable()
    }

    if (event.target.id === 'work-area' && workArea !== '') {
        if (orderID && orderID.length === 8) {
            // fetchOrderTotalAreaCount(orderID, workArea);
            updateAreaProgressBar()
        } else {
            console.log("Order ID or Work Area is not properly selected.");
            // Optionally, alert the user or handle the error in the UI
        }
    }
}


function updatePartCountsOnInputs(employeeID, workArea) {
    if (employeeID.length === 4) {
        if (workArea) {
            fetchAreaPartsCount(employeeID, workArea);
            fetchEETotalPartsCount(employeeID);
            fetchEEJobListDay(employeeID);
        } else {
            fetchEETotalPartsCount(employeeID);
            fetchEEJobListDay(employeeID);
        }
        if (!workArea) {
            document.getElementById('partcount-area').textContent = 0;
        }
    }
}



function updatePartCountsOnScan() {
    const employeeID = document.getElementById('employee-id').value;
    const workAreaSelect = document.getElementById('work-area');
    const workArea = workAreaSelect.value;
    const orderID = document.getElementById('order-id').value.trim();
    fetchAreaPartsCount(employeeID, workArea);
    fetchEETotalPartsCount(employeeID);
    fetchOrderAreaScannedCount(orderID, workArea, employeeID);

}

function updateEEJobListDay() {
    const employeeID = document.getElementById('employee-id').value;
    fetchEEJobListDay(employeeID)
}


// Event handler for fetching parts not scanned by shipping
function handleFetchPartsNotScanned() {
    const orderID = document.getElementById('order-id').value.trim();
    const workAreaField = document.getElementById('work-area').value;
    if (orderID) {
        fetchPartsNotScanned(orderID, workAreaField);  // This function will be defined in global.js
    }
}

function resetBarcodeField() {
    console.log("Resetting barcode field")
    const barcodeField = document.getElementById('barcode');
    barcodeField.value = ''
}


function resetNotifications() {
    console.log("Resetting notifications for invalid or no order ID");
    const notificationListElement = document.getElementById('notification-list');
    console.log("Clearing notifications");
    if (notificationListElement) {
        notificationListElement.innerHTML = ''; // Clear existing notifications
}
}

function resetMissingPartsTable() {
    console.log("Resetting missing parts table for invalid or no order ID");

    const tableBody = document.getElementById('table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
        }
}

function resetEmployeeData() {
    console.log("Resetting employee data")
    const jobListContainer = document.querySelector('.job-list');
    
    document.getElementById('ordercount-area').textContent = '0';
    jobListContainer.innerHTML = ''
    document.getElementById('partcount-emp').textContent = '0';
    document.getElementById('partcount-area').textContent = '0';
}


function handleReportDefect() {
    // Display the modal
    var modal = document.getElementById("defectModal");
    modal.style.display = "block";

    // Optional: Pre-fill any fields in the modal based on existing data
    // For example, automatically filling in the barcode or employee ID
    var orderIDField = document.getElementById('order-id').value;
    var employeeIDField = document.getElementById('employee-id').value;
    var workAreaField = document.getElementById('work-area');
    var workAreaDefectField = document.getElementById('work-area-defect');

    // Clear existing options in modal's work area select
    workAreaDefectField.innerHTML = '';

    // Copy all options from the main form's work area select to the modal's select
    for (var i = 0; i < workAreaField.options.length; i++) {
        var opt = workAreaField.options[i];
        var newOption = new Option(opt.text, opt.value, opt.defaultSelected, opt.selected);
        workAreaDefectField.options.add(newOption);
    }

    // Set selected values
    document.getElementById('order-id-defect').value = orderIDField;
    document.getElementById('defect-employee-id').value = employeeIDField;
}

// Close the modal with the close button
var span = document.getElementsByClassName("close")[0];
span.onclick = function() {
    var modal = document.getElementById("defectModal");
    modal.style.display = "none";
}

// Close the modal by clicking outside of it
window.onclick = function(event) {
    var modal = document.getElementById("defectModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
}



function handleSubmitDefect() {
    let orderID = document.getElementById('order-id-defect').value;
    let defectType = document.getElementById('defect-type').value;
    let defectDetails = document.getElementById('defect-detail').value;
    let defectAction = document.getElementById('defect-action').value;
    let employeeID = document.getElementById('defect-employee-id').value;
    let resource = document.getElementById('work-area-defect').value;
    let barcode = document.getElementById('defect-barcode').value;
    
    const payload = {
        OrderID: orderID,
        DefectType: defectType,
        DefectDetails: defectDetails,
        DefectAction: defectAction,
        EmployeeID: employeeID,
        Resource: resource,
        Barcode: barcode
    };

        // Assuming the server endpoint URL is '/api/submit-defect'
    fetch('/api/submit-defect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        alert('Defect submitted successfully!');
        // Optionally, clear the form or redirect the user
    })
    .catch(error => {
        console.error('Error submitting defect:', error);
        alert('Failed to submit defect. Please try again.');
    });
}


// Define the barcode scanning function outside to keep its reference
function handleSubmitButton(event) {    
    console.log("Submit button clicked");
    event.preventDefault(); // Prevent the default form submission

    const form = document.getElementById('defect-submission');
    if (!form.checkValidity()) {
        form.reportValidity(); // Show validation messages if form is invalid
        return;
    }

    try {
        handleSubmitDefect(); // Call the function to handle the defect submission
    } catch (error) {
        console.error('Failed to submit defect:', error);
    }
}



async function updateAreaProgressBar() {
    console.log("Updating progress bar");
    const orderIDField = document.getElementById('order-id');
    const workAreaSelect = document.getElementById('work-area');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    const orderID = orderIDField ? orderIDField.value : null;
    const workArea = workAreaSelect ? workAreaSelect.value : null;

    try {
        // Ensure both promises are awaited properly
        const partCountResponse = await fetchOrderTotalAreaCount(orderID, workArea);
        const currentCountResponse = await fetchMachineGroupScanCount(orderID, workArea);

        const partCount = partCountResponse.area_total_count; // Assuming the response has this structure
        const currentCount = currentCountResponse.order_machinegroup_scan_count; // Assuming the response has this structure

        console.log(`Part count: ${partCount}, Current count: ${currentCount}`);

        if (partCount > 0 && currentCount !== undefined) {
            const percentComplete = (currentCount / partCount) * 100;
            progressBar.value = percentComplete;
            progressText.textContent = `${Math.round(percentComplete)}%`;

            console.log(`Progress bar updated to ${Math.round(percentComplete)}% completion.`);

            if (Math.round(percentComplete) === 100) {
                progressBar.classList.add('complete');
            } else {
                progressBar.classList.remove('complete');
            }
        } else {
            progressBar.value = 0;
            progressText.textContent = "0%";
            progressBar.classList.remove('complete');
            console.log("No parts to count, progress bar reset.");
        }
    } catch (error) {
        console.error("Failed to update progress bar:", error);
        progressBar.value = 0;
        progressText.textContent = "0%";
        progressBar.classList.remove('complete');
    }
}

