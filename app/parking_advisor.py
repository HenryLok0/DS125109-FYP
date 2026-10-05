"""Answer parking questions from live government car-park records."""
import re

# Area words visitors type, paired with the English form used in open data.
AREA_ALIASES = (
    ("中環", "central"),
    ("金鐘", "admiralty"),
    ("上環", "sheung wan"),
    ("西營盤", "sai ying pun"),
    ("西環", "sai ying pun"),
    ("灣仔", "wan chai"),
    ("銅鑼灣", "causeway bay"),
    ("天后", "tin hau"),
    ("北角", "north point"),
    ("鰂魚涌", "quarry bay"),
    ("太古", "taikoo"),
    ("筲箕灣", "shau kei wan"),
    ("柴灣", "chai wan"),
    ("香港仔", "aberdeen"),
    ("鴨脷洲", "ap lei chau"),
    ("赤柱", "stanley"),
    ("山頂", "the peak"),
    ("尖沙咀", "tsim sha tsui"),
    ("尖沙嘴", "tsim sha tsui"),
    ("佐敦", "jordan"),
    ("油麻地", "yau ma tei"),
    ("旺角", "mong kok"),
    ("太子", "prince edward"),
    ("深水埗", "sham shui po"),
    ("長沙灣", "cheung sha wan"),
    ("荔枝角", "lai chi kok"),
    ("九龍塘", "kowloon tong"),
    ("何文田", "ho man tin"),
    ("紅磡", "hung hom"),
    ("土瓜灣", "to kwa wan"),
    ("九龍城", "kowloon city"),
    ("黃大仙", "wong tai sin"),
    ("鑽石山", "diamond hill"),
    ("觀塘", "kwun tong"),
    ("藍田", "lam tin"),
    ("油塘", "yau tong"),
    ("荃灣", "tsuen wan"),
    ("葵涌", "kwai chung"),
    ("葵芳", "kwai fong"),
    ("青衣", "tsing yi"),
    ("沙田", "sha tin"),
    ("大圍", "tai wai"),
    ("馬鞍山", "ma on shan"),
    ("大埔", "tai po"),
    ("粉嶺", "fanling"),
    ("上水", "sheung shui"),
    ("元朗", "yuen long"),
    ("天水圍", "tin shui wai"),
    ("屯門", "tuen mun"),
    ("將軍澳", "tseung kwan o"),
    ("西貢", "sai kung"),
    ("東涌", "tung chung"),
    ("機場", "airport"),
    ("中西區", "central & western"),
    ("灣仔區", "wan chai"),
    ("東區", "eastern"),
    ("南區", "southern"),
    ("油尖旺", "yau tsim mong"),
)

# Broad areas. Matched only when the visitor did not name a smaller place.
REGIONS = (
    (("港島區", "香港島", "港島", "hong kong island"), ("Central & Western", "Wan Chai", "Eastern", "Southern")),
    (("九龍區", "九龍", "kowloon"), ("Yau Tsim Mong", "Sham Shui Po", "Kowloon City", "Wong Tai Sin", "Kwun Tong")),
    (("新界區", "新界", "new territories"), ("Kwai Tsing", "Tsuen Wan", "Yuen Long", "Tuen Mun", "North", "Tai Po", "Sha Tin", "Sai Kung", "Islands")),
)

MOTOR_WORDS = ("電單車", "摩托車", "電單", "motorcycle", "motorbike")
CAR_WORDS = ("私家車", "私家", "private car")
SKIP_TOKENS = {
    "今日", "聽日", "明天", "而家", "現在", "應該", "點樣", "怎樣", "如何",
    "一架", "一個", "一格", "泊車", "停車", "停車場", "空位", "附近", "地方",
    "today", "tomorrow", "park", "parking", "where",
}


def _is_chinese(text):
    return any("\u4e00" <= char <= "\u9fff" for char in text)


def _haystack(carpark):
    parts = (
        carpark.get("name_tc"),
        carpark.get("name_en"),
        carpark.get("name"),
        carpark.get("displayAddress_tc"),
        carpark.get("displayAddress_en"),
        carpark.get("displayAddress"),
        carpark.get("district_tc"),
        carpark.get("district_en"),
        carpark.get("district"),
    )
    return " ".join(str(part) for part in parts if part).lower()


