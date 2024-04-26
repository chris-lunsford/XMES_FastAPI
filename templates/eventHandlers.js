/***** Production Dashboard *****/

// document.addEventListener("DOMContentLoaded", function() {
//     // Fetch work stations and populate the dropdown
//     console.log("DOM fully loaded and parsed");
//     console.log(document.getElementById('work_area'));  // Should output the element or null if not found
//     fetch('/api/work-stations')
//     .then(response => response.json())
//     .then(data => {
//         const select = document.getElementById('work_area');
//         if (select) {  // Check if the select element exists
//             data.forEach(station => {
//                 let option = new Option(station, station);
//                 select.add(option);
//             });
//         } else {
//             console.log('Work area select element not found');
//         }
//     });

// fetch('/api/customer-ids')
//     .then(response => response.json())
//     .then(data => {
//         const select = document.getElementById('customer_id');
//         if (select) {  // Check if the select element exists
//             data.forEach(customerId => {
//                 let option = new Option(customerId, customerId);
//                 select.add(option);
//             });
//         } else {
//             console.log('Customer ID select element not found');
//         }
//     });
// });



/***** Machine Dashboard *****/


document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to the body which will handle events from dynamically loaded content
    document.body.addEventListener('change', function(event) {
        if (event.target.matches('input[name="date-range"]')) {
            updateDateInputs(event.target.value);
            if (event.target.value !== 'custom') {
                event.preventDefault();  // Prevent the default form submission
                handleFormSubmit(document.getElementById('dateForm'));
            }
        } else if (event.target.matches('#start-date, #end-date')) {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            if (startDate && endDate) {
                event.preventDefault();  // Prevent the default form submission
                handleFormSubmit(document.getElementById('dateForm'));
            }
        }
    });

    document.body.addEventListener('submit', function(event) {
        if (event.target.id === 'dateForm') {
            event.preventDefault();
            handleFormSubmit(event.target);
        }
    });
});


document.addEventListener('DOMContentLoaded', function() {
    // Run updateMachineBorders initially when the page loads
    updateMachineBorders();

    // Set up the function to run every 5 minutes
    // setInterval(updateMachineBorders, 60000); // 60000 milliseconds = 1 minute
    
    setInterval(autoSubmitForm, 60000);
});

