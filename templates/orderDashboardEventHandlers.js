/***** Order Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/order-dashboard'].callback = initializeOrderDashboard;
}



function initializeOrderDashboard() {
    console.log("Initializing Order Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
}


// Handles dynamic inputs and changes specific to the production dashboard
function handleDynamicInputs(event) {
    // This ensures the correct handling of the orderID value
    const orderIDField = document.getElementById('order-id');
    const orderID = orderIDField ? orderIDField.value.trim() : null;

    
    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id') {
        if (orderID.length === 8) {
            fetchOrderPartCounts(orderID);
        } else if (orderID.length ===0) {
            resetPartCounts();
        }
    }
}


// Function to reset all part counts to zero and remove 'has-parts' class
function resetPartCounts() {
    console.log("Resetting part counts and border styles");
    const partCountElements = document.querySelectorAll('[id^="part-count-"]');
    partCountElements.forEach(element => {
        element.textContent = '0';
        const machineContainer = element.closest('.machine-container');
        if (machineContainer) {
            machineContainer.classList.remove('has-parts');
            machineContainer.classList.remove('hidden');
        }
    });
}


