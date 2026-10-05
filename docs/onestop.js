/* One-stop map: car parks, meter locations, and cameras on the same view. */
(function () {
    var root = document.getElementById("onestop-root");
    if (!root || !window.EasePark || !window.L) return;

    var parkApi = window.EasePark;
    var chinese = root.dataset.lang !== "en";
    var districtSelect = document.getElementById("district-filter");
    if (districtSelect && districtSelect.options.length === 1) {
        parkApi.DISTRICTS.forEach(function (district) {
            var option = document.createElement("option");
            option.value = district;
            option.textContent = parkApi.districtLabel(district, chinese);
            districtSelect.appendChild(option);
        });
    }
    var detailBase = root.dataset.detailBase || "";
    var historyUrl = root.dataset.history || "data/history.json";
    var favoriteEndpoint = root.dataset.favoriteEndpoint || "";
    var FAV_KEY = "easepark-favorite-parks";
    var CAM_KEY = "favorites";

    var parks = [];
    var meters = [];
    var cameras = [];
    var history = { hours: {} };
    var metersLoaded = false;
    var camerasLoaded = false;
    var noticeDistrict = "";

    var REGION_DISTRICTS = {
        hk: ["Central & Western", "Wan Chai", "Eastern", "Southern"],
        kln: ["Yau Tsim Mong", "Sham Shui Po", "Kowloon City", "Wong Tai Sin", "Kwun Tong"],
        nt: ["Kwai Tsing", "Tsuen Wan", "Yuen Long", "Tuen Mun", "North", "Tai Po", "Sha Tin", "Sai Kung", "Islands"]
    };
    var params = new URLSearchParams(window.location.search);
    var activeRegion = REGION_DISTRICTS[params.get("region") || ""] || [];
    if (params.get("district") && districtSelect) districtSelect.value = params.get("district");
    if (params.get("vehicle")) document.getElementById("vehicle-filter").value = params.get("vehicle");
    if (params.get("open") === "1") document.getElementById("filter-open").checked = true;
    if (params.get("space") === "1") document.getElementById("filter-space").checked = true;

    var map = L.map(document.getElementById("onestop-map")).setView([22.32, 114.17], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);
    var parkLayer = L.layerGroup().addTo(map);
    var meterLayer = L.markerClusterGroup({ chunkedLoading: true, disableClusteringAtZoom: 17 });
    var cameraLayer = L.layerGroup();

    function text(zh, en) { return chinese ? zh : en; }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
        });
    }

    function readList(key) {
        try { return JSON.parse(localStorage.getItem(key) || "[]"); }
        catch (error) { return []; }
    }

    function writeList(key, values) {
        localStorage.setItem(key, JSON.stringify(values));
    }

    var favorites = readList(FAV_KEY);
    try {
        JSON.parse(root.dataset.favorites || "[]").forEach(function (id) {
            if (favorites.indexOf(String(id)) < 0) favorites.push(String(id));
        });
    } catch (error) {}

    function vehicleKey() {
        return document.getElementById("vehicle-filter").value;
    }

    function markerColor(value) {
        if (value === null) return "#8b95a1";
        if (value >= 50) return "#0b6e4f";
        if (value >= 10) return "#c47b16";
        return "#c0392b";
    }

    function selectedDistrict() {
        return document.getElementById("district-filter").value;
    }

    function inPlace(district) {
        var selected = selectedDistrict();
        if (selected) return district === selected;
        if (activeRegion.length) return activeRegion.indexOf(district) >= 0;
        return true;
    }

    function parkVisible(carpark) {
        if (!inPlace(carpark.district_en)) return false;
        var keys = [vehicleKey()];
        return parkApi.passesListing(
            carpark,
            keys,
            document.getElementById("filter-open").checked,
            document.getElementById("filter-space").checked
        );
    }

    function pointVisible(item) {
        return inPlace(item.district);
    }

    function fitFilteredParks() {
        if (!selectedDistrict() && !activeRegion.length) return;
        var bounds = parkLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }

    function typicalLine(carpark) {
        var typical = parkApi.typicalNow(history, String(carpark.park_id));
        var field = vehicleKey() === "motorCycle" ? "motorCycle" : "privateCar";
        var label = vehicleKey() === "motorCycle" ? text("電單車", "Motorcycles") : text("私家車", "Private cars");
        var value = typical[field];
        if (value === null) {
            return text(
                label + "：未有足夠過往紀錄（" + typical.samples + "/3）",
                label + ": not enough history yet (" + typical.samples + "/3)"
            );
        }
        return text(label + "同時段平均：約 " + value + " 個", label + " typical for this hour: about " + value);
    }

    function drawParks() {
        parkLayer.clearLayers();
        var shown = 0;
        parks.forEach(function (carpark) {
            if (!parkVisible(carpark)) return;
            var lat = parseFloat(carpark.latitude);
            var lng = parseFloat(carpark.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            var spaces = parkApi.vacancyCount(carpark, vehicleKey());
            var color = markerColor(spaces);
            var marker = L.circleMarker([lat, lng], {
                radius: 7, color: color, fillColor: color, fillOpacity: 0.9, weight: 1
            });
            marker.district = carpark.district_en;
            var name = chinese ? (carpark.name_tc || carpark.name_en) : (carpark.name_en || carpark.name_tc);
            var address = chinese ? (carpark.displayAddress_tc || "") : (carpark.displayAddress_en || "");
            var nowText = spaces === null
                ? text("所選車種空位未提供", "Vacancy for this vehicle is not reported")
                : text("而家空位：" + spaces, "Spaces now: " + spaces);
            var fav = favorites.indexOf(String(carpark.park_id)) >= 0;
            var detail = detailBase
                ? "<br><a href=\"" + escapeHtml(detailBase + carpark.park_id) + "\">" + text("詳情", "Details") + "</a>"
                : "";
            marker.bindPopup(
                "<strong>" + escapeHtml(name) + "</strong><br>" +
                escapeHtml(address) + "<br>" +
                escapeHtml(nowText) + "<br>" +
                escapeHtml(typicalLine(carpark)) +
                detail +
                "<br><button type=\"button\" data-fav-park=\"" + escapeHtml(carpark.park_id) + "\">" +
                (fav ? text("取消收藏", "Remove") : text("收藏", "Save")) + "</button>"
            );
            marker.addTo(parkLayer);
            shown += 1;
        });
        var empty = document.getElementById("filter-empty");
        empty.hidden = shown !== 0;
    }

    function meterKind(code) {
        var labels = {
            A: text("一般車輛", "Any vehicle"),
            G: text("貨車", "Goods vehicle"),
            C: text("旅遊巴", "Coach")
        };
        return labels[code] || code;
    }

    function drawMeters() {
        meterLayer.clearLayers();
        meters.forEach(function (meter) {
            if (!pointVisible(meter)) return;
            var marker = L.circleMarker([meter.lat, meter.lng], {
                radius: 5, color: "#1686a8", fillColor: "#1686a8", fillOpacity: 0.85, weight: 1
            });
            marker.district = meter.district;
            var kinds = meter.vehicles.map(meterKind).join(text("、", ", "));
            marker.bindPopup(
                "<strong>" + escapeHtml(meter.street) + "</strong><br>" +
                escapeHtml(meter.section) + "<br>" +
                escapeHtml(parkApi.districtLabel(meter.district, chinese)) + "<br>" +
                escapeHtml(text("咪錶車種：", "Meter type: ") + kinds) + "<br>" +
                escapeHtml(text("咪錶沒有即時空位數，只顯示位置。", "Meters have no live vacancy. This is the location only."))
            );
            marker.addTo(meterLayer);
        });
    }

    function drawCameras() {
        cameraLayer.clearLayers();
        var saved = readList(CAM_KEY);
        cameras.forEach(function (camera) {
            if (!pointVisible(camera)) return;
            var marker = L.circleMarker([camera.lat, camera.lng], {
                radius: 6, color: "#6b4c9a", fillColor: "#6b4c9a", fillOpacity: 0.9, weight: 1
            });
            marker.district = camera.district;
            var fav = saved.indexOf(camera.key) >= 0;
            marker.bindPopup(
                "<strong>" + escapeHtml(camera.description) + "</strong><br>" +
                "<img src=\"" + escapeHtml(camera.url) + "\" alt=\"\" width=\"220\"><br>" +
                "<button type=\"button\" data-fav-cam=\"" + escapeHtml(camera.key) + "\">" +
                (fav ? text("取消收藏", "Remove") : text("收藏", "Save")) + "</button>"
            );
            marker.addTo(cameraLayer);
        });
    }

    function showNotices(district) {
        noticeDistrict = district || "";
        var title = document.getElementById("notice-title");
        var list = document.getElementById("notice-list");
        list.innerHTML = "";
        if (!noticeDistrict) {
            title.textContent = text("地區通告", "District notices");
            list.textContent = text("點一個停車場，或先選地區。這裡只顯示該區通告。", "Click a car park or choose a district. Only that district's notices are shown.");
            return;
        }
        title.textContent = parkApi.districtLabel(noticeDistrict, chinese) + text("通告", " notices");
        list.textContent = text("載入通告…", "Loading notices...");
        parkApi.noticesFor([noticeDistrict], chinese, 8).then(function (notices) {
            if (noticeDistrict !== district) return;
            list.innerHTML = "";
            if (!notices.length) {
                list.textContent = text("這個地區暫時沒有對到的通告。", "No matching notice for this district.");
                return;
            }
            notices.forEach(function (notice) {
                var article = document.createElement("article");
                var heading = document.createElement("strong");
                heading.textContent = notice.title;
                var body = document.createElement("p");
                body.textContent = notice.body.length > 180 ? notice.body.slice(0, 180) + "…" : notice.body;
                article.appendChild(heading);
                article.appendChild(body);
                list.appendChild(article);
            });
        }).catch(function () {
            list.textContent = text("通告暫時讀不到。", "Notices could not be loaded.");
        });
    }

    function parseCsv(text) {
        var rows = [];
        var row = [];
        var cell = "";
        var quoted = false;
        var source = text.replace(/^\uFEFF/, "");
        for (var i = 0; i < source.length; i++) {
            var char = source.charAt(i);
            if (quoted) {
                if (char === "\"") {
                    if (source.charAt(i + 1) === "\"") { cell += "\""; i += 1; }
                    else quoted = false;
                } else cell += char;
            } else if (char === "\"") quoted = true;
            else if (char === ",") { row.push(cell); cell = ""; }
            else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
            else if (char !== "\r") cell += char;
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    function loadMeters() {
        if (metersLoaded) return Promise.resolve();
        return fetch("https://resource.data.one.gov.hk/td/psiparkingspaces/spaceinfo/parkingspaces.csv")
            .then(function (response) { return response.text(); })
            .then(function (csv) {
                var rows = parseCsv(csv);
                var header = null;
                var headerIndex = -1;
                rows.forEach(function (row, index) {
                    if (headerIndex < 0 && row[0] === "PoleId") {
                        header = row;
                        headerIndex = index;
                    }
                });
                var indexOf = function (name) { return header.indexOf(name); };
                var poles = {};
                rows.slice(headerIndex + 1).forEach(function (row) {
                    if (row[indexOf("District")] === "INTERNAL TEST") return;
                    var lat = parseFloat(row[indexOf("Latitude")]);
                    var lng = parseFloat(row[indexOf("Longitude")]);
                    if (isNaN(lat) || isNaN(lng)) return;
                    var pole = row[indexOf("PoleId")];
                    if (!poles[pole]) {
                        poles[pole] = {
                            lat: lat,
                            lng: lng,
                            district: parkApi.canonDistrict(row[indexOf("District")]),
                            street: chinese ? row[indexOf("Street_tc")] : row[indexOf("Street")],
                            section: chinese ? row[indexOf("SectionOfStreet_tc")] : row[indexOf("SectionOfStreet")],
                            vehicles: []
                        };
                    }
                    var kind = row[indexOf("VehicleType")];
                    if (poles[pole].vehicles.indexOf(kind) < 0) poles[pole].vehicles.push(kind);
                });
                meters = Object.keys(poles).map(function (key) { return poles[key]; });
                metersLoaded = true;
                drawMeters();
            });
    }

    function loadCameras() {
        if (camerasLoaded) return Promise.resolve();
        var url = chinese
            ? "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_Tc.xml"
            : "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml";
        return fetch(url).then(function (response) { return response.text(); }).then(function (xml) {
            var doc = new DOMParser().parseFromString(xml, "text/xml");
            cameras = Array.prototype.map.call(doc.getElementsByTagName("image"), function (node) {
                function value(tag) {
                    var el = node.getElementsByTagName(tag)[0];
                    return el && el.textContent ? el.textContent : "";
                }
                return {
                    key: value("key"),
                    district: parkApi.canonDistrict(value("district")),
                    description: value("description"),
                    lat: parseFloat(value("latitude")),
                    lng: parseFloat(value("longitude")),
                    url: value("url")
                };
            }).filter(function (camera) { return !isNaN(camera.lat) && !isNaN(camera.lng); });
            camerasLoaded = true;
            drawCameras();
        });
    }

    map.on("popupopen", function (event) {
        var marker = event.popup._source;
        if (marker && marker.district) showNotices(marker.district);
        var element = event.popup.getElement();
        if (!element) return;
        var parkButton = element.querySelector("[data-fav-park]");
        if (parkButton) {
            parkButton.addEventListener("click", function () {
                var id = parkButton.getAttribute("data-fav-park");
                var index = favorites.indexOf(id);
                if (index >= 0) favorites.splice(index, 1);
                else favorites.push(id);
                writeList(FAV_KEY, favorites);
                if (favoriteEndpoint) {
                    fetch(favoriteEndpoint + encodeURIComponent(id), { method: "POST" });
                }
                parkButton.textContent = index >= 0 ? text("收藏", "Save") : text("取消收藏", "Remove");
            });
        }
        var cameraButton = element.querySelector("[data-fav-cam]");
        if (cameraButton) {
            cameraButton.addEventListener("click", function () {
                var id = cameraButton.getAttribute("data-fav-cam");
                var saved = readList(CAM_KEY);
                var index = saved.indexOf(id);
                if (index >= 0) saved.splice(index, 1);
                else saved.push(id);
                writeList(CAM_KEY, saved);
                cameraButton.textContent = index >= 0 ? text("收藏", "Save") : text("取消收藏", "Remove");
            });
        }
    });

    document.getElementById("district-filter").addEventListener("change", function () {
        activeRegion = [];
        drawParks();
        fitFilteredParks();
        if (metersLoaded) drawMeters();
        if (camerasLoaded) drawCameras();
        showNotices(selectedDistrict());
    });
    ["vehicle-filter", "filter-open", "filter-space"].forEach(function (id) {
        document.getElementById(id).addEventListener("change", drawParks);
    });
    document.getElementById("layer-meters").addEventListener("change", function (event) {
        if (!event.target.checked) {
            map.removeLayer(meterLayer);
            return;
        }
        map.addLayer(meterLayer);
        loadMeters().catch(function () {
            event.target.checked = false;
        });
    });
    document.getElementById("layer-cameras").addEventListener("change", function (event) {
        if (!event.target.checked) {
            map.removeLayer(cameraLayer);
            return;
        }
        map.addLayer(cameraLayer);
        loadCameras().catch(function () {
            event.target.checked = false;
        });
    });

    var askButton = document.getElementById("onestop-ask");
    if (askButton) {
        askButton.addEventListener("click", function () {
            var input = document.getElementById("onestop-question");
            var output = document.getElementById("onestop-answer");
            var message = input.value.trim();
            if (!message) return;
            output.textContent = text("搜尋中…", "Searching...");
            window.EASEPARK_DETAIL_BASE = detailBase;
            parkApi.answer(message).then(function (reply) {
                output.textContent = reply;
            }).catch(function () {
                output.textContent = text("暫時讀不到政府空位。", "Live vacancy could not be loaded.");
            });
        });
    }

    showNotices(selectedDistrict());
    if (params.get("meters") === "1") {
        document.getElementById("layer-meters").checked = true;
        map.addLayer(meterLayer);
        loadMeters().catch(function () {
            document.getElementById("layer-meters").checked = false;
        });
    }
    if (params.get("cameras") === "1") {
        document.getElementById("layer-cameras").checked = true;
        map.addLayer(cameraLayer);
        loadCameras().catch(function () {
            document.getElementById("layer-cameras").checked = false;
        });
    }

    parkApi.loadCarparks().then(function (records) {
        parks = records;
        return fetch(historyUrl).then(function (response) {
            return response.ok ? response.json() : { hours: {} };
        }).catch(function () { return { hours: {} }; });
    }).then(function (payload) {
        history = payload || { hours: {} };
        drawParks();
        fitFilteredParks();
    }).catch(function () {
        document.getElementById("filter-empty").hidden = false;
        document.getElementById("filter-empty").textContent = text("停車場資料暫時讀不到。", "Car park data could not be loaded.");
    });
})();
