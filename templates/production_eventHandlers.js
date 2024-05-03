/***** Production Dashboard *****/

document.getElementById('barcode').addEventListener('keypress', function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent the default action to stop submitting the form
        handleBarcodeScan_to_DB(); // Call the function that handles data submission
    }
});






