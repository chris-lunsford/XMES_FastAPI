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
    // listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
    listenerManager.addListener(document.getElementById('report-defect'), 'click', handleReportDefect);
    listenerManager.addListener(document.getElementById('submit-defect-button'), 'click', handleSubmitButton);
    listenerManager.addListener(document.getElementById('clear-table-button'), 'click', clearPartTable);

    listenerManager.addListener(document.getElementById('start-article-button'), 'click', submitParts);
    listenerManager.addListener(document.getElementById('stop-article-button'), 'click', stopArticle);
    listenerManager.addListener(document.getElementById('complete-article-button'), 'click', completeArticle);
    

    // Add event listener for barcode field
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


async function clearPartTable() {
    const cabInfoSpan = document.getElementById('cab-info');   
    cabInfoSpan.textContent = ""; 
    const articleIdSpan = document.getElementById('article-id');
    articleIdSpan.textContent ="";
    
    const tableBody = document.getElementById('table-body');

    try {
        // Confirm with the user before clearing the table
        const confirmation = confirm("Are you sure you want to clear the table?");
        if (confirmation) {
            // Remove all rows from the table
            while (tableBody.firstChild) {
                tableBody.removeChild(tableBody.firstChild);
            }
            console.log("Table cleared successfully.");
            // alert("The table has been cleared.");
        } else {
            console.log("Table clear action canceled.");
        }
    } catch (error) {
        console.error("Failed to clear the table:", error);
        alert(`Error clearing the table: ${error.message}`);
    }
}

async function fetchAndAddParts() {
    const barcodeInput = document.getElementById('barcode');
    const barcode = barcodeInput.value.trim();
    const tableBody = document.getElementById('table-body');

    if (!barcode) return; // Prevent empty submissions

    showLoadingSpinner(); // Show the spinner before the API call

    try {
        console.log(`Processing barcode: ${barcode}`);

        let response;
        const tableIsEmpty = tableBody.children.length === 0;

        if (tableIsEmpty) {
            response = await fetch(`/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}&loadAll=true`);
        } else {
            response = await fetch(`/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}&loadAll=false`);
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        let parts = data.parts;

        if (!Array.isArray(parts)) {
            parts = [parts];
        }

        if (parts.length === 0) {
            alert("No parts found for this barcode.");
            return;
        }

        // Extract barcodes to check if they exist in Fact_Part_Usage
        const barcodesToCheck = parts.map(part => part.BARCODE);

        // Check if barcodes are already used in the system
        const existsResponse = await fetch('/api/check-parts-exist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcodes: barcodesToCheck })
        });

        const existsData = await existsResponse.json();
        const existingBarcodes = new Set(existsData.existingBarcodes);

        // Process parts
        for (const part of parts) {
            const isChecked = checkAndHandleBarcode(part.BARCODE);

            if (isChecked === null) {
                // Add the part to the table and mark it if already used
                addBarcodeToTable(
                    part.BARCODE, 
                    part.INFO1, 
                    part.CabinetNumber, 
                    part.ORDERID, 
                    part.ARTICLE_ID, 
                    existingBarcodes.has(part.BARCODE)
                );
            }
        }

        // ✅ Mark the scanned barcode's checkbox as green
        console.log(`Checking barcode: ${barcode}`);
        const isScannedChecked = checkAndHandleBarcode(barcode);

        if (isScannedChecked) {
            alert(`This barcode is already in the table and checked green - "${barcode}"`);
        } else if (isScannedChecked === false) {
            markBarcodeCheckedGreen(barcode);
        }

        // Clear the input field
        barcodeInput.value = '';
    } catch (error) {
        console.error("Failed to fetch parts:", error);
        alert("Error fetching parts: " + error.message);
    } finally {
        hideLoadingSpinner();
    }
}


// async function fetchAndAddParts() {
//     const barcodeInput = document.getElementById('barcode');
//     const barcode = barcodeInput.value.trim();
//     const tableBody = document.getElementById('table-body');

