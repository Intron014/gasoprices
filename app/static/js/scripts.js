const columns = [
    { key: "C.P.", display: "C.P.", default: true },
    { key: "Dirección", display: "Dirección", default: true },
    { key: "Distancia", display: "Distancia", default: true },
    { key: "Horario", display: "Horario", default: true },
    { key: "Latitud", display: "Latitude", default: false },
    { key: "Longitud (WGS84)", display: "Longitud", default: false },
    { key: "Localidad", display: "Localidad", default: true },
    { key: "Margen", display: "Margen", default: false },
    { key: "Municipio", display: "Municipio", default: false },
    { key: "Precio Gasoleo A", display: "Gasoleo A", default: true },
    { key: "Precio Gasoleo Premium", display: "Gasoleo A +", default: true },
    { key: "Precio Gasolina 95 E5", display: "Sin Plomo 95", default: true },
    { key: "Precio Gasolina 98 E5", display: "Sin Plomo 98", default: true },
    { key: "Provincia", display: "Provincia", default: false },
    { key: "Remisión", display: "Remission", default: false },
    { key: "Rótulo", display: "Marca", default: true },
    { key: "Tipo Venta", display: "TV", default: false }
];

let visibleColumns = columns.filter(col => col.default).map(col => col.key);
let currentStations = [];
let sortOrder = {};
let currentSortColumn = null;

function toggleColumnMenu() {
    const menu = document.getElementById('column-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function initializeColumnMenu() {
    const menu = document.getElementById('column-menu');
    columns.forEach(column => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = column.key;
        checkbox.checked = column.default;
        checkbox.addEventListener('change', updateVisibleColumns);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(column.display));
        menu.appendChild(label);
    });
}

function updateVisibleColumns() {
    const checkboxes = document.querySelectorAll('#column-menu input[type="checkbox"]');
    visibleColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    displayStations(currentStations);
}

function showSpinner() {
    document.getElementById('loading-spinner').style.display = 'flex';
}

function hideSpinner() {
    document.getElementById('loading-spinner').style.display = 'none';
}

async function fetchStations() {
    showSpinner();
    try {
        const response = await fetch('/fuel_stations');
        const data = await response.json();
        update_date(data.Fecha);
        hideSpinner();
        displayStations(data.ListaEESSPrecio);
    } catch (error) {
        console.error('Error fetching stations:', error);
        hideSpinner();
        alert('Error loading gas stations. Please try again later.');
    }
}

