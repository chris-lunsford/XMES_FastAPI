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
    populateAssemblyWorkAreas(); // Populate work areas
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

var lastScannedBarcode = lastScannedBarcode || null;

async function clearPartTable() {
    const cabInfoSpan = document.getElementById('cab-info');   
    cabInfoSpan.textContent = ""; 
    const cabStatusSpan = document.getElementById('cab-status');   
    cabStatusSpan.textContent = ""; 
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
            // Clear the assembly and article status from dataset
            tableBody.dataset.articleStatus = "";
            tableBody.dataset.assemblyStatus = "";

            // Clear the barcode variable
            lastScannedBarcode = null; 

            console.log("Table cleared successfully.");
            // alert("The table has been cleared.");
            resetButtonStates();
        } else {
            console.log("Table clear action cancelled.");
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

        // Define tableIsEmpty up front so it's available to both "new" and "used" logic
        const tableIsEmpty = (tableBody.children.length === 0);

        // 1) Check if part is "new" or "used"
        const statusRes = await fetch(`/api/check_part_status/?barcode=${encodeURIComponent(barcode)}`);
        if (!statusRes.ok) {
            throw new Error(`Failed to check part status: ${statusRes.statusText}`);
        }
        const statusData = await statusRes.json();
        console.log("Part status:", statusData);

        let response;
        let urlToFetch;
        
        // 2) If it's new, use your existing logic for /api/fetch-parts-in-article
        if (statusData.part_status === "new") {
            console.log("Part is new, fetching from /api/fetch-parts-in-article");

            // If the table is empty => loadAll=true, else => loadAll=false
            const loadAllParam = tableIsEmpty ? "true" : "false";

            urlToFetch = `/api/fetch-parts-in-article?barcode=${encodeURIComponent(barcode)}&loadAll=${loadAllParam}`;
        } 
        // 3) If it's used, fetch from /api/fetch-used-article
        else {
            console.log("Part is used, fetching from /api/fetch-used-article");
            
            const usedIdentifier = statusData.article_identifier; 
            if (!usedIdentifier) {
                throw new Error("Used part has no article_identifier");
            }

            // e.g. /api/fetch-used-article?identifier=someOrderID_SomeArticleID
            urlToFetch = `/api/fetch-used-article?identifier=${encodeURIComponent(usedIdentifier)}`;
        }

        // 4) Make the request to whichever URL we decided
        response = await fetch(urlToFetch);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        let parts = data.parts;

        if (!Array.isArray(parts)) {
            parts = [parts];
        }

        // 🚨 Only keep the scanned part if it's "used" and the table is NOT empty
        if (statusData.part_status === "used" && !tableIsEmpty) {
            parts = parts.filter(part => part.BARCODE === barcode);
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

        // ✅ Always check barcode status & mark green (even if table was empty)
        console.log(`Checking barcode: ${barcode}`);
        const isScannedChecked = checkAndHandleBarcode(barcode);

        if (isScannedChecked === false) {
            markBarcodeCheckedGreen(barcode);
        }

        // ✅ Suppress alert only if the table was initially empty
        if (!tableIsEmpty && isScannedChecked) {
            alert(`This barcode is already in the table and checked green - "${barcode}"`);
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


function checkAndHandleBarcode(barcode) {
    const partList = document.getElementById('table-body');
    const existingItems = Array.from(partList.children);
    console.log(`checkAndHandleBarcode: ${barcode}`);

    for (const item of existingItems) {
        const span = item.querySelector('span[data-barcode]');
        const checkbox = item.querySelector('input[type="checkbox"]');

        if (span && span.getAttribute('data-barcode') === barcode) {
            // If no checkbox, it's a "used" row
            if (!checkbox) {
                return true; // Treat it as “checked” or “already used”
            }
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
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                checkbox.style.backgroundColor = 'green';
                checkbox.style.borderColor = 'black';
            }
            updateStartButtonState();
            return; 
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
        // Compute and display the article identifier
        const articleIdentifier = `${orderId || "N/A"}_${articleId || "N/A"}`;
        document.getElementById('article-identifier').textContent = articleIdentifier;
    }

    // Check if barcode already exists in the table
    const existingRows = Array.from(tableBody.children);
    for (const row of existingRows) {
        const span = row.querySelector('span[data-barcode]');
        if (span && span.getAttribute('data-barcode') === barcode) {
            return; // Barcode already exists, do nothing
        }
    }

    // Compute the article identifier (same as above)
    const articleIdentifier = `${orderId || "N/A"}_${articleId || "N/A"}`;

    // Create a new row and tag it
    const row = document.createElement('tr');
    row.dataset.isUsed = isUsed ? "true" : "false";
    // If the part is used, store its used article ID; otherwise leave it blank.
    row.dataset.usedArticleIdentifier = isUsed ? articleIdentifier : "";

    // ▼ Store extra data on the row itself via data attributes
    row.dataset.orderId = orderId;
    row.dataset.articleId = articleId;
    row.dataset.isUsed = isUsed;

    // Create cells
    const barcodeCell = document.createElement('td');
    const descriptionCell = document.createElement('td');
    const statusCell = document.createElement('td');

    // Barcode span
    const barcodeSpan = document.createElement('span');
    barcodeSpan.textContent = barcode;
    barcodeSpan.setAttribute('data-barcode', barcode);

    
    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
    removeButton.style.cursor = 'pointer';
    removeButton.style.marginRight = '20px';
    removeButton.onclick = () => {
        tableBody.removeChild(row);
        // After removing a part, re-check the table
        updateStartButtonState();
    };

    // Append barcode and checkmark
    barcodeCell.appendChild(removeButton);
    barcodeCell.appendChild(barcodeSpan);

    // Description cell
    descriptionCell.textContent = description || "N/A";

    if (isUsed) {
        // 1) If this part was used, show a text label
        const usedLabel = document.createElement('span');
        usedLabel.textContent = 'USED';
        usedLabel.style.color = 'green';      // or something like '#00cc00'
        usedLabel.style.fontWeight = 'bold';  // make it stand out
        statusCell.appendChild(usedLabel);
    } else {
        // 2) Otherwise, create a normal checkbox for new parts
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cursor = 'pointer';
        checkbox.style.width = '24px';
        checkbox.style.height = '24px';
        
        checkbox.onchange = () => {
            // If you still want a green background for checked items
            if (checkbox.checked) {
                checkbox.style.backgroundColor = 'green';
                checkbox.style.borderColor = 'black';
            } else {
                checkbox.style.backgroundColor = '';
                checkbox.style.borderColor = '';
            }
            updateStartButtonState();
        };

        statusCell.appendChild(checkbox);
    }


    // Append cells to row
    row.appendChild(barcodeCell);
    row.appendChild(descriptionCell);
    row.appendChild(statusCell);

    // Append row to table
    tableBody.appendChild(row);
    
    // Update the Start button state whenever a row is added
    updateStartButtonState();    
}



async function handleBarcodeKeyPress(event) {    

     // Check validity of the barcode input field
     const barcodeInput = document.getElementById('barcode');
     const form = barcodeInput.closest('form'); // Assuming the barcode input is within a form

    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();

        // Get the scanned barcode value
        const barcode = barcodeInput.value.trim();

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
            console.log(`updateButtonStates for: ${barcode}`);
            const workArea = document.getElementById('work-area')?.value || '';
            await fetchAndAddParts();
            await updateButtonStates(barcode, workArea);
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
        lastScannedBarcode = event.target.value;  // Store barcode globally
        orderIDField.value = event.target.value.substring(0, 8);
        fetchJobNotifications(orderIDField.value);
    }

    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id' && orderID.length === 8) {
        fetchJobNotifications(orderID);
    } else if (event.target.id === 'order-id' && orderID.length != 0) {
        resetNotifications()
        resetMissingPartsTable()
    }

    if (event.target.id === 'work-area') {
        if (workArea && workArea !== '') {
            if (lastScannedBarcode) {
                updateButtonStates(lastScannedBarcode, workArea);
            } else {
                console.log("No barcode scanned yet.");
            }
        } else {
            console.warn("Work Area is not properly selected.");
        }
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

        if (barcodeSpan && descriptionCell) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            const isChecked = checkbox && checkbox.checked;

            const orderId = row.dataset.orderId; 
            const articleId = row.dataset.articleId;
            const isUsed = (row.dataset.isUsed === "true");

            partsData.push({
                Barcode: barcodeSpan.textContent.trim(),
                Description: descriptionCell.textContent.trim(),
                // If there's a checkbox, we use "Checked"/"Unchecked",
                // otherwise, if it's used, treat it as "Checked"
                Scanned: isUsed ? "Checked" : (isChecked ? "Checked" : "Unchecked"),
                OrderID: orderId,
                ArticleID: articleId
            });
            // If there's a checkbox, also update `allChecked` if not checked
            if (!isUsed && !isChecked) {
                allChecked = false;
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
        Used_Identifier: document.getElementById('article-identifier').textContent.trim() || "N/A",
        
    };
}




async function submitParts() {
    console.log("submitParts function called!");
    showLoadingSpinner();
    const { partsData, allChecked } = collectTableData();
    const formData = collectFormData();
    const workArea = document.getElementById("work-area")?.value || '';

    if (partsData.length === 0) {
        alert("No parts scanned, cannot start article!");
        hideLoadingSpinner();
        return;
    }

    // Get the first barcode from the scanned parts list
    const barcode = partsData.length > 0 ? partsData[0].Barcode : null;

    if (!barcode) {
        console.warn("No barcode found in the scanned parts table.");
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

        // Check if ANY part belongs to a sub-assembly
        if (newParts.length > 0) {
            const firstBarcode = newParts[0].Barcode; // Check the first barcode only
            const partCheckResponse = await fetch(`/api/fetch-parts-in-article?barcode=${firstBarcode}&loadAll=true`);

            if (!partCheckResponse.ok) {
                throw new Error(`Failed to check part assembly: ${partCheckResponse.statusText}`);
            }

            const partCheckData = await partCheckResponse.json();
            isSubAssembly = partCheckData.is_sub_assembly; // Check global sub-assembly flag
        }

        // If there are new parts, submit them
        if (newParts.length > 0) {
            const payload = newParts.map(part => ({
                Barcode: part.Barcode,
                Description: part.Description,
                Cab_Info3: formData.Cab_Info3,
                OrderID: part.OrderID,     
                Article_ID: part.ArticleID,           
                EmployeeID: formData.EmployeeID,
                Resource: formData.Resource,
                CustomerID: formData.CustomerID,
                Status: "Used",
                Used_OrderID: formData.OrderID,
                Used_ArticleID: formData.Article_ID,
                Used_Identifier: formData.Used_Identifier
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

        // If it's NOT a sub-assembly, start article time
        if (!isSubAssembly) {
            const startArticlePayload = {
                ARTICLE_IDENTIFIER: formData.Used_Identifier, 
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
                // Handle warning case when a start scan already exists
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

        // Update Button States after submission
        await updateButtonStates(barcode, workArea);

        hideLoadingSpinner();
        // alert(partsSubmitted ? (isSubAssembly ? "Parts submitted (Sub-Assembly detected, no article time tracked)." : "Parts submitted successfully, start time recorded") : "Article start time recorded.");

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
    const { partsData } = collectTableData();
    const workArea = document.getElementById("work-area")?.value || '';

    // ✅ Prevent submission if no parts are scanned
    if (partsData.length === 0) {
        alert("No parts scanned, cannot stop article!");
        hideLoadingSpinner();
        return;
    }

    // Get the first barcode from the scanned parts list
    const barcode = partsData.length > 0 ? partsData[0].Barcode : null;

    if (!barcode) {
        console.warn("No barcode found in the scanned parts table.");
        hideLoadingSpinner();
        return;
    }

    try {        
        // ✅ Record the article stop time
        const stopArticlePayload = {
            ARTICLE_IDENTIFIER: formData.Used_Identifier, 
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
        // alert("Article stop time recorded!");

        // Update Button States after submission
        await updateButtonStates(barcode, workArea);
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
    const { partsData } = collectTableData();
    const workArea = document.getElementById("work-area")?.value || '';

    // ✅ Prevent submission if no parts are scanned
    if (partsData.length === 0) {
        alert("No parts scanned, cannot complete article!");
        hideLoadingSpinner();
        return;
    }

    // Get the first barcode from the scanned parts list
    const barcode = partsData.length > 0 ? partsData[0].Barcode : null;

    if (!barcode) {
        console.warn("No barcode found in the scanned parts table.");
        hideLoadingSpinner();
        return;
    }

    try {        
        // ✅ Record the article stop time
        const completeArticlePayload = {
            ARTICLE_IDENTIFIER: formData.Used_Identifier, 
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
        // alert("Article complete time recorded!");

        // Update Button States after submission
        await updateButtonStates(barcode, workArea);
        hideLoadingSpinner();

    } catch (error) {
        console.error("Error:", error);
        alert(`Error: ${error.message}`);
        hideLoadingSpinner();
    }

}


//
// 1) The main server-based function for Start/Stop/Complete
//
// async function updateButtonStates(barcode, workArea) {
//     try {
//         if (!barcode || barcode.trim() === "") {
//             console.warn("updateButtonStates: No barcode provided.");
//             return;
//         }
//         if (!workArea) {
//             console.warn("updateButtonStates: No Work Area selected.");
//             return;
//         }
    
//         const response = await fetch(`/api/check_part_status_resource/?barcode=${encodeURIComponent(barcode)}&resource=${encodeURIComponent(workArea)}&t=${Date.now()}`);
//         if (!response.ok) {
//             throw new Error(`API Error: ${response.statusText}`);
//         }
    
//         const data = await response.json();
//         console.log("Part Status Response:", data);

//         // ▼ Store the assembly status on the table body
//         const table = document.getElementById("table-body");
//         const currentAssemblyStatus = table.dataset.assemblyStatus || "no record";
//         const newAssemblyStatus = data.assembly_status || "no record";

//         // 🚀 Allow updating only if status is blank or process-related changes occur
//         const isProcessStatusChange = ["running", "stopped", "complete"].includes(newAssemblyStatus);

//         if (currentAssemblyStatus === "no record" || currentAssemblyStatus === "" || isProcessStatusChange) {
//             table.dataset.assemblyStatus = newAssemblyStatus;
//             table.dataset.articleStatus = data.article_status || "none";
//             console.log("Updating cab-status:", newAssemblyStatus);
//         } else {
//             console.log("Table is populated, keeping existing cab-status:", currentAssemblyStatus);
//         }
    
//         const startButton = document.getElementById("start-article-button");
//         const stopButton = document.getElementById("stop-article-button");
//         const completeButton = document.getElementById("complete-article-button");
    
//         // We'll use the shared setButtonState helper
//         setButtonState(startButton, false);
//         setButtonState(stopButton, false);
//         setButtonState(completeButton, false);
    
//         // If the article is complete, disable all
//         if (data.article_status === "complete") {
//             console.log("Article is complete. All buttons disabled.");
//             // Now let the table logic run. (It likely will keep the Start button disabled anyway.)
//             updateStartButtonState();
//             updateAssemblyStatus();
//             return;
//         }
  
//       // For "new" or "used", we won't unilaterally enable the Start button here.
//       // Instead, we'll rely on updateStartButtonState to do so if the table logic is okay.
//       // We only set STOP/COMPLETE if needed:
  
//     if (data.part_status === "used") {
//         if (data.assembly_status === "running") {
//           // Part is used and assembly is running => enable STOP
//           setButtonState(stopButton, true, "button-stop-enabled");
//         } else if (data.assembly_status === "stopped") {
//           // Part is used, assembly is stopped => enable COMPLETE
//           setButtonState(completeButton, true);
//         }
//         // If data.assembly_status === "no record" => no special action for stop/complete
//         // The Start logic is still delegated to the local table logic below
//     }
  
//       // Finally, we let our local table logic handle the Start button:
//       updateStartButtonState();
//       updateAssemblyStatus();  
//     } catch (error) {
//       console.error("Error updating button states:", error);
//     }
// }

async function updateButtonStates(barcode, workArea) {
    try {
        if (!barcode || barcode.trim() === "") {
            console.warn("updateButtonStates: No barcode provided.");
            return;
        }
        if (!workArea) {
            console.warn("updateButtonStates: No Work Area selected.");
            return;
        }

        const response = await fetch(`/api/check_part_status_resource/?barcode=${encodeURIComponent(barcode)}&resource=${encodeURIComponent(workArea)}&t=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Part Status Response:", data);

        const table = document.getElementById("table-body");
        const currentAssemblyStatus = table.dataset.assemblyStatus || "no record";
        const currentWorkArea = table.dataset.workArea || null;
        const newAssemblyStatus = data.assembly_status || "no record";
        const newWorkArea = workArea;
        const isSameWorkArea = currentWorkArea === newWorkArea;

        let shouldUpdate = false;

        // ----------------------------------
        // Status transition rules:
        // ----------------------------------

        // Case 1: SAME work area logic
        if (isSameWorkArea) {
            if (currentAssemblyStatus === "no record" && ["running", "stopped"].includes(newAssemblyStatus)) {
                shouldUpdate = true;
            } else if (currentAssemblyStatus === "running" && ["stopped", "complete"].includes(newAssemblyStatus)) {
                shouldUpdate = true;
            } else if (currentAssemblyStatus === "stopped" && ["running", "complete"].includes(newAssemblyStatus)) {
                shouldUpdate = true;
            } else if (currentAssemblyStatus === "complete") {
                // Lock complete in same work area
                shouldUpdate = false;
            }
        }
        // Case 2: SWITCHING to a new work area (e.g., AS1 -> AS5)
        else if (!isSameWorkArea) {
            // Always allow reset when entering a new area
            shouldUpdate = true;
        }

        // ----------------------------------
        // Apply status update
        // ----------------------------------
        if (shouldUpdate) {
            table.dataset.assemblyStatus = newAssemblyStatus;
            table.dataset.articleStatus = data.article_status || "none";
            table.dataset.workArea = newWorkArea;
            console.log(`✅ Updated cab-status to: ${newAssemblyStatus} in work area ${newWorkArea}`);
        } else {
            console.log(`⛔ Keeping existing cab-status: ${currentAssemblyStatus} for ${currentWorkArea}`);
        }

        // ----------------------------------
        // Button state management
        // ----------------------------------
        const startButton = document.getElementById("start-article-button");
        const stopButton = document.getElementById("stop-article-button");
        const completeButton = document.getElementById("complete-article-button");

        // Disable all buttons by default
        setButtonState(startButton, false);
        setButtonState(stopButton, false);
        setButtonState(completeButton, false);

        // Article completed in this work area? Lock everything
        if (table.dataset.assemblyStatus === "complete") {
            console.log("🔒 Assembly marked complete in this work area, buttons locked.");
            updateStartButtonState();
            updateAssemblyStatus();
            return;
        }

        // Button logic based on updated status
        if (data.part_status === "used") {
            if (table.dataset.assemblyStatus === "running") {
                setButtonState(stopButton, true, "button-stop-enabled");
            } else if (table.dataset.assemblyStatus === "stopped") {
                setButtonState(completeButton, true);
            }
        }

        // Start button logic delegated to table conditions
        updateStartButtonState();
        updateAssemblyStatus();

    } catch (error) {
        console.error("Error updating button states:", error);
    }
}

  
  

function resetButtonStates() {
    const startButton = document.getElementById("start-article-button");
    const stopButton = document.getElementById("stop-article-button");
    const completeButton = document.getElementById("complete-article-button");

    setButtonState(startButton, false);
    setButtonState(stopButton, false);
    setButtonState(completeButton, false);
}
  
 


function setButtonState(button, isEnabled, enabledClass = "button-enabled") {
    if (!button) return;
    button.disabled = !isEnabled;
    button.classList.remove("button-disabled", "button-enabled", "button-stop-enabled");

    if (isEnabled) {
        button.classList.add(enabledClass);
    } else {
        button.classList.add("button-disabled");
    }
}




function updateStartButtonState() {
    const startButton = document.getElementById("start-article-button");
    if (!startButton) return;

    const table = document.getElementById("table-body");
    const assemblyStatus = table.dataset.assemblyStatus || "no record";
    const articleStatus = table.dataset.articleStatus || "none";
    const tableWorkArea = table.dataset.workArea || null;

    const workAreaSelect = document.getElementById("work-area");
    const currentWorkArea = workAreaSelect ? workAreaSelect.value : null;

    // Only lock Start if we're still in the same work area where it was marked complete
    const isSameAreaAsComplete = tableWorkArea === currentWorkArea;

    if (articleStatus === "Complete" && isSameAreaAsComplete) {
        setButtonState(startButton, false);
        return;
    }

    if (assemblyStatus === "running" && isSameAreaAsComplete) {
        setButtonState(startButton, false);
        return;
    }

    const isStopped = assemblyStatus === "stopped";
    const isNoRecord = assemblyStatus === "no record";

    const rows = Array.from(document.getElementById("table-body").children);
    if (rows.length === 0) {
        setButtonState(startButton, false);
        return;
    }

    let usedCount = 0;
    let newCount = 0;
    let usedArticles = new Set();
    let allNewChecked = true;

    rows.forEach(row => {
        const isUsed = row.dataset.isUsed === "true";
        if (isUsed) {
            usedCount++;
            const usedArticleId = row.dataset.usedArticleIdentifier || "UNKNOWN";
            usedArticles.add(usedArticleId);
        } else {
            newCount++;
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox || !checkbox.checked) {
                allNewChecked = false;
            }
        }
    });

    // Rule A: Mix of new + used parts
    if (usedCount > 0 && newCount > 0) {
        if ((isStopped || isNoRecord) && allNewChecked) {
            console.log("Allowing Start in mix mode (stopped or no record).");
            setButtonState(startButton, true);
        } else {
            setButtonState(startButton, false);
        }
        return;
    }

    // Rule B: All new parts
    if (usedCount === 0) {
        setButtonState(startButton, allNewChecked);
        return;
    }

    // Rule C: All used parts from same article
    if (usedCount === rows.length) {
        if (usedArticles.size > 1) {
            setButtonState(startButton, false);
        } else {
            const [usedArticleId] = Array.from(usedArticles);
            setButtonState(startButton, (usedArticleId !== "UNKNOWN"));
        }
        return;
    }

    setButtonState(startButton, false);
}
  
  

function updateAssemblyStatus() {
    const tableBody = document.getElementById("table-body");

    // Retrieve the assembly status and article status from the table-body element
    const assemblyStatus = tableBody.dataset.assemblyStatus || "N/A";  // Default to "no record" if not set
    const articleStatus = tableBody.dataset.articleStatus || "none";  // Default to "none" if not set

    console.log("Assembly Status from table-body:", assemblyStatus); // Debugging
    console.log("Article Status from table-body:", articleStatus); // Debugging

    // Update the UI with the assembly and article status
    document.getElementById('cab-status').textContent = assemblyStatus;
    // document.getElementById('article-status').textContent = articleStatus;
}


