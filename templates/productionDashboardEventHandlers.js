/***** Production Dashboard *****/

// Ensure that this script is only executed when the relevant content is present in the DOM
document.addEventListener("DOMContentLoaded", function() {
    // Check if production-specific elements exist
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        barcodeInput.addEventListener('keypress', function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent the default action to stop submitting the form
                handleBarcodeScan_to_DB(); // Call the function that handles data submission
            }
        });
    }

    populateCustomerIDs(); // Call the function to populate customer IDs
    populateWorkAreas(); // Call the function to populate work areas
});