//     showLoadingSpinner(); // Show the spinner before the API call

//     try {
//         console.log(`Processing barcode: ${barcode}`);

//         // Check if the table already has rows
//         const tableIsEmpty = tableBody.children.length === 0;

//         let response;

//         if (tableIsEmpty) {
//             // Table is empty, load all parts for the article
//             console.log("Table is empty. Fetching all parts for the article...");
//             response = await fetch(`/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}&loadAll=true`);
//         } else {
//             // Table is not empty, load only the specific part for the scanned barcode
//             console.log("Table is not empty. Fetching only the part for the scanned barcode...");
//             response = await fetch(`/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}&loadAll=false`);
//         }

//         if (!response.ok) {
//             throw new Error(`API Error: ${response.statusText}`);
//         }

//         const data = await response.json(); // The entire response object
//         let parts = data.parts; // Extract the parts from the response

//         // Ensure parts is always an array
//         if (!Array.isArray(parts)) {
//             parts = [parts]; // Convert single object into an array
//         }

//         if (Array.isArray(parts)) {
//             // Process the parts
//             for (const part of parts) {
//                 const isChecked = checkAndHandleBarcode(part.BARCODE);

//                 if (isChecked === null) {
//                     // Add the part to the table if it's not already there
//                     addBarcodeToTable(part.BARCODE, part.INFO1, part.CabinetNumber, part.ORDERID, part.ARTICLE_ID); // INFO1 is Description 
//                 }
//             }

//             // Mark the scanned barcode as green
//             console.log(`Checking barcode: ${barcode}`);
//             const isScannedChecked = checkAndHandleBarcode(barcode);
//             if (isScannedChecked) {
//                 alert(`This barcode is already in the table and checked green - "${barcode}"`);
//             } else if (isScannedChecked === false) {
//                 markBarcodeCheckedGreen(barcode);
//             }
//         } else if (parts.message) {
//             // Display the message from the server as a popup alert
//             alert(parts.message);
//         } else {
//             // Handle unexpected responses
//             alert("Unexpected response from the server.");
//         }

//         // Clear the input field after processing
//         barcodeInput.value = '';
//     } catch (error) {
//         console.error("Failed to fetch parts:", error);
//         alert("Error fetching parts: " + error.message);
//     } finally {
//         hideLoadingSpinner(); // Hide the spinner after the API call
//     }
// }