def _name(carpark, chinese):
    if chinese:
        return carpark.get("name_tc") or carpark.get("name_en") or carpark.get("name") or "停車場"
    return carpark.get("name_en") or carpark.get("name") or carpark.get("name_tc") or "Car park"


def _address(carpark, chinese):
    if chinese:
        return carpark.get("displayAddress_tc") or carpark.get("displayAddress_en") or carpark.get("displayAddress") or ""
    return carpark.get("displayAddress_en") or carpark.get("displayAddress") or carpark.get("displayAddress_tc") or ""


def _requested_vehicles(message):
    lowered = message.lower()
    vehicles = []
    has_motor = any(word in lowered for word in MOTOR_WORDS)
    if has_motor:
        vehicles.append(("motorCycle", "電單車", "Motorcycles"))
    remainder = lowered
    for word in MOTOR_WORDS:
        remainder = remainder.replace(word, "")
    has_car = any(word in lowered for word in CAR_WORDS) or ("車" in remainder) or bool(re.search(r"\bcar\b", remainder))
    if has_car:
        vehicles.insert(0, ("privateCar", "私家車", "Private cars"))
    if not vehicles:
        vehicles = [
            ("privateCar", "私家車", "Private cars"),
            ("motorCycle", "電單車", "Motorcycles"),
        ]
    return vehicles


def _asks_tomorrow(message):
    lowered = message.lower()
    return any(word in lowered for word in ("聽日", "明天", "tomorrow"))


def _format_vacancy(value, chinese):
    text = str(value).strip() if value is not None else ""
    if text.lower() in ("", "n/a", "none", "null", "-1"):
        return "未提供" if chinese else "not reported"
    return text


def _status(carpark, chinese):
    raw = str(carpark.get("opening_status") or "").upper()
    if raw == "OPEN":
        return "營業中" if chinese else "Open"
    if raw == "CLOSED":
        return "暫停開放" if chinese else "Closed"
    return "狀態未提供" if chinese else "Status not reported"


def _named_area(message):
    lowered = message.lower()
    for chinese_name, english_name in AREA_ALIASES:
        if chinese_name in message or english_name in lowered:
            return True
    return False


def _region_districts(message):
    if _named_area(message):
        return ()
    lowered = message.lower()
    for phrases, districts in REGIONS:
        for phrase in phrases:
            if phrase.lower() in lowered:
                return districts
    return ()


def _vacancy_count(carpark, vehicle_key):
    try:
        number = int(carpark.get(vehicle_key + "_vacancy"))
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def _passes_listing(carpark, vehicles):
    """Open, and every requested vehicle has a reported space above zero."""
    if str(carpark.get("opening_status") or "").upper() != "OPEN":
        return False
    for key, _zh_label, _en_label in vehicles:
        count = _vacancy_count(carpark, key)
        if count is None or count <= 0:
            return False
    return True


def _wants_spaces_now(message):
    lowered = message.lower()
    return any(word in lowered for word in ("有位", "空位", "邊度有", "where", "vacancy", "available"))


def _district_name(carpark):
    return str(carpark.get("district_en") or carpark.get("district") or "")


def _score(carpark, message, region_districts):
    if region_districts:
        return 8 if _district_name(carpark) in region_districts else 0
    haystack = _haystack(carpark)
    lowered = message.lower()
    score = 0
    for chinese_name, english_name in AREA_ALIASES:
        mentioned = chinese_name in message or english_name in lowered
        present = chinese_name.lower() in haystack or english_name in haystack
        if mentioned and present:
            score += 8
    for token in re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}", message):
        if token.lower() in SKIP_TOKENS:
            continue
        if token.lower() in haystack:
            score += 6
    return score


def _select_matches(message, carparks, limit=5):
    """Rank live records against the question. Returns the shortlist and the parsed intent."""
    chinese = _is_chinese(message)
    vehicles = _requested_vehicles(message)
    tomorrow = _asks_tomorrow(message)
    region_districts = _region_districts(message)
    wants_spaces = _wants_spaces_now(message)

    def usable_spaces(carpark):
        total = 0
        for key, _zh_label, _en_label in vehicles:
            try:
                number = int(carpark.get(key + "_vacancy"))
            except (TypeError, ValueError):
                continue
            if number >= 0:
                total += number
        return total

    ranked = sorted(
        ((_score(carpark, message, region_districts), usable_spaces(carpark), carpark) for carpark in carparks),
        key=lambda item: (item[0], item[1]),
        reverse=True,
    )
    matches = []
    for score, _spaces, carpark in ranked:
        if score <= 0:
            continue
        if wants_spaces and not _passes_listing(carpark, vehicles):
            continue
        matches.append(carpark)
        if len(matches) == limit:
            break
    return {
        "chinese": chinese,
        "vehicles": vehicles,
        "tomorrow": tomorrow,
        "wants_spaces": wants_spaces,
        "ranked": ranked,
        "matches": matches,
    }


def _format_reply(picked, matches):
    chinese = picked["chinese"]
    vehicles = picked["vehicles"]
    tomorrow = picked["tomorrow"]
    lines = []
    if chinese:
        lines.append("以下是而家的即時空位")
    else:
        lines.append("These are live vacancies from the government feed, not a forecast for tomorrow.")

    for index, carpark in enumerate(matches, start=1):
        lines.append("")
        lines.append("{}. {}（{}）".format(index, _name(carpark, chinese), _status(carpark, chinese)))
        address = _address(carpark, chinese)
        if address:
            lines.append(address)
        hourly = _hourly_note(carpark)
        height = _height_note(carpark)
        if hourly or height:
            extras = []
            if hourly:
                extras.append(("時租 " if chinese else "Hourly ") + hourly)
            if height:
                extras.append(("高度 " if chinese else "Height ") + height)
            lines.append(" · ".join(extras))
        for key, zh_label, en_label in vehicles:
            vacancy = _format_vacancy(carpark.get(key + "_vacancy"), chinese)
            label = zh_label if chinese else en_label
            if vacancy in ("未提供", "not reported"):
                lines.append("- {}：{}".format(label, vacancy))
            elif chinese:
                lines.append("- {}：{} 個空位".format(label, vacancy))
            else:
                lines.append("- {}: {} spaces".format(label, vacancy))

    if tomorrow:
        lines.append("")
        if chinese:
            lines.append("聽日：政府沒有聽日空位。建議私家車同電單車分開泊，優先揀上面兩種車都有位的場，出門前再查一次當日空位。")
        else:
            lines.append("Tomorrow: there is no forecast. Park the car and the motorcycle separately, prefer a site that has both, and check the live numbers again before you leave.")
    elif len(vehicles) > 1 and chinese:
        lines.append("")
        lines.append("如果私家車同電單車一齊去，要揀兩種車位都有的場，因為通常唔可以泊入同一個位。")
    elif len(vehicles) > 1:
        lines.append("")
        lines.append("A car and a motorcycle need separate spaces. Pick a site that shows vacancies for both.")
    return "\n".join(lines)


def answer_parking_question(message, carparks):
    """Build a direct answer from car-park records. Vacancy figures are for now only."""
    picked = _select_matches(message, carparks)
    chinese = picked["chinese"]
    wants_spaces = picked["wants_spaces"]
    matches = picked["matches"]
    ranked = picked["ranked"]

    if not matches:
        if wants_spaces and any(item[0] > 0 for item in ranked):
            if chinese:
                return "這個範圍沒有營業中、而且所選車種有位的停車場。"
            return "Nothing in that area is open with a space for the vehicle you asked about."
        if chinese:
            return (
                "我未對到這個地方。請講地區或停車場名，例如「中環」、「尖沙咀」或「環球大廈」。\n"
                "可以一併講車種（私家車、電單車）同埋係今日定聽日。"
            )
        return (
            "I could not match that place. Name a district or car park, for example Central or Tsim Sha Tsui.\n"
            "You can also say the vehicle type and whether you mean today or tomorrow."
        )
    return _format_reply(picked, matches)


def _park_key(carpark):
    return str(carpark.get("park_id") or carpark.get("park_Id") or "")


