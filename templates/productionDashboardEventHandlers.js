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
        updateEEJobListDay()
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
        // Handle barcode input
        if (event.target.id === 'barcode') {
            let orderIDField = document.getElementById('order-id');
            if (event.target.value.length >= 8) {
                orderIDField.value = event.target.value.substring(0, 8);
            }
        }

        // Listen for changes in either the 'employee-id' or 'work-area' elements
        if (event.target.id === 'employee-id' || event.target.id === 'work-area') {
            const employeeID = document.getElementById('employee-id').value;
            const workAreaSelect = document.getElementById('work-area');
            if (workAreaSelect) {
                const workArea = workAreaSelect.value;

                // Update part count for area and total for day
                if (employeeID.length === 4 && workArea) {
                    fetchAreaPartsCount(employeeID, workArea);
                    fetchEETotalPartsCount(employeeID);
                    fetchEEJobListDay(employeeID)
                }
                // Update only total for day
                if (employeeID.length === 4 && !workArea) {
                    fetchEETotalPartsCount(employeeID);
                    fetchEEJobListDay(employeeID)
                }
                // Reset area part count if no work area selected
                if (!workArea) {
                    document.getElementById('partcount-area').textContent = 0;
                }
            }
        }
    });
});


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