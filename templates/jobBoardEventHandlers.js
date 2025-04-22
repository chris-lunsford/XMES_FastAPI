/***** Job Board *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/job-board'].callback = initializeJobBoard;
    scriptMap['/job-board'].cleanup = cleanupJobBoard;
}

function cleanupJobBoard() {
    if (window.jobBoardIntervalId) {
        clearInterval(window.jobBoardIntervalId);
        window.jobBoardIntervalId = null;
        console.log('✅ Cleared job board interval');
    }
    window.jobBoardInitialized = false;
    window.autoSubmitIntervalSet = false; // reset flag if needed
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

    // Set interval if it has not been set before
    if (!window.autoSubmitIntervalSet) {
        window.autoSubmitIntervalSet = true;
        console.log("Setting refresh interval");
        window.jobBoardIntervalId = setInterval(loadJobBoardData, 60000); // every 10s
    }   
    
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
            orderCell.dataset.col = 'orderid';

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
                        <div class="progress-info">
                            <span class="progress-label">${scanned} / ${expected}</span>
                            <span class="progress-percent">${percentage}%</span>
                        </div>
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
    totalHeader.textContent = "Total";
    // totalHeader.classList.add('col-header');
    // totalHeader.dataset.col = "Total";
    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
}



// function setupCellHoverHighlighting() {
//     const table = document.getElementById('order-table');

//     table.addEventListener('mouseover', (e) => {
//         const td = e.target.closest('td');
//         if (!td || !td.dataset.col) return;

//         const col = td.dataset.col;
//         const row = td.parentElement;

//         // Highlight column header
//         const header = document.querySelector(`th[data-col="${col}"]`);
//         header?.classList.add('highlight');

//         // Highlight order ID cell
//         const rowLabel = row.querySelector('td.row-label');
//         rowLabel?.classList.add('highlight');

//         // Highlight all cells in the same column
//         const colCells = table.querySelectorAll(`td[data-col="${col}"]`);
//         colCells.forEach(cell => cell.classList.add('highlight'));

//         // Highlight all cells in the same row
//         row.querySelectorAll('td').forEach(cell => cell.classList.add('highlight'));
//     });

//     table.addEventListener('mouseout', () => {
//         document.querySelectorAll('.highlight').forEach(el => {
//             el.classList.remove('highlight');
//         });
//     });
// }

function setupCellHoverHighlighting() {
    const table = document.getElementById('order-table');
    let lockedTarget = null;

    table.addEventListener('mouseover', (e) => {
        if (lockedTarget) return;
    
        const header = e.target.closest('th[data-col]');
        const rowLabel = e.target.closest('td.row-label[data-col]');
        const cell = e.target.closest('td.data-cell[data-col]');
    
        if (header) {
            highlightColumn(header.dataset.col);
        } else if (rowLabel) {
            highlightRow(rowLabel.parentElement);
        } else if (cell) {
            highlightBoth(cell);
        }
    });

    table.addEventListener('mouseout', () => {
        if (!lockedTarget) clearHighlights();
    });

    table.addEventListener('click', (e) => {
        const header = e.target.closest('th[data-col]');
        const rowLabel = e.target.closest('td.row-label[data-col]');
        const cell = e.target.closest('td.data-cell[data-col]');

        clearHighlights();

        if (header) {
            lockedTarget = header;
            highlightColumn(header.dataset.col);
        } else if (rowLabel) {
            lockedTarget = rowLabel;
            highlightRow(rowLabel.parentElement);
        } else if (cell) {
            lockedTarget = cell;
            highlightBoth(cell);
        } else {
            lockedTarget = null;
        }
    });

    document.addEventListener('click', (e) => {
        const insideTable = e.target.closest('#order-table');
        if (!insideTable) {
            lockedTarget = null;
            document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
        }
    });

    function highlightColumn(col) {
        document.querySelectorAll(`th[data-col="${col}"], td[data-col="${col}"]`)
            .forEach(el => el.classList.add('highlight'));
    }

    function highlightRow(row) {
        row.querySelectorAll('td').forEach(td => td.classList.add('highlight'));
    }

    function highlightBoth(td) {
        const col = td.dataset.col;
        const row = td.parentElement;
        highlightColumn(col);
        highlightRow(row);
    }

    function clearHighlights() {
        document.querySelectorAll('.highlight').forEach(el =>
            el.classList.remove('highlight')
        );
    }
}
