/***** Job Board *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/job-board'].callback = initializeJobBoard;
}


function initializeJobBoard() {
    console.log("Initializing Job Board");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    loadJobBoardData();
    
    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.jobBboardInitialized) return;
    window.jobBoardInitialized = true;

    
    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");   
    // listenerManager.addListener(document.getElementById('fetch-defects'), 'click', handleFetchDefectList);    
}


var stationOrder = ['PSZ', 'TRZ', 'EBZ', 'PRZ', 'HRZ', 'HDZ', 'GMZ', 'PBZ', 'SCZ'];

async function loadJobBoardData() {
    showLoadingSpinner()
    try {
        // Fetch station groups and job board data
        const [groupRes, jobRes] = await Promise.all([
            fetch('/api/work-station-groups'),
            fetch('/api/fetch-job-board-data')
        ]);

        const groupData = await groupRes.json();
        const data = await jobRes.json();

        const uniqueGroups = [...new Set(Object.values(groupData.groups))];
        const stations = stationOrder.filter(group => uniqueGroups.includes(group));

        if (data.detail) {
            console.warn("No job data found:", data.detail);
            return;
        }

        updateTableHeaders(stations);

        const tableBody = document.getElementById("table-body");
        tableBody.innerHTML = '';

        for (const [orderId, orderData] of Object.entries(data)) {
            const row = document.createElement('tr');

            const orderCell = document.createElement('td');
            orderCell.textContent = orderId;
            orderCell.classList.add('row-label');

            const shipDate = orderData.ship_date || '';
            const storeType = orderData.store_type || '';

            orderCell.innerHTML = `
            <div class="order-id">${orderId}</div>
            <div class="store-type">${storeType}</div>
            <div class="ship-date">${shipDate}</div>
            `;


            row.appendChild(orderCell);

            let scannedTotal = 0;
            let expectedTotal = stations.reduce((sum, station) => {
                return sum + (orderData.expected?.[station] || 0);
            }, 0);

            stations.forEach(station => {
                const expected = orderData.expected?.[station] || 0;
                const scanned = orderData.scanned?.[station] || 0;

                scannedTotal += scanned;

                const cell = document.createElement('td');
                cell.classList.add('data-cell');
                cell.dataset.col = station;
                
                const percentage = expected > 0 ? Math.round((scanned / expected) * 100) : 0;

                let barColor = '#4caf50'; // green

                if (percentage < 100) barColor = '#0063cc'; // blue
                else if (percentage > 100) barColor = '#f44336'; // red

                cell.innerHTML = `
                    <div class="progress-wrapper">
                        <div class="progress-bar" style="width: ${percentage}%; background-color: ${barColor};"></div>
                        <span class="progress-label">${scanned} / ${expected}</span>
                        <span class="progress-percent">${percentage}%</span>
                    </div>
                `;

                row.appendChild(cell);
            });

            const totalCell = document.createElement('td');

            const totalPercent = expectedTotal > 0 ? Math.round((scannedTotal / expectedTotal) * 100) : 0;

            let totalBarColor = '#4caf50';
            if (totalPercent < 50) totalBarColor = '#f44336';
            else if (totalPercent < 100) totalBarColor = '#ff9800';

            totalCell.innerHTML = `
                <div class="progress-wrapper">
                    <div class="progress-bar" style="width: ${totalPercent}%; background-color: ${totalBarColor};"></div>
                    <div class="progress-info">
                        <span class="progress-label">${scannedTotal} / ${expectedTotal}</span>
                        <span class="progress-percent">${totalPercent}%</span>
                    </div>
                </div>
            `;

            row.appendChild(totalCell);

            tableBody.appendChild(row);

            setupCellHoverHighlighting();
        }
        hideLoadingSpinner()

    } catch (error) {
        console.error("Error loading job board data:", error);
    }
}

function updateTableHeaders(stations) {
    const thead = document.getElementById("table-head");
    thead.innerHTML = ''; // Clear existing header

    const headerRow = document.createElement('tr');

    const orderIdHeader = document.createElement('th');
    orderIdHeader.textContent = "OrderID";
    headerRow.appendChild(orderIdHeader);

    stations.forEach(station => {
        const th = document.createElement('th');
        th.textContent = station;
        th.classList.add('col-header');
        th.dataset.col = station; // use the station name as an identifier

        headerRow.appendChild(th);
    });

    const totalHeader = document.createElement('th');
    totalHeader.textContent = "Routing Steps";
    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
}



function setupCellHoverHighlighting() {
    const table = document.getElementById('order-table');

    table.addEventListener('mouseover', (e) => {
        const td = e.target.closest('td');
        if (!td || !td.dataset.col) return;

        const col = td.dataset.col;
        const row = td.parentElement;

        // Highlight column header
        const header = document.querySelector(`th[data-col="${col}"]`);
        header?.classList.add('highlight');

        // Highlight order ID cell
        const rowLabel = row.querySelector('td.row-label');
        rowLabel?.classList.add('highlight');

        // Highlight all cells in the same column
        const colCells = table.querySelectorAll(`td[data-col="${col}"]`);
        colCells.forEach(cell => cell.classList.add('highlight'));

        // Highlight all cells in the same row
        row.querySelectorAll('td').forEach(cell => cell.classList.add('highlight'));
    });

    table.addEventListener('mouseout', () => {
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
    });
}

