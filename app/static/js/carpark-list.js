(function () {
    function vacancyNumber(row) {
        var cell = row.querySelector('[data-vacancy-value]') || row.cells[3];
        var text = ((cell && cell.textContent) || '').trim();
        var value = parseInt(text, 10);
        return isNaN(value) ? null : value;
    }

    function selectedValue(id, fallback) {
        var el = document.getElementById(id);
        return (el && el.value) ? el.value : fallback;
    }

    window.filterCarParks = function () {
        var vehicleType = selectedValue('vehicle-type', 'privateCar');
        var status = selectedValue('status-filter', 'all');
        var operator = selectedValue('operator-filter', 'all');
        var source = selectedValue('source-filter', 'live');
        var rows = document.querySelectorAll('#carpark-table tr, #favorite-carpark-table tr');
        var visible = false;

        rows.forEach(function (row) {
            var matchVehicle = vehicleType === 'all' || !row.dataset.vehicleType || row.dataset.vehicleType === vehicleType;
            var rowStatus = (row.dataset.status || '').toUpperCase();
            var matchStatus = status === 'all' || rowStatus === status.toUpperCase();
            var matchOperator = operator === 'all' || row.dataset.operator === operator;
            var live = row.dataset.live !== '0';
            var vacancy = vacancyNumber(row);
            var matchSource = true;

            if (source === 'live') {
                matchSource = live && vacancy !== null && vacancy > 0;
            } else if (source === 'map') {
                matchSource = !live;
            } else {
                matchSource = (live && vacancy !== null && vacancy > 0) || !live || row.dataset.liveFallback === '1';
            }

            var show = matchVehicle && matchStatus && matchOperator && matchSource;
            row.style.display = show ? '' : 'none';
            if (show) {
                visible = true;
            }
        });

        var empty = document.getElementById('no-results');
        if (empty) {
            empty.style.display = visible || !rows.length ? 'none' : 'block';
        }
    };

    window.filterCarParksByStatus = window.filterCarParks;

    document.addEventListener('change', function (event) {
        if (!event.target) {
            return;
        }
        if (event.target.id === 'operator-filter' || event.target.id === 'source-filter') {
            window.filterCarParks();
        }
    });
})();
