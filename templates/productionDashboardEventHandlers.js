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
    }
}

function initializeProductionDashboard() {
    // Initialize dashboard functionalities
    populateCustomerIDs(); // Populate customer IDs
    populateWorkAreas(); // Populate work areas

    // Only initialize once
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    // Add event listener for barcode scanning
    // Remove the listener first to ensure it's not added multiple times
    document.body.removeEventListener('keypress', handleBarcodeKeyPress);
    document.body.addEventListener('keypress', handleBarcodeKeyPress);
}



document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('input', function(event) {
        if (event.target.id === 'barcode') {
            let orderIDField = document.getElementById('order-id');
            if (event.target.value.length >= 8) {
                orderIDField.value = event.target.value.substring(0, 8);
            }
        }
    });
});