/***** Assembly Order Dashboard *****/


function initializeAssemblyOrderDashboard() {
    if (window.assemblyOrderDashboardInitialized) return;
    window.assemblyOrderDashboardInitialized = true;

    console.log("Initializing Assembly Order Dashboard");
    setupEventHandlers();
}

function teardownAssemblyOrderDashboard() {
    console.log("Tearing down Assembly Order Dashboard");
    listenerManager.removeListeners();
    window.assemblyOrderDashboardInitialized = false;
}

if (typeof scriptMap !== 'undefined') {
    scriptMap['/assembly-order-dashboard'].callback = initializeAssemblyOrderDashboard;
    scriptMap['/assembly-order-dashboard'].teardown = teardownAssemblyOrderDashboard;
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    // listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
    
    // Adding a listener to handle clicks on any machine container
    const workareaRow = document.querySelector('.workarea-row'); // Assuming all containers are within this element
    if (workareaRow) {
        listenerManager.addListener(workareaRow, 'click', handleWorkAreaContainerClick);
    }
}


// Handles dynamic inputs and changes specific to the production dashboard
function handleDynamicInputs(event) {
    // This ensures the correct handling of the orderID value
    const orderIDField = document.getElementById('order-id');
    const orderID = orderIDField ? orderIDField.value.trim() : null;

    
    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id') {
        if (orderID.length === 8) {
            fetchJobNotifications(orderID);
            fetchOrderStatus(orderID);
        } else if (orderID.length === 0) {
            resetPartCounts();
        }
        if (orderID.length !== 8) {
            clearPartsTable();
        }
    }

}


let workStations = [];

async function loadWorkStations() {
    try {
        const response = await fetch("/api/assembly-work-stations");
        workStations = (await response.json()).filter(ws => ws); // remove blank entries
    } catch (error) {
        console.error("Failed to load work stations", error);
    }
}

async function fetchOrderStatus(orderId) {
    try {
        const response = await fetch("/api/fetch-assembly-order-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ORDERID: orderId })
        });

        const data = await response.json();

        if (data.result) {
            updateUI(data.result);
        }
    } catch (error) {
        console.error("Error fetching order status:", error);
    }
}

function updateUI(articles) {
    const areaStatus = {};

    // Initialize counters
    workStations.forEach(area => {
        areaStatus[area] = { total: 0, complete: 0 };
    });

    let totalParts = 0;
    let totalCompleted = 0;

    for (const article of articles) {
        const { INFO2, Completed_Steps, Total_Operations } = article;
        totalParts += Total_Operations;
        totalCompleted += Completed_Steps;

        for (const area of workStations) {
            if (INFO2.includes(area)) {
                areaStatus[area].total += 1;
                if (Completed_Steps === Total_Operations) {
                    areaStatus[area].complete += 1;
                }
            }
        }
    }

    // Update total summary section
    document.getElementById("part-count-Total").textContent = totalParts;
    document.getElementById("up-time-TotalTime").textContent = totalCompleted;

    // Update each work area block
    workStations.forEach(area => {
        const current = areaStatus[area].complete;
        const total = areaStatus[area].total;
        const percentage = total ? Math.round((current / total) * 100) : 0;

        const countEl = document.getElementById(`current-count-${area}`);
        const totalEl = document.getElementById(`article-count-${area}`);
        const barEl = document.getElementById(`progress-bar-${area}`);
        const textEl = document.getElementById(`progress-text-${area}`);
        const timeEl = document.getElementById(`assembly-time-${area}`);

        // Only update if elements exist in DOM
        if (countEl && totalEl && barEl && textEl && timeEl) {
            countEl.textContent = current;
            totalEl.textContent = total;
            barEl.value = percentage;
            textEl.textContent = `${percentage}%`;
            timeEl.textContent = `${current} hrs`;
        }
    });
}







