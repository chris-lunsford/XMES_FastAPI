/***** Assembly Order Dashboard *****/

// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/assembly-order-dashboard'].callback = initializeAssemblyOrderDashboard;
}

function initializeAssemblyOrderDashboard() {
    console.log("Initializing Assembly Order Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    loadWorkStations();
    // Setup event handlers at initialization
    setupEventHandlers();

    
    // Prevent multiple initializations
    if (window.assemblyOrderDashboardInitialized) return;
    window.assemblyOrderDashboardInitialized = true;   
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
            updateAssemblyTimes(orderID)
        } else if (orderID.length === 0) {
            resetArticleCounts();
        }
        // if (orderID.length !== 8) {
        //     clearPartsTable();
        // }
    }

}


var workStations = window.workStations || [];

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
    window.debugArticles = articles;
    console.log("INFO2 values:", articles.map(a => a.INFO2));
    console.log("workStations:", workStations);
    console.log("Expected matches:", articles.map(a => {
        return {
            INFO2: a.INFO2,
            matches: workStations.filter(ws => a.INFO2.includes(ws))
        };
    }));
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
    document.getElementById("article-count-Total").textContent = totalParts;
    // document.getElementById("up-time-TotalTime").textContent = totalCompleted;

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
            // timeEl.textContent = `${current} hrs`;
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




async function resetArticleCounts() {
    console.log("Resetting part counts, border styles, progress bars, and missing parts table");

    try {
        // Ensure areas are loaded
        await loadWorkStations();  // this populates window.workAreaGroups

        const uniqueGroups = new Set(Object.values(window.workStations || {}));

        uniqueGroups.forEach(code => {
            // Reset progress bars
            const progressBar = document.getElementById(`progress-bar-${code}`);
            const progressText = document.getElementById(`progress-text-${code}`);

            if (progressBar && progressText) {
                progressBar.value = 0;
                progressBar.classList.remove('complete');
                progressText.textContent = '0%';
            }

            // Reset counts and container styles
            const totalCountElement = document.getElementById(`article-count-Total`);
            const currentCountElement = document.getElementById(`current-count-${code}`);
            const partCountElement = document.getElementById(`article-count-${code}`);
            const workareaContainer = currentCountElement ? currentCountElement.closest('.workarea-container') : null;

            if (currentCountElement && partCountElement && workareaContainer) {
                totalCountElement.textContent = '0';
                currentCountElement.textContent = '0';
                partCountElement.textContent = '0';
                workareaContainer.classList.remove('has-parts');
                workareaContainer.classList.remove('hidden');
            }
        });

        // Clear missing parts table
        const tableBody = document.getElementById('table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
        }

        // Clear notification list
        const notificationListElement = document.getElementById('notification-list');
        console.log("Clearing notifications");
        if (notificationListElement) {
            notificationListElement.innerHTML = '';
        }

    } catch (error) {
        console.error("Failed to load work area groups:", error);
    }
}



async function updateAssemblyTimes(orderID) {
    try {
      const response = await fetch('/api/fetch-assembly-order-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ORDERID: orderID })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
  
      data.result.forEach(entry => {
        const resource = entry.RESOURCE;
        const seconds = entry.TOTAL_ASSEMBLY_TIME_SECONDS;

        const hours = (seconds / 3600).toFixed(2); // Keep 2 decimal places

        const timeElement = document.getElementById(`assembly-time-${resource}`);
        if (timeElement) {
            timeElement.textContent = `${hours} hrs`;
        }
        });
    } catch (error) {
      console.error('Failed to fetch assembly times:', error);
    }
  }





