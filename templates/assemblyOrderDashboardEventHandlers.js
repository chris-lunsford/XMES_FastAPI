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
        const response = await fetch("/api/fetch-assembly-routing-counts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ORDERID: orderId })
        });

        const data = await response.json();

        if (data && data.result) {
            updateRoutingUI(data.result);  // ✅ Make sure this is what you're passing
        } else {
            console.warn("No result in response:", data);
        }
    } catch (error) {
        console.error("Error fetching routing counts:", error);
    }
}


function updateRoutingUI(counts) {
    if (!counts || typeof counts !== 'object') {
        console.warn("Invalid or missing routing count data", counts);
        return;
    }

    let totalExpected = 0;
    let totalCompleted = 0;

    Object.entries(counts).forEach(([area, { expected, completed }]) => {
        if (area === "TOTAL") {
            totalExpected = expected;
            totalCompleted = completed;
            return;
        }

        const countEl = document.getElementById(`current-count-${area}`);
        const totalEl = document.getElementById(`article-count-${area}`);
        const barEl = document.getElementById(`progress-bar-${area}`);
        const textEl = document.getElementById(`progress-text-${area}`);

        const percentage = expected ? Math.round((completed / expected) * 100) : 0;

        if (countEl && totalEl && barEl && textEl) {
            countEl.textContent = completed;
            totalEl.textContent = expected;
            barEl.value = percentage;
            textEl.textContent = `${percentage}%`;

            // Reset all classes first
            barEl.classList.remove('complete', 'over-complete');

            // Apply class based on % complete
            if (percentage === 100) {
                barEl.classList.add('complete');
            } else if (percentage > 100) {
                barEl.classList.add('over-complete');
            }
        }
    });

    const totalEl = document.getElementById("article-count-Total");
    if (totalEl) totalEl.textContent = totalExpected;
}



function handleWorkAreaContainerClick(event) {
    // Check if the clicked element or its parent is a workarea container
    const machineContainer = event.target.closest('.workarea-container');
    if (!machineContainer) return;

    const orderID = document.getElementById('order-id').value.trim();
    if (!orderID) {
        alert('Please enter an Order ID.');
        return;
    }

    // Extract work area code from ID like "workarea-AS6"
    const id = machineContainer.id;
    const match = id.match(/workarea-([A-Z0-9]+)/i);
    if (!match) {
        console.warn("Could not extract work area code from:", id);
        return;
    }

    const workAreaCode = match[1].toUpperCase();
    console.log(`Clicked on work area: ${workAreaCode}`);

    // Remove .active from all other containers
    document.querySelectorAll('.workarea-container.active').forEach(el => {
        el.classList.remove('active');
    });

    // Add .active to the clicked one
    machineContainer.classList.add('active');

    // Fetch and display missing articles
    fetchMissingArticles(orderID, workAreaCode);
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



  function displayMissingArticles(workAreaCode, missingList) {
    const tableBody = document.getElementById("table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (missingList.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="4">✅ All articles for ${workAreaCode} have been scanned.</td>`;
        tableBody.appendChild(row);
        return;
    }

    missingList.forEach(article => {
        const lastScan = article.LAST_SCAN_RESOURCE || "—";
        const scanTime = article.LAST_SCAN_TIME
            ? new Date(article.LAST_SCAN_TIME).toLocaleString()
            : "—";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="article-info3">${article.INFO3 || "No description"}</td>
            <td>${article.INFO2 || "—"}</td>
            <td>${lastScan}</td>
            <td>${scanTime}</td>
        `;
        tableBody.appendChild(row);
    });
}



async function fetchMissingArticles(orderID, workAreaCode) {
    try {
        const response = await fetch("/api/fetch-missing-articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ORDERID: orderID, work_area: workAreaCode })
        });

        const data = await response.json();
        if (data && data.missing_articles) {
            displayMissingArticles(workAreaCode, data.missing_articles);
        }
    } catch (error) {
        console.error("Error fetching missing articles:", error);
    }
}