// Function to handle clicks on machine containers
function handleWorkAreaContainerClick(event) {
    // Check if the clicked element or its parent is a machine container
    const machineContainer = event.target.closest('.machine-container');
    if (!machineContainer) return;

    const orderID = document.getElementById('order-id').value.trim();
    if (!orderID) {
        alert('Please enter an Order ID.');
        return;
    }

    // Extract the work area from the container's ID attribute
    const workAreaCode = machineContainer.id.replace('machine-', '').toUpperCase(); // Adjust according to your actual IDs
    console.log(`Machine container clicked for: ${workAreaCode}`);

    // Optionally fetch workstation groups to use for further logic
    fetchWorkAreas().then(groups => {
        if (groups[workAreaCode]) {
            console.log(`Fetching parts not scanned for group: ${groups[workAreaCode]}`);
            // Assuming groups[workAreaCode] gives you the group and you have different behavior/logic based on the group
            fetchPartsNotScanned(orderID, groups[workAreaCode]);
        } else {
            console.log(`No group found for ${workAreaCode}, using default work area code.`);
            fetchPartsNotScanned(orderID, workAreaCode);
        }
    }).catch(error => {
        console.error('Failed to fetch workstation groups:', error);
        // Proceed with default action if fetching groups fails
        fetchPartsNotScanned(orderID, workAreaCode);
    });
}


// Function to reset all part counts to zero, remove 'has-parts' class, and clear missing parts table
function resetPartCounts() {
    console.log("Resetting part counts, border styles, progress bars, and missing parts table");

    // Fetch work station groups dynamically
    fetchWorkAreas().then(groups => {
        const uniqueGroups = new Set(Object.values(groups));

        uniqueGroups.forEach(code => {
            // Resetting progress bars specifically
            let progressBar = document.getElementById(`progress-bar-${code}`);
            let progressText = document.getElementById(`progress-text-${code}`);

            if (progressBar && progressText) {
                progressBar.value = 0;
                progressBar.classList.remove('complete');
                progressText.textContent = '0%';
            }

            // Resetting count texts and classes on containers
            const totalCountElement = document.getElementById(`part-count-Total`);
            let currentCountElement = document.getElementById(`current-count-${code}`);
            let partCountElement = document.getElementById(`part-count-${code}`);
            let machineContainer = currentCountElement ? currentCountElement.closest('.machine-container') : null;

            if (currentCountElement && partCountElement && machineContainer) {
                totalCountElement.textContent = '0';
                currentCountElement.textContent = '0';
                partCountElement.textContent = '0';
                machineContainer.classList.remove('has-parts');
                machineContainer.classList.remove('hidden');  // Assuming you want to hide the container when parts count is reset
            }
        });

        // Clear the missing parts table
        const tableBody = document.getElementById('table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
        }

        // Clear Notifications
        const notificationListElement = document.getElementById('notification-list');
        console.log("Clearing notifications");
        if (notificationListElement) {
            notificationListElement.innerHTML = ''; // Clear existing notifications
    }

    }).catch(error => {
        console.error("Failed to fetch work station groups:", error);
    });
}




// Function to update progress bar
function updateProgressBar(machineGroupCode) {
    console.log("Updating progress bar");
    var currentCountElement = document.getElementById(`current-count-${machineGroupCode}`);
    var partCountElement = document.getElementById(`part-count-${machineGroupCode}`);
    var progressBar = document.getElementById(`progress-bar-${machineGroupCode}`);
    var progressText = document.getElementById(`progress-text-${machineGroupCode}`);

    // Check if elements exist and are visible in the document flow
    if (!currentCountElement || !partCountElement || !progressBar || !progressText) {
        console.error(`Elements not found for ${machineGroupCode}, or are currently hidden.`);
        return; // Skip this group as it is not visible
    }

    var currentCount = parseInt(currentCountElement.textContent, 10);
    var partCount = parseInt(partCountElement.textContent, 10);

    // Handle case where part count is zero or current count is not a valid number
    if (isNaN(currentCount) || currentCount < 0) {
        currentCount = 0;
    }
    if (isNaN(partCount) || partCount <= 0) {
        partCount = 0;
    }

    if (partCount > 0) {
        var percentComplete = (currentCount / partCount) * 100;
        progressBar.value = percentComplete;
        progressText.textContent = `${Math.round(percentComplete)}%`;

        if (Math.round(percentComplete) === 100) {
            progressBar.classList.add('complete');
        } else {
            progressBar.classList.remove('complete');
        }
    } else {
        progressBar.value = 0;
        progressText.textContent = "0%";
        progressBar.classList.remove('complete');
    }
}



