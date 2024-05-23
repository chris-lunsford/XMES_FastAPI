/***** Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/production'].callback = initializeProductionDashboard;
}


// Define the barcode scanning function outside to keep its reference
function handleBarcodeKeyPress(event) {
    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();
        handleBarcodeScan_to_DB();
        updatePartCountsOnScan();
        updateEEJobListDay();
    }
}


function initializeProductionDashboard() {
    console.log("Initializing Production Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    // Initialize dashboard functionalities
    populateCustomerIDs(); // Populate customer IDs
    populateWorkAreas(); // Populate work areas

    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    listenerManager.addListener(document.body, 'keypress', handleBarcodeKeyPress);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
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
    if (event.target.id === 'barcode' && event.target.value.length >= 8) {
        orderIDField.value = event.target.value.substring(0, 8);
        fetchJobNotifications(orderIDField.value);
    }

    // Listen for changes in 'employee-id' or 'work-area' elements
    if (event.target.id === 'employee-id' || event.target.id === 'work-area') {
        updatePartCountsOnInputs(employeeID, workArea);

        // Additionally, check if the orderID is valid and run fetchOrderTotalAreaCount if both are valid
        if (orderID && orderID.length === 8 && workArea && workArea !== "") {
            fetchOrderTotalAreaCount(orderID, workArea);
        }
    }

    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id' && orderID.length === 8) {
        fetchJobNotifications(orderID);
        fetchOrderTotalCount(orderID);

        // Verify that the work area has a valid selection
        if (workArea && workArea !== "") {
            fetchOrderTotalAreaCount(orderID, workArea);
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
    fetchAreaPartsCount(employeeID, workArea);
    fetchEETotalPartsCount(employeeID);

}

function updateEEJobListDay() {
    const employeeID = document.getElementById('employee-id').value;
    fetchEEJobListDay(employeeID)
}

