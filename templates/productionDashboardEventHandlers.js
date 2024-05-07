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

    // Add event listener for barcode scanning
    // Remove the listener first to ensure it's not added multiple times
    document.body.removeEventListener('keypress', handleBarcodeKeyPress);
    document.body.addEventListener('keypress', handleBarcodeKeyPress);
}


