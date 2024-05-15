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
    // Handle barcode input
    if (event.target.id === 'barcode' && event.target.value.length >= 8) {
        let orderIDField = document.getElementById('order-id');
        orderIDField.value = event.target.value.substring(0, 8);
        fetchJobNotifications(orderIDField.value);
    }

    // Listen for changes in 'employee-id' or 'work-area' elements
    if (event.target.id === 'employee-id' || event.target.id === 'work-area') {
        const employeeID = document.getElementById('employee-id').value;
        const workAreaSelect = document.getElementById('work-area');
        const workArea = workAreaSelect ? workAreaSelect.value : null;
        
        updatePartCountsOnInputs(employeeID, workArea);
    }

    // Handle OrderID input
    if (event.target.id === 'order-id' && event.target.value.length == 8) {
        fetchJobNotifications(event.target.value);
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