function checkAndHandleBarcode(barcode) {
    const partList = document.getElementById('table-body');
    const existingItems = Array.from(partList.children);
    console.log(`checkAndHandleBarcode: ${barcode}`);

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

function markBarcodeCheckedGreen(barcode) {
    const tableBody = document.getElementById('table-body');
    const rows = Array.from(tableBody.children);

    for (const row of rows) {
        const span = row.querySelector('span[data-barcode]');
        const checkbox = row.querySelector('input[type="checkbox"]');

        if (span && span.getAttribute('data-barcode') === barcode) {
            if (!checkbox.checked) {
                checkbox.checked = true;
                checkbox.style.backgroundColor = 'green'; // Change background to green
                checkbox.style.borderColor = 'black'; // Change border color to green
            }
            return; // Exit once the barcode is found and marked
        }
    }
}


function addBarcodeToTable(barcode, description, cabinfo, orderId, articleId, isUsed) {
    const tableBody = document.getElementById('table-body');

    // Only update cab-info and article-id if the table is empty
    if (tableBody.children.length === 0) {
        document.getElementById('cab-info').textContent = cabinfo || "N/A";
        document.getElementById('article-id').textContent = articleId || "N/A";
        document.getElementById('orderid').textContent = orderId || "N/A";
        document.getElementById('article-identifier').textContent = `${orderId || "N/A"}_${articleId || "N/A"}`;
    }

    // Check if barcode already exists in the table
    const existingRows = Array.from(tableBody.children);
    for (const row of existingRows) {
        const span = row.querySelector('span[data-barcode]');
        if (span && span.getAttribute('data-barcode') === barcode) {
            return; // Barcode already exists, do nothing
        }
    }

    // Create a new row
    const row = document.createElement('tr');

    // Create cells
    const barcodeCell = document.createElement('td');
    const descriptionCell = document.createElement('td');
    const checkboxCell = document.createElement('td');

    // Barcode span
    const barcodeSpan = document.createElement('span');
    barcodeSpan.textContent = barcode;
    barcodeSpan.setAttribute('data-barcode', barcode);

    // Green check if barcode is already used
    const checkMark = document.createElement('span');
    checkMark.classList.add("check-mark");
    if (isUsed) {
        checkMark.classList.add("green-check");
    }

    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
    removeButton.style.cursor = 'pointer';
    removeButton.onclick = () => {
        tableBody.removeChild(row);
    };

    // Append barcode and checkmark
    barcodeCell.appendChild(removeButton);
    barcodeCell.appendChild(barcodeSpan);
    barcodeCell.appendChild(checkMark);

    // Description cell
    descriptionCell.textContent = description || "N/A";

    // Checkbox cell
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.cursor = 'pointer';
    checkbox.style.width = '24px';
    checkbox.style.height = '24px';

    if (isUsed) {
        checkbox.checked = true;
        checkbox.disabled = true; // Prevent modification of used parts
        checkbox.style.backgroundColor = 'green'; // ✅ Mark as green immediately if already used
    } else {
        checkbox.onchange = () => {
            if (checkbox.checked) {
                checkbox.style.backgroundColor = 'green'; // ✅ Change background to green
                checkbox.style.borderColor = 'black'; // ✅ Change border color
            } else {
                checkbox.style.backgroundColor = ''; // Reset background
                checkbox.style.borderColor = ''; // Reset border
            }
        };
    }

    checkboxCell.appendChild(checkbox);

    // Append cells to row
    row.appendChild(barcodeCell);
    row.appendChild(descriptionCell);
    row.appendChild(checkboxCell);

    // Append row to table
    tableBody.appendChild(row);
}


// function addBarcodeToTable(barcode, description, cabinfo, orderId, articleId) {
//     const tableBody = document.getElementById('table-body');

//     // Only update cab-info and article-id if the table is empty.
//     if (tableBody.children.length === 0) {
//         const cabInfoSpan = document.getElementById('cab-info');
//         if (cabInfoSpan) {
//             cabInfoSpan.textContent = cabinfo || "N/A"; // Use cabinfo or "N/A" if not provided
//         }
//         const articleIdSpan = document.getElementById('article-id');
//         if (articleIdSpan) {
//             articleIdSpan.textContent = articleId || "N/A"; // Use articleId or "N/A"
//         }
//         const orderIdSpan = document.getElementById('orderid');
//         if (orderIdSpan) {
//             orderIdSpan.textContent = orderId || "N/A"; // Use articleId or "N/A"
//         }
//         // Combine orderid and article-id into article-identifier
//         const articleIdentifierSpan = document.getElementById('article-identifier');
//         if (articleIdentifierSpan) {
//             articleIdentifierSpan.textContent = `${orderId || "N/A"}_${articleId || "N/A"}`;
//         }
//     }

//     // Check if the barcode exists in the table
//     const existingRows = Array.from(tableBody.children);
//     for (const row of existingRows) {
//         const span = row.querySelector('span[data-barcode]');
//         if (span && span.getAttribute('data-barcode') === barcode) {
//             return; // If barcode exists, do nothing
//         }
//     }

//     // Create a new row
//     const row = document.createElement('tr');

//     // Create cells for barcode with remove button, description, routing, and checkbox
//     const barcodeCell = document.createElement('td');
//     const descriptionCell = document.createElement('td');
//     // const routingCell = document.createElement('td');
//     // const lastScanCell = document.createElement('td');
//     const checkboxCell = document.createElement('td');

//     // Create a container for barcode and button
//     const barcodeContainer = document.createElement('div');
//     barcodeContainer.style.display = 'flex';
//     barcodeContainer.style.alignItems = 'center'; /* Vertically center items */
//     barcodeContainer.style.justifyContent = 'flex-start'; /* Align items flush left */
//     barcodeContainer.style.gap = '20px'; /* Add spacing between barcode and button */

//     // Barcode span
//     const barcodeSpan = document.createElement('span');
//     barcodeSpan.textContent = barcode;
//     barcodeSpan.setAttribute('data-barcode', barcode); // Add data attribute for exact matching

//     // Remove button
//     const removeButton = document.createElement('button');
//     removeButton.textContent = 'X';
//     removeButton.style.cursor = 'pointer';
//     removeButton.style.marginRight = '20px'; // Add some spacing between the barcode and button
//     removeButton.onclick = () => {
//         tableBody.removeChild(row);
//     };

//     // Append the barcode and remove button to the same cell
//     barcodeCell.appendChild(removeButton);
//     barcodeCell.appendChild(barcodeSpan);
    

//     // Description cell
//     descriptionCell.textContent = description || "N/A";

//     // Routing cell
//     // routingCell.textContent = routing || "N/A";

//     // Last Scan cell
//     // lastScanCell.textContent = routing || "N/A";

//     // Checkbox cell
//     const checkbox = document.createElement('input');
//     checkbox.type = 'checkbox';
//     checkbox.style.cursor = 'pointer';
//     checkbox.style.width = '24px';
//     checkbox.style.height = '24px';
//     checkbox.onchange = () => {
//         if (checkbox.checked) {
//             checkbox.style.backgroundColor = 'green'; // Change background to green
//             checkbox.style.borderColor = 'black'; // Change border color
//         } else {
//             checkbox.style.backgroundColor = ''; // Reset background
//             checkbox.style.borderColor = ''; // Reset border
//         }
//     };
//     checkboxCell.appendChild(checkbox);

//     // Append all cells to the row
//     row.appendChild(barcodeCell); // Barcode and remove button in the same cell
//     row.appendChild(descriptionCell);
//     // row.appendChild(routingCell);
//     // row.appendChild(lastScanCell);
//     row.appendChild(checkboxCell);

//     // Append the row to the table body
//     tableBody.appendChild(row);
// }


async function handleBarcodeKeyPress(event) {    

     // Check validity of the barcode input field
     const barcodeInput = document.getElementById('barcode');
     const form = barcodeInput.closest('form'); // Assuming the barcode input is within a form

    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();

        // Check if the submission is within the cooldown period
        const now = Date.now();
        if (now - lastBarcodeSubmissionTime < BARCODE_SUBMISSION_COOLDOWN_MS) {
            console.log('Cooldown in effect, ignoring submission');
            // Clear the input field after processing
            barcodeInput.value = '';
            return; // Skip submission
        }
        lastBarcodeSubmissionTime = now; // Update the last submission timestamp

       

        if (form && !form.checkValidity()) {
            form.reportValidity(); // Show validation messages if form is invalid
            return;
        }

        try {
            await fetchAndAddParts();
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




function collectTableData() {
    const tableBody = document.getElementById('table-body');
    const rows = Array.from(tableBody.children);
    
    let partsData = [];
    let allChecked = true;

    rows.forEach(row => {
        const barcodeSpan = row.querySelector('span[data-barcode]');
        const descriptionCell = row.children[1]; // Description column
        const checkbox = row.querySelector('input[type="checkbox"]');

        if (barcodeSpan && descriptionCell && checkbox) {
            partsData.push({
                Barcode: barcodeSpan.textContent.trim(),
                Description: descriptionCell.textContent.trim(),
                Scanned: checkbox.checked ? "Checked" : "Unchecked"
            });
            if (!checkbox.checked) {
                allChecked = false; // Found an unchecked box
            }
        }
    });

    return { partsData, allChecked };
}


function collectFormData(actionType) {
    return {
        EmployeeID: document.getElementById('employee-id').value.trim() || "N/A",
        Resource: document.getElementById('work-area').value.trim() || "N/A",
        CustomerID: document.getElementById('customer-id').value.trim() || "N/A",
        OrderID: document.getElementById('orderid').textContent.trim() || "N/A",
        Cab_Info3: document.getElementById('cab-info').textContent.trim() || "N/A",
        Article_ID: document.getElementById('article-id').textContent.trim() || "N/A",
        PartDestination: document.getElementById('article-identifier').textContent.trim() || "N/A",
        
    };
}




async function submitParts() {
    console.log("submitParts function called!");
    showLoadingSpinner();
    const { partsData, allChecked } = collectTableData();
    const formData = collectFormData();

    if (partsData.length === 0) {
        alert("No parts to submit!");
        hideLoadingSpinner();
        return;
    }

    // ✅ Stop submission if not all parts are checked
    if (!allChecked) {
        alert("All parts must be checked before submitting.");
        hideLoadingSpinner();
        return;
    }

    try {
        // ✅ Extract barcodes to check which ones exist
        const barcodes = partsData.map(part => part.Barcode);
        const existsResponse = await fetch('/api/check-parts-exist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcodes })
        });

        if (!existsResponse.ok) {
            throw new Error(`Failed to check existing parts: ${existsResponse.statusText}`);
        }

        const existsData = await existsResponse.json();
        const existingBarcodes = new Set(existsData.existingBarcodes);

        // ✅ Filter out new parts that need to be submitted
        const newParts = partsData.filter(part => !existingBarcodes.has(part.Barcode));

        let partsSubmitted = false;
        let isSubAssembly = false;

        // ✅ Check if ANY part belongs to a sub-assembly
        if (newParts.length > 0) {
            const firstBarcode = newParts[0].Barcode; // Check the first barcode only
            const partCheckResponse = await fetch(`/api/fetch-parts-in-article?barcode=${firstBarcode}&loadAll=true`);

            if (!partCheckResponse.ok) {
                throw new Error(`Failed to check part assembly: ${partCheckResponse.statusText}`);
            }

            const partCheckData = await partCheckResponse.json();
            isSubAssembly = partCheckData.is_sub_assembly; // ✅ Check global sub-assembly flag
        }

        // ✅ If there are new parts, submit them
        if (newParts.length > 0) {
            const payload = newParts.map(part => ({
                Barcode: part.Barcode,
                Description: part.Description,
                OrderID: formData.OrderID,
                Cab_Info3: formData.Cab_Info3,
                EmployeeID: formData.EmployeeID,
                Resource: formData.Resource,
                CustomerID: formData.CustomerID,
                Article_ID: formData.Article_ID,
                Status: "Used",
                PartDestination: formData.PartDestination
            }));

            const response = await fetch('/api/submit-parts-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parts: payload })
            });

            if (!response.ok) {
                throw new Error(`Failed to submit parts: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`Parts submission success: ${result.message}`);
            partsSubmitted = true;
        } else {
            console.log("All parts were already submitted.");
        }

        // ✅ If it's NOT a sub-assembly, start article time
        if (!isSubAssembly) {
            const startArticlePayload = {
                ARTICLE_IDENTIFIER: formData.PartDestination, 
                ORDERID: formData.OrderID,
                CAB_INFO3: formData.Cab_Info3,
                EMPLOYEEID: formData.EmployeeID,
                RESOURCE: formData.Resource,
                CUSTOMERID: formData.CustomerID,
                ARTICLE_ID: formData.Article_ID
            };

            const startArticleResponse = await fetch('/api/start-article-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(startArticlePayload)
            });

            if (!startArticleResponse.ok) {
                // ✅ Handle warning case when a start scan already exists
                const errorData = await startArticleResponse.json();
                if (startArticleResponse.status === 400) {
                    console.warn(`Start article time warning: ${errorData.detail}`);
                    alert(errorData.detail); // Show the error message returned from Python
                    hideLoadingSpinner();
                    return;
                } else {
                    throw new Error(`Failed to start article time: ${startArticleResponse.statusText}`);
                }
            }

            console.log("Start article time recorded successfully!");
        } else {
            console.log("Skipping article time tracking because this is a sub-assembly.");
        }

        hideLoadingSpinner();
        alert(partsSubmitted ? (isSubAssembly ? "Parts submitted (Sub-Assembly detected, no article time tracked)." : "Parts submitted successfully, start time recorded") : "Article start time recorded.");

    } catch (error) {
        console.error("Error:", error);
        alert(`Error: ${error.message}`);
        hideLoadingSpinner();
    }
}





async function stopArticle() {
    console.log("stopArticle function called!");
    showLoadingSpinner();
    const formData = collectFormData();

    try {        
        // ✅ Record the article stop time
        const stopArticlePayload = {
            ARTICLE_IDENTIFIER: formData.PartDestination, 
            ORDERID: formData.OrderID,
            CAB_INFO3: formData.Cab_Info3,
            EMPLOYEEID: formData.EmployeeID,
            RESOURCE: formData.Resource,
            CUSTOMERID: formData.CustomerID,
            ARTICLE_ID: formData.Article_ID
        };

        const stopArticleResponse = await fetch('/api/stop-article-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stopArticlePayload)
        });

        if (!stopArticleResponse.ok) {
            // ✅ Handle warning case when a stop scan already exists
            const errorData = await stopArticleResponse.json();
            if (stopArticleResponse.status === 400) {
                console.warn(`Stop article time warning: ${errorData.detail}`);
                alert(errorData.detail); // Show the error message returned from Python
                hideLoadingSpinner();
                return;
            } else {
                throw new Error(`Failed to stop article time: ${stopArticleResponse.statusText}`);
            }
        }

        const stopArticleResult = await stopArticleResponse.json();
        console.log(`Stop article time success: ${stopArticleResult.message}`);
        alert("Article stop time recorded!");


        hideLoadingSpinner();

    } catch (error) {
        console.error("Error:", error);
        alert(`Error: ${error.message}`);
        hideLoadingSpinner();
    }

}


async function completeArticle() {
    console.log("completeArticle function called");
    showLoadingSpinner();
    const formData = collectFormData();

    try {        
        // ✅ Record the article stop time
        const completeArticlePayload = {
            ARTICLE_IDENTIFIER: formData.PartDestination, 
            ORDERID: formData.OrderID,
            CAB_INFO3: formData.Cab_Info3,
            EMPLOYEEID: formData.EmployeeID,
            RESOURCE: formData.Resource,
            CUSTOMERID: formData.CustomerID,
            ARTICLE_ID: formData.Article_ID
        };
    
        const completeArticleResponse = await fetch('/api/complete-article-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeArticlePayload)
        });

        if (!completeArticleResponse.ok) {
            // ✅ Handle warning case when a stop scan already exists
            const errorData = await completeArticleResponse.json();
            if (completeArticleResponse.status === 400) {
                console.warn(`Complete article time warning: ${errorData.detail}`);
                alert(errorData.detail); // Show the error message returned from Python
                hideLoadingSpinner();
                return;
            } else {
                throw new Error(`Failed to complete article time: ${completeArticleResponse.statusText}`);
            }
        }

        const completeArticleResult = await completeArticleResponse.json();
        console.log(`Complete article time success: ${completeArticleResult.message}`);
        alert("Article complete time recorded!");

        hideLoadingSpinner();

    } catch (error) {
        console.error("Error:", error);
        alert(`Error: ${error.message}`);
        hideLoadingSpinner();
    }

}