function fetchAssemblyDataAndUpdateUI(orderID) {
    fetchWorkAreas().then(groups => {
        const uniqueGroups = new Set(Object.values(groups));

        // Clear previous data
        uniqueGroups.forEach(code => {
            const currentCountElement = document.getElementById(`current-count-${code}`);
            if (currentCountElement) {
                currentCountElement.textContent = "0";
            }
            const progressBar = document.getElementById(`progress-bar-${code}`);
            if (progressBar) {
                progressBar.value = 0;
            }
            const progressText = document.getElementById(`progress-text-${code}`);
            if (progressText) {
                progressText.textContent = "0%";
            }
        });

        fetchOrderPartCounts(orderID, () => {
            uniqueGroups.forEach(code => {
                updateProgressBar(code);
            });
        });
        fetchScannedOrderPartCounts(orderID, () => {
            uniqueGroups.forEach(code => {
                updateProgressBar(code);
            });
        });

        // Fetch machine runtimes and update the UI
        fetchMachineRuntimes(orderID);
    });
}


// Event handler for fetching parts not scanned by shipping
function handleFetchPartsNotScanned() {
    const orderID = document.getElementById('order-id').value.trim();
    const workAreaField = document.getElementById('work-area').value; 
    if (orderID) {
        fetchPartsNotScanned(orderID, workAreaField);  // This function will be defined in global.js
    }
}


function generatePackList() {
    var OrderID = document.getElementById('order-id').value;
    if (OrderID) {
        fetch(`/api/generate-packlist?OrderID=${OrderID}`)
            .then(response => response.text())  // Assuming the server sends back HTML
            .then(html => {
                var newWindow = window.open();
                newWindow.document.open();
                newWindow.document.write(html);
                newWindow.document.close();
            })
            .catch(error => console.error('Error fetching the packlist:', error));
    } else {
        alert('Please enter a valid Order ID.');
    }
}


function generatePackList2() {
    var OrderID = document.getElementById('order-id').value;
    if (OrderID) {
        fetch(`/api/generate-packlist2?OrderID=${OrderID}`)
            .then(response => response.text())  // Assuming the server sends back HTML
            .then(html => {
                var newWindow = window.open();
                newWindow.document.open();
                newWindow.document.write(html);
                newWindow.document.close();
            })
            .catch(error => console.error('Error fetching the packlist:', error));
    } else {
        alert('Please enter a valid Order ID.');
    }
}


function fetchMachineRuntimes(orderID) {
    fetch(`/api/fetch-runtime-machines?orderid=${orderID}`)
        .then(response => response.json())
        .then(data => {
            // Update total runtime
            const totalRuntimeElement = document.getElementById('up-time-TotalTime');
            if (totalRuntimeElement && data['Total']) {
                const totalTime = Number(data['Total'] || 0);
                totalRuntimeElement.textContent = (totalTime / 60).toFixed(2) + ' hrs';
            }

            // Update work group runtimes
            for (const [workGroupCode, runtime] of Object.entries(data)) {
                if (workGroupCode !== 'Total') {
                    const runtimeElement = document.getElementById(`up-time-${workGroupCode}`);
                    if (runtimeElement) {
                        const workGroupTime = Number(runtime || 0);
                        runtimeElement.textContent = (workGroupTime / 60).toFixed(2) + ' hrs';
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error fetching machine runtimes:', error);
        });
}