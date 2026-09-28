/* Shared parking answers and filters for the map and the assistant. */
(function (root) {
    var AREA_ALIASES = [
        ["中環", "central"], ["金鐘", "admiralty"], ["上環", "sheung wan"], ["西營盤", "sai ying pun"],
        ["西環", "sai ying pun"], ["灣仔", "wan chai"], ["銅鑼灣", "causeway bay"], ["天后", "tin hau"],
        ["北角", "north point"], ["鰂魚涌", "quarry bay"], ["太古", "taikoo"], ["筲箕灣", "shau kei wan"],
        ["柴灣", "chai wan"], ["香港仔", "aberdeen"], ["鴨脷洲", "ap lei chau"], ["赤柱", "stanley"],
        ["尖沙咀", "tsim sha tsui"], ["尖沙嘴", "tsim sha tsui"], ["佐敦", "jordan"], ["油麻地", "yau ma tei"],
        ["旺角", "mong kok"], ["太子", "prince edward"], ["深水埗", "sham shui po"], ["長沙灣", "cheung sha wan"],
        ["荔枝角", "lai chi kok"], ["九龍塘", "kowloon tong"], ["何文田", "ho man tin"], ["紅磡", "hung hom"],
        ["土瓜灣", "to kwa wan"], ["九龍城", "kowloon city"], ["黃大仙", "wong tai sin"], ["鑽石山", "diamond hill"],
        ["觀塘", "kwun tong"], ["藍田", "lam tin"], ["油塘", "yau tong"], ["荃灣", "tsuen wan"],
        ["葵涌", "kwai chung"], ["葵芳", "kwai fong"], ["青衣", "tsing yi"], ["沙田", "sha tin"],
        ["大圍", "tai wai"], ["馬鞍山", "ma on shan"], ["大埔", "tai po"], ["粉嶺", "fanling"],
        ["上水", "sheung shui"], ["元朗", "yuen long"], ["天水圍", "tin shui wai"], ["屯門", "tuen mun"],
        ["將軍澳", "tseung kwan o"], ["西貢", "sai kung"], ["東涌", "tung chung"], ["機場", "airport"],
        ["中西區", "central & western"], ["灣仔區", "wan chai"], ["東區", "eastern"], ["南區", "southern"],
        ["油尖旺", "yau tsim mong"]
    ];

    var REGIONS = [
        [["港島區", "香港島", "港島", "hong kong island"], ["Central & Western", "Wan Chai", "Eastern", "Southern"]],
        [["九龍區", "九龍", "kowloon"], ["Yau Tsim Mong", "Sham Shui Po", "Kowloon City", "Wong Tai Sin", "Kwun Tong"]],
        [["新界區", "新界", "new territories"], ["Kwai Tsing", "Tsuen Wan", "Yuen Long", "Tuen Mun", "North", "Tai Po", "Sha Tin", "Sai Kung", "Islands"]]
    ];

    var DISTRICT_TERMS = {
        "Central & Western": ["中西區", "中環", "上環", "西營盤", "西環", "金鐘", "半山", "堅尼地城", "central & western", "central and western", "sheung wan", "sai ying pun", "admiralty", "kennedy town", "central"],
        "Wan Chai": ["灣仔區", "灣仔", "銅鑼灣", "跑馬地", "天后", "wan chai", "causeway bay", "happy valley", "tin hau"],
        "Eastern": ["東區", "北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣", "north point", "quarry bay", "taikoo", "tai koo", "shau kei wan", "chai wan"],
        "Southern": ["南區", "香港仔", "鴨脷洲", "黃竹坑", "赤柱", "淺水灣", "aberdeen", "ap lei chau", "wong chuk hang", "stanley", "repulse bay"],
        "Yau Tsim Mong": ["油尖旺", "尖沙咀", "尖沙嘴", "佐敦", "油麻地", "旺角", "太子", "大角咀", "tsim sha tsui", "jordan", "yau ma tei", "mong kok", "prince edward", "tai kok tsui", "yau tsim mong"],
        "Sham Shui Po": ["深水埗", "長沙灣", "荔枝角", "美孚", "石硤尾", "sham shui po", "cheung sha wan", "lai chi kok", "mei foo"],
        "Kowloon City": ["九龍城", "紅磡", "土瓜灣", "何文田", "九龍塘", "啟德", "hung hom", "to kwa wan", "ho man tin", "kowloon tong", "kowloon city", "kai tak"],
        "Wong Tai Sin": ["黃大仙", "鑽石山", "樂富", "慈雲山", "新蒲崗", "wong tai sin", "diamond hill", "lok fu", "san po kong"],
        "Kwun Tong": ["觀塘", "藍田", "油塘", "九龍灣", "牛頭角", "kwun tong", "lam tin", "yau tong", "kowloon bay", "ngau tau kok"],
        "Kwai Tsing": ["葵青", "葵涌", "葵芳", "青衣", "kwai tsing", "kwai chung", "kwai fong", "tsing yi"],
        "Tsuen Wan": ["荃灣", "tsuen wan"],
        "Yuen Long": ["元朗", "天水圍", "yuen long", "tin shui wai"],
        "Tuen Mun": ["屯門", "tuen mun"],
        "North": ["北區", "粉嶺", "上水", "fanling", "sheung shui", "north district"],
        "Tai Po": ["大埔", "tai po"],
        "Sha Tin": ["沙田", "大圍", "馬鞍山", "sha tin", "shatin", "tai wai", "ma on shan"],
        "Sai Kung": ["西貢", "將軍澳", "坑口", "sai kung", "tseung kwan o", "hang hau"],
        "Islands": ["離島", "東涌", "機場", "大嶼山", "長洲", "islands", "tung chung", "airport", "lantau", "cheung chau"]
    };

    var DISTRICT_LABELS = {
        "Central & Western": ["中西區", "Central and Western"],
        "Wan Chai": ["灣仔", "Wan Chai"],
        "Eastern": ["東區", "Eastern"],
        "Southern": ["南區", "Southern"],
        "Yau Tsim Mong": ["油尖旺", "Yau Tsim Mong"],
        "Sham Shui Po": ["深水埗", "Sham Shui Po"],
        "Kowloon City": ["九龍城", "Kowloon City"],
        "Wong Tai Sin": ["黃大仙", "Wong Tai Sin"],
        "Kwun Tong": ["觀塘", "Kwun Tong"],
        "Kwai Tsing": ["葵青", "Kwai Tsing"],
        "Tsuen Wan": ["荃灣", "Tsuen Wan"],
        "Yuen Long": ["元朗", "Yuen Long"],
        "Tuen Mun": ["屯門", "Tuen Mun"],
        "North": ["北區", "North"],
        "Tai Po": ["大埔", "Tai Po"],
        "Sha Tin": ["沙田", "Sha Tin"],
        "Sai Kung": ["西貢", "Sai Kung"],
        "Islands": ["離島", "Islands"]
    };

    var CANON = {};
    Object.keys(DISTRICT_TERMS).forEach(function (district) {
        CANON[district.toLowerCase()] = district;
        DISTRICT_TERMS[district].forEach(function (term) {
            if (term.charAt(term.length - 1) === "區" || term.indexOf("&") >= 0 || term.indexOf(" and ") >= 0) {
                CANON[term.toLowerCase()] = district;
            }
        });
        ["油尖旺", "深水埗", "九龍城", "黃大仙", "觀塘", "葵青", "荃灣", "元朗", "屯門", "大埔", "沙田", "西貢", "離島"].forEach(function (name) {
            if (DISTRICT_TERMS[district].indexOf(name) >= 0) {
                CANON[name.toLowerCase()] = district;
            }
        });
    });

    var MOTOR_WORDS = ["電單車", "摩托車", "電單", "motorcycle", "motorbike"];
    var CAR_WORDS = ["私家車", "私家", "private car"];
    var SKIP_TOKENS = {
        "今日": 1, "聽日": 1, "明天": 1, "而家": 1, "現在": 1, "應該": 1, "點樣": 1, "怎樣": 1, "如何": 1,
        "一架": 1, "一個": 1, "一格": 1, "泊車": 1, "停車": 1, "停車場": 1, "空位": 1, "附近": 1, "地方": 1,
        "today": 1, "tomorrow": 1, "park": 1, "parking": 1, "where": 1
    };
    var NOTICE_URLS = [
        "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml",
        "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml",
        "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Other_Notices.xml"
    ];
    var INFO_URL = "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json";
    var VACANCY_URL = "https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar,motorCycle,LGV,HGV,coach&lang=en_US";

    var carparkCache = null;
    var noticeCache = null;

    function isChinese(text) {
        return /[\u4e00-\u9fff]/.test(text || "");
    }

    function canonDistrict(label) {
        if (!label) return "";
        return CANON[String(label).trim().toLowerCase()] || "";
    }

    function districtLabel(district, chinese) {
        var pair = DISTRICT_LABELS[district];
        if (!pair) return district || "";
        return chinese ? pair[0] : pair[1];
    }

    function vacancyCount(carpark, vehicleKey) {
        var number = parseInt(carpark[vehicleKey + "_vacancy"], 10);
        if (isNaN(number) || number < 0) return null;
        return number;
    }

    function isOpen(carpark) {
        return String(carpark.opening_status || carpark.status || "").toUpperCase() === "OPEN";
    }

    /* Same rules as the map checkboxes: vehicle type, open now, and a reported space above zero. */
    function passesListing(carpark, vehicleKeys, openOnly, withSpace) {
        if (openOnly && !isOpen(carpark)) return false;
        if (withSpace) {
            for (var i = 0; i < vehicleKeys.length; i++) {
                var count = vacancyCount(carpark, vehicleKeys[i]);
                if (count === null || count <= 0) return false;
            }
        }
        return true;
    }

    function termHits(text, term) {
        if (!term) return false;
        if (/[\u4e00-\u9fff]/.test(term)) return text.indexOf(term) >= 0;
        return new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text);
    }

    function plainText(value) {
        return String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    }

    function noticeMatches(notice, district) {
        var terms = DISTRICT_TERMS[district] || [];
        var title = notice.title || "";
        var lowered = title.toLowerCase();
        for (var i = 0; i < terms.length; i++) {
            var term = terms[i];
            if (termHits(/[\u4e00-\u9fff]/.test(term) ? title : lowered, term)) return true;
        }
        return false;
    }

    function loadCarparks() {
        if (carparkCache) return Promise.resolve(carparkCache);
        return Promise.all([fetch(INFO_URL), fetch(VACANCY_URL)]).then(function (responses) {
            return Promise.all(responses.map(function (response) {
                if (!response.ok) throw new Error("carpark fetch failed");
                return response.text();
            }));
        }).then(function (payloads) {
            var info = JSON.parse(payloads[0].replace(/^\uFEFF/, ""));
            var vacancy = JSON.parse(payloads[1]);
            var byId = {};
            (vacancy.results || []).forEach(function (item) {
                byId[String(item.park_Id)] = item;
            });
            carparkCache = (info.car_park || []).map(function (carpark) {
                var vac = byId[String(carpark.park_id)] || {};
                ["privateCar", "motorCycle", "LGV", "HGV", "coach"].forEach(function (kind) {
                    var slot = (vac[kind] || [{}])[0] || {};
                    carpark[kind + "_vacancy"] = slot.vacancy;
                });
                return carpark;
            });
            return carparkCache;
        });
    }

    function loadNotices() {
        if (noticeCache) return Promise.resolve(noticeCache);
        return Promise.all(NOTICE_URLS.map(function (url) {
            return fetch(url).then(function (response) {
                return response.ok ? response.text() : "";
            }).catch(function () { return ""; });
        })).then(function (bodies) {
            var notices = [];
            bodies.forEach(function (xml) {
                if (!xml) return;
                var doc = new DOMParser().parseFromString(xml, "text/xml");
                Array.prototype.forEach.call(doc.getElementsByTagName("Notice"), function (node) {
                    function text(tag) {
                        var el = node.getElementsByTagName(tag)[0];
                        return el && el.textContent ? el.textContent.trim() : "";
                    }
                    var titleTc = text("Title_TC");
                    var bodyTc = text("Content_TC");
                    var titleEn = text("Title_EN");
                    var bodyEn = text("Content_EN");
                    if (bodyTc && bodyTc.indexOf(".pdf") < 0 && titleTc) {
                        notices.push({ title: plainText(titleTc), body: plainText(bodyTc), lang: "zh" });
                    }
                    if (bodyEn && bodyEn.indexOf(".pdf") < 0 && titleEn) {
                        notices.push({ title: plainText(titleEn), body: plainText(bodyEn), lang: "en" });
                    }
                });
            });
            noticeCache = notices;
            return notices;
        });
    }

    function noticesFor(districts, chinese, limit) {
        return loadNotices().then(function (notices) {
            var wanted = {};
            (districts || []).forEach(function (district) { if (district) wanted[district] = 1; });
            var hits = [];
            notices.forEach(function (notice) {
                if (chinese && notice.lang !== "zh") return;
                if (!chinese && notice.lang !== "en") return;
                var matched = Object.keys(wanted).some(function (district) {
                    return noticeMatches(notice, district);
                });
                if (matched) hits.push(notice);
            });
            return hits.slice(0, limit || 8);
        });
    }

    function requestedVehicles(message) {
        var lowered = message.toLowerCase();
        var vehicles = [];
        var hasMotor = MOTOR_WORDS.some(function (word) { return lowered.indexOf(word) >= 0; });
        if (hasMotor) vehicles.push(["motorCycle", "電單車", "Motorcycles"]);
        var remainder = lowered;
        MOTOR_WORDS.forEach(function (word) { remainder = remainder.split(word).join(""); });
        var hasCar = CAR_WORDS.some(function (word) { return lowered.indexOf(word) >= 0; }) || remainder.indexOf("車") >= 0 || /\bcar\b/.test(remainder);
        if (hasCar) vehicles.unshift(["privateCar", "私家車", "Private cars"]);
        if (!vehicles.length) {
            vehicles = [["privateCar", "私家車", "Private cars"], ["motorCycle", "電單車", "Motorcycles"]];
        }
        return vehicles;
    }

    function namedArea(message) {
        var lowered = message.toLowerCase();
        return AREA_ALIASES.some(function (pair) {
            return message.indexOf(pair[0]) >= 0 || lowered.indexOf(pair[1]) >= 0;
        });
    }

    function regionDistricts(message) {
        if (namedArea(message)) return [];
        var lowered = message.toLowerCase();
        for (var i = 0; i < REGIONS.length; i++) {
            var phrases = REGIONS[i][0];
            for (var j = 0; j < phrases.length; j++) {
                if (lowered.indexOf(phrases[j].toLowerCase()) >= 0) return REGIONS[i][1].slice();
            }
        }
        return [];
    }

    function haystack(carpark) {
        return [carpark.name_tc, carpark.name_en, carpark.displayAddress_tc, carpark.displayAddress_en, carpark.district_tc, carpark.district_en]
            .filter(Boolean).join(" ").toLowerCase();
    }

    function score(carpark, message, regions) {
        var district = carpark.district_en || "";
        if (regions.length) return regions.indexOf(district) >= 0 ? 8 : 0;
        var text = haystack(carpark);
        var lowered = message.toLowerCase();
        var total = 0;
        AREA_ALIASES.forEach(function (pair) {
            var mentioned = message.indexOf(pair[0]) >= 0 || lowered.indexOf(pair[1]) >= 0;
            var present = text.indexOf(pair[0].toLowerCase()) >= 0 || text.indexOf(pair[1]) >= 0;
            if (mentioned && present) total += 8;
        });
        var tokens = message.match(/[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}/g) || [];
        tokens.forEach(function (token) {
            if (SKIP_TOKENS[token.toLowerCase()]) return;
            if (text.indexOf(token.toLowerCase()) >= 0) total += 6;
        });
        return total;
    }

    function formatVacancy(value, chinese) {
        var text = value === undefined || value === null ? "" : String(value).trim();
        if (!text || /^(n\/a|none|null|-1)$/i.test(text)) return chinese ? "未提供" : "not reported";
        return text;
    }

    function statusText(carpark, chinese) {
        var raw = String(carpark.opening_status || "").toUpperCase();
        if (raw === "OPEN") return chinese ? "營業中" : "Open";
        if (raw === "CLOSED") return chinese ? "暫停開放" : "Closed";
        return chinese ? "狀態未提供" : "Status not reported";
    }

    function usableSpaces(carpark, vehicles) {
        var total = 0;
        vehicles.forEach(function (item) {
            var count = vacancyCount(carpark, item[0]);
            if (count !== null) total += count;
        });
        return total;
    }

    function answer(message) {
        var chinese = isChinese(message);
        var vehicles = requestedVehicles(message);
        var vehicleKeys = vehicles.map(function (item) { return item[0]; });
        var tomorrow = /聽日|明天|tomorrow/i.test(message);
        var regions = regionDistricts(message);
        var wantsSpaces = /有位|空位|邊度有|where|vacancy|available/i.test(message);
        return loadCarparks().then(function (carparks) {
            var ranked = carparks.map(function (carpark) {
                return [score(carpark, message, regions), usableSpaces(carpark, vehicles), carpark];
            }).sort(function (a, b) {
                return b[0] - a[0] || b[1] - a[1];
            });
            var placeHits = ranked.filter(function (item) { return item[0] > 0; });
            if (!placeHits.length) {
                return chinese
                    ? "我未對到這個地方。請講地區或停車場名，例如「中環」、「尖沙咀」或「環球大廈」。"
                    : "I could not match that place. Name a district or car park, for example Central or Tsim Sha Tsui.";
            }
            var matches = [];
            placeHits.forEach(function (item) {
                if (matches.length >= 5) return;
                if (!passesListing(item[2], vehicleKeys, wantsSpaces, wantsSpaces)) return;
                matches.push(item[2]);
            });
            if (!matches.length) {
                return chinese
                    ? "這個範圍沒有營業中、而且所選車種有位的停車場。"
                    : "Nothing in that area is open with a space for the vehicle you asked about.";
            }
            var lines = [chinese ? "以下是而家的即時空位（只列營業中而且有位的場）" : "Live vacancies. Only open sites with a space are listed."];
            var detailBase = root.EASEPARK_DETAIL_BASE || "";
            matches.forEach(function (carpark, index) {
                var name = chinese ? (carpark.name_tc || carpark.name_en) : (carpark.name_en || carpark.name_tc);
                var address = chinese ? (carpark.displayAddress_tc || carpark.displayAddress_en) : (carpark.displayAddress_en || carpark.displayAddress_tc);
                lines.push("");
                lines.push((index + 1) + ". " + name + "（" + statusText(carpark, chinese) + "）");
                if (address) lines.push(address);
                vehicles.forEach(function (item) {
                    var vacancy = formatVacancy(carpark[item[0] + "_vacancy"], chinese);
                    var label = chinese ? item[1] : item[2];
                    if (vacancy === "未提供" || vacancy === "not reported") lines.push("- " + label + "：" + vacancy);
                    else if (chinese) lines.push("- " + label + "：" + vacancy + " 個空位");
                    else lines.push("- " + label + ": " + vacancy + " spaces");
                });
                if (detailBase && carpark.park_id) lines.push((chinese ? "詳情：" : "Details: ") + detailBase + carpark.park_id);
            });
            if (tomorrow) {
                lines.push("");
                lines.push(chinese
                    ? "聽日：政府沒有聽日空位。上面是而家的數字，出門前再查一次。"
                    : "Tomorrow: there is no forecast. The numbers above are for now. Check again before you leave.");
            }
            var districts = regions.length ? regions : [matches[0].district_en];
            return noticesFor(districts, chinese, 3).then(function (notices) {
                if (notices.length) {
                    lines.push("");
                    lines.push(chinese ? "這個地區相關通告：" : "Notices for this district:");
                    notices.forEach(function (notice) { lines.push("- " + notice.title); });
                }
                return lines.join("\n");
            });
        });
    }

    function typicalNow(history, parkId) {
        var hours = (history && history.hours) || {};
        var now = new Date();
        var bucket = now.toISOString().slice(0, 13);
        var hour = now.getUTCHours();
        var weekday = (now.getUTCDay() + 6) % 7;
        var samples = [];
        Object.keys(hours).forEach(function (key) {
            if (key === bucket) return;
            var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key);
            if (!match) return;
            var stamp = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4]));
            if (stamp.getUTCHours() !== hour) return;
            if (((stamp.getUTCDay() + 6) % 7) !== weekday) return;
            var row = hours[key][parkId];
            if (row) samples.push(row);
        });
        function average(index) {
            var values = samples.map(function (row) { return row[index]; }).filter(function (value) {
                return typeof value === "number" && value >= 0;
            });
            if (values.length < 3) return null;
            var sum = values.reduce(function (total, value) { return total + value; }, 0);
            return Math.round(sum / values.length);
        }
        return { samples: samples.length, privateCar: average(0), motorCycle: average(1) };
    }

    root.EasePark = {
        DISTRICTS: Object.keys(DISTRICT_LABELS),
        DISTRICT_LABELS: DISTRICT_LABELS,
        canonDistrict: canonDistrict,
        districtLabel: districtLabel,
        vacancyCount: vacancyCount,
        isOpen: isOpen,
        passesListing: passesListing,
        loadCarparks: loadCarparks,
        noticesFor: noticesFor,
        answer: answer,
        typicalNow: typicalNow
    };
})(window);
