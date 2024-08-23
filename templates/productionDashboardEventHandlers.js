/***** Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/production'].callback = initializeProductionDashboard;
}


// Define the barcode scanning function outside to keep its reference
async function handleBarcodeKeyPress(event) {
    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();

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
            // resetBarcodeField();             // Handled in handleBarcodeScan_to_DB 
        } catch (error) {
            console.error('Failed to scan barcode to DB:', error)
        }
    }
}


function initializeProductionDashboard() {
    console.log("Initializing Production Dashboard");
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
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'keypress', handleBarcodeKeyPress);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);    
    listenerManager.addListener(document.getElementById('report-defect'), 'click', handleReportDefect);
    listenerManager.addListener(document.getElementById('submit-defect-button'), 'click', handleSubmitButton);
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