function displayStations(stations) {
    currentStations = stations; // Update current stations
    console.log('Displaying stations:', stations);
    const tableHead = document.getElementById('stations-table-head');
    const tableBody = document.getElementById('stations-table-body');
    if (!tableHead || !tableBody) {
        console.error('Table head or body not found');
        return;
    }
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // Create table header
    const headerRow = document.createElement('tr');
    visibleColumns.forEach(columnKey => {
        const th = document.createElement('th');
        th.textContent = columns.find(col => col.key === columnKey).display;
        if (columnKey.startsWith('Precio')) {
            th.classList.add('sortable');
            if(columnKey === 'Precio Gasoleo A'){
                th.classList.add('fuel-diesel');
            } else if(columnKey === 'Precio Gasoleo Premium'){
                th.classList.add('fuel-diesel-plus');
            } else if(columnKey === 'Precio Gasolina 95 E5'){
                th.classList.add('fuel-sp-95');
            } else if(columnKey === 'Precio Gasolina 98 E5'){
                th.classList.add('fuel-sp-98');
            }
            th.addEventListener('click', () => {
                const isAscending = currentSortColumn === columnKey ? !sortOrder[columnKey] : true;
                sortOrder = {};
                sortOrder[columnKey] = isAscending;
                sortStationsByPrice(currentStations, columnKey, isAscending);
            });
        }
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Create table body
    stations.forEach((station, index) => {
        const row = document.createElement('tr');
        visibleColumns.forEach(columnKey => {
            const cell = document.createElement('td');
            if (columnKey.startsWith('Precio')) {
                cell.classList.add('seven-segment');
                if(station[columnKey]===""){
                    cell.textContent = "-";
                } else {
                    cell.textContent = station[columnKey];
                }
            } else if (columnKey === 'Horario') {
                const { status, formattedTimetable } = getStatusAndTimetable(station[columnKey]);
                console.log(`Station ${index} status:`, status, 'Timetable:', formattedTimetable);
                const statusSpan = document.createElement('span');
                if(status === '24/7'){
                    statusSpan.className = `status status-247`;
                } else {
                    statusSpan.className = `status status-${status.toLowerCase()}`;
                }
                statusSpan.textContent = status;
                cell.appendChild(statusSpan);
                statusSpan.addEventListener('click', (event) => {
                    console.log('Status clicked:', status);
                    event.stopPropagation();
                    showTimetable(cell, formattedTimetable);
                });
            } else if (columnKey === 'Distancia') {
                cell.textContent = station.distance ? `${station.distance.toFixed(2)} km` : 'N/A';
            } else {
                cell.textContent = station[columnKey] || '';
            }
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
    updateSortIndicators();
}

function getStatusAndTimetable(horario) {
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours() * 100 + now.getMinutes();

    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const currentDay = days[day];

    let status = 'CLOSED';
    let formattedTimetable = horario;

    if (horario.includes('24H')) {
        status = 'OPEN';
        formattedTimetable = '24 hours / 7 days';
    } else {
        const schedules = horario.split(';').map(s => s.trim());
        schedules.forEach(schedule => {
            // Nightmare fuel (haha)
            const [daysRange, startHour, thingToSplit, endMinute] = schedule.split(':').map(s => s.trim());
            const [startMin, endHour] = thingToSplit.split('-').map(t => parseInt(t));
            const [startDay, endDay] = daysRange.split('-');
            const openTime = parseInt(startHour) * 100 + parseInt(startMin);
            const closeTime = parseInt(endHour) * 100 + parseInt(endMinute);
            console.log('Checking schedule:', startDay, endDay, openTime, closeTime, currentDay, time)

            const isDayInRange = (startDay === 'L' && endDay === 'D') ||
                (days.indexOf(currentDay) >= days.indexOf(startDay) &&
                    days.indexOf(currentDay) <= days.indexOf(endDay));

            if (isDayInRange) {
                if (time >= openTime && time < closeTime) {
                    status = 'OPEN';
                }
            }
        });
    }

    return { status, formattedTimetable };
}

function showTimetable(cell, timetable) {
    console.log('Showing timetable:', timetable);
    const existingTimetable = document.querySelector('.timetable');
    if (existingTimetable) {
        existingTimetable.remove();
    }

    const timetableElement = document.createElement('div');
    timetableElement.className = 'timetable';
    timetableElement.textContent = timetable;

    const rect = cell.getBoundingClientRect();
    console.log('Cell position:', rect);

    timetableElement.style.position = 'fixed';
    timetableElement.style.top = `${rect.bottom}px`;
    timetableElement.style.left = `${rect.left}px`;
    timetableElement.style.zIndex = '9999';
    timetableElement.style.background = 'white';
    timetableElement.style.border = '1px solid black';
    timetableElement.style.padding = '10px';
    timetableElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    timetableElement.style.maxWidth = '300px';
    timetableElement.style.wordWrap = 'break-word';
    timetableElement.style.display = 'block';

    document.body.appendChild(timetableElement);
    console.log('Timetable element added to body');

    // Adjust position if it goes off-screen
    const timetableRect = timetableElement.getBoundingClientRect();
    if (timetableRect.right > window.innerWidth) {
        timetableElement.style.left = `${window.innerWidth - timetableRect.width - 10}px`;
    }

    document.addEventListener('click', (event) => {
        console.log('Document clicked:', event.target);
        if (!timetableElement.contains(event.target) && event.target !== cell) {
            timetableElement.remove();
            console.log('Timetable element removed');
        }
    }, { once: true });
}

function updateSortIndicators() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc', 'sorted');
    });

    if (currentSortColumn) {
        const header = Array.from(headers).find(header =>
            header.textContent === columns.find(col => col.key === currentSortColumn).display
        );
        if (header) {
            header.classList.add(sortOrder[currentSortColumn] ? 'sorted-asc' : 'sorted-desc');
            header.classList.add('sorted');
        }
    }
}

function toggleSearchMenu() {
    const menu = document.getElementById('search-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function searchStations(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const params = new URLSearchParams(formData).toString();
    const response = await fetch(`/fuel_stations/filter?${params}`);
    const data = await response.json();
    displayStations(data);
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function sortStationsByPrice(stations, priceType, asc) {
    currentSortColumn = priceType;
    stations.sort((a, b) => {
        const priceA = parseFloat(a[priceType].replace(',', '.')) || 0;
        const priceB = parseFloat(b[priceType].replace(',', '.')) || 0;
        return asc ? priceA - priceB : priceB - priceA;
    });
    displayStations(stations);
    updateSortIndicators();
}

async function filterStationsByDistance(maxDistance) {
    showSpinner();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const response = await fetch('/fuel_stations');
            const data = await response.json();
            update_date(data.Fecha);
            const stations = data.ListaEESSPrecio.map(station => {
                const stationLat = parseFloat(station.Latitud.replace(',', '.'));
                const stationLon = parseFloat(station["Longitud (WGS84)"].replace(',', '.'));
                const distance = getDistance(latitude, longitude, stationLat, stationLon);
                return { ...station, distance };
            }).filter(station => station.distance <= maxDistance);
            hideSpinner();
            displayStations(stations.sort((a, b) => a.distance - b.distance));
        }, (error) => {
            console.error("Error getting location:", error);
            hideSpinner();
            alert("Unable to get your location. Please check your browser settings.");
            fetchStations();
        });
    } else {
        hideSpinner();
        alert('Geolocation is not supported by this browser.');
        fetchStations();
    }
}

function handleFilterByDistance() {
    const distanceInput = document.getElementById('distance-input');
    const maxDistance = parseFloat(distanceInput.value);
    if (isNaN(maxDistance) || maxDistance <= 0) {
        alert("Please enter a valid distance in kilometers.");
        return;
    }
    filterStationsByDistance(maxDistance);
}

function initializeDistanceFilter() {
    const distanceInput = document.getElementById('distance-input');
    const filterButton = document.getElementById('filter-by-distance');

    if (distanceInput && filterButton) {
        distanceInput.value = '4';

        filterButton.addEventListener('click', handleFilterByDistance);

        filterStationsByDistance(4);
    } else {
        console.error('Distance filter elements not found');
        fetchStations();
    }
}

function update_date(date) {
    document.getElementById('update-date').textContent = "Latest update:\n" + date;
}

window.onload = function() {
    initializeDistanceFilter();
    initializeColumnMenu();
};
