/***** Machine Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/machine-production'].callback = initializeMachineProductionDashboard;
}



function initializeMachineProductionDashboard() {
    console.log("Initializing MAchine Production Dashboard");
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
    if (window.machineProductionDashboardInitialized) return;
    window.machineProductionDashboardInitialized = true;   
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'keypress', handleBarcodeKeyPress);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);    
    listenerManager.addListener(document.getElementById('report-defect'), 'click', handleReportDefect);
    listenerManager.addListener(document.getElementById('submit-defect-button'), 'click', handleSubmitButton);

    // Setup barcode-related event handlers
    listenerManager.addListener(document.getElementById('barcode'), 'keydown', handleBarcodeKeyPress);
    listenerManager.addListener(document, 'keydown', handleGlobalKeydown);
}


// let lastBarcodeSubmissionTime = 0; // Track the last barcode submission timestamp
if (typeof window.lastBarcodeSubmissionTime === 'undefined') {
    window.lastBarcodeSubmissionTime = 0;
  }
// const BARCODE_SUBMISSION_COOLDOWN_MS = 2000; // Set a 2-second cooldown
if (typeof window.BARCODE_SUBMISSION_COOLDOWN_MS === 'undefined') {
    window.BARCODE_SUBMISSION_COOLDOWN_MS = 2000;
}


async function handleBarcodeKeyPress(event) {
    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();

        // Check if the submission is within the cooldown period
        const now = Date.now();
        if (now - lastBarcodeSubmissionTime < BARCODE_SUBMISSION_COOLDOWN_MS) {
            console.log('Cooldown in effect, ignoring submission');
            return; // Skip submission
        }
        lastBarcodeSubmissionTime = now; // Update the last submission timestamp

        // Check validity of the barcode input field
        const barcodeInput = document.getElementById('barcode');
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
        } catch (error) {
            console.error('Failed to scan barcode to DB:', error);
        }
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