def _height_note(carpark):
    lines = []
    for limit in carpark.get("heightLimits") or []:
        if not isinstance(limit, dict):
            continue
        height = limit.get("height")
        if height in (None, ""):
            continue
        text = "{} m".format(height)
        if text not in lines:
            lines.append(text)
    return " · ".join(lines)


def _hourly_note(carpark):
    private_car = carpark.get("privateCar") if isinstance(carpark.get("privateCar"), dict) else {}
    for record in private_car.get("hourlyCharges") or []:
        if not isinstance(record, dict):
            continue
        price = record.get("price")
        if price in (None, "", "N/A"):
            continue
        return "HK${}".format(price)
    price = carpark.get("price")
    if price in (None, "", "N/A"):
        return ""
    return "HK${}".format(price)


def _fact_sheet(matches, vehicles, typical, focus_id):
    """Compact records for Gemini. Only published fields are included."""
    blocks = []
    if focus_id:
        blocks.append("The visitor is viewing park_id {}.".format(focus_id))
    for carpark in matches:
        park_id = _park_key(carpark)
        lines = [
            "park_id: {}".format(park_id),
            "name: {}".format(carpark.get("name") or ""),
            "name_tc: {}".format(carpark.get("name_tc") or ""),
            "address: {}".format(carpark.get("displayAddress") or ""),
            "address_tc: {}".format(carpark.get("displayAddress_tc") or ""),
            "district: {}".format(carpark.get("district") or ""),
            "status: {}".format(carpark.get("opening_status") or ""),
            "operator: {}".format(carpark.get("operator_label") or ""),
            "live_vacancy: {}".format("yes" if carpark.get("has_live_vacancy") else "no"),
        ]
        for key, zh_label, en_label in vehicles:
            lines.append("{} vacancy now: {}".format(en_label, _format_vacancy(carpark.get(key + "_vacancy"), False)))
        hourly = _hourly_note(carpark)
        if hourly:
            lines.append("hourly price: {}".format(hourly))
        height = _height_note(carpark)
        if height:
            lines.append("height limit: {}".format(height))
        history = (typical or {}).get(park_id) or {}
        if history.get("private_car") is not None:
            lines.append("typical private cars this weekday and hour: {} ({} samples)".format(
                history["private_car"], history.get("samples") or 0,
            ))
        if history.get("motorcycle") is not None:
            lines.append("typical motorcycles this weekday and hour: {} ({} samples)".format(
                history["motorcycle"], history.get("samples") or 0,
            ))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _ask_gemini(client, model, message, facts):
    from google.genai import types

    prompt = (
        "You are EaseParkHK, a Hong Kong parking assistant.\n"
        "Reply in the visitor's language. Use Traditional Chinese when the question is Chinese.\n"
        "Use only the records below. Never invent vacancy counts, prices, heights, or hours.\n"
        "If a value is missing, say it is not published.\n"
        "Vacancy figures are live for now, not a forecast. If they ask about tomorrow, say there is no official forecast.\n"
        "Mention at most 5 car parks and stay under 160 words.\n\n"
        "Question:\n{message}\n\n"
        "Records:\n{facts}\n"
    ).format(message=(message or "")[:500], facts=(facts or "")[:6000])
    response = client.models.generate_content(
        model=model or "gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=400,
        ),
    )
    try:
        text = (response.text or "").strip()
    except Exception:
        text = ""
    return text[:1500]


def advise(message, carparks, gemini_client=None, model="gemini-2.5-flash", typical=None, focus_id=""):
    """Mix live records with Gemini. Without a client, return the record answer only."""
    picked = _select_matches(message, carparks)
    matches = list(picked["matches"])
    focus_id = str(focus_id or "")
    if focus_id:
        focused = next((item for item in carparks if _park_key(item) == focus_id), None)
        if focused is not None:
            matches = [focused] + [item for item in matches if _park_key(item) != focus_id]
            matches = matches[:5]

    if not matches:
        return answer_parking_question(message, carparks), "records"
    if gemini_client is None:
        return _format_reply(picked, matches), "records"

    facts = _fact_sheet(matches, picked["vehicles"], typical, focus_id)
    try:
        text = _ask_gemini(gemini_client, model, message, facts)
    except Exception:
        text = ""
    if not text:
        return _format_reply(picked, matches), "records"
    return text, "gemini"

