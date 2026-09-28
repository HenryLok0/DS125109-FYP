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


def answer_parking_question(message, carparks):
    """Build a direct answer from car-park records. Vacancy figures are for now only."""
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
        (( _score(carpark, message, region_districts), usable_spaces(carpark), carpark) for carpark in carparks),
        key=lambda item: (item[0], item[1]),
        reverse=True,
    )
    matches = []
    for score, spaces, carpark in ranked:
        if score <= 0:
            continue
        if wants_spaces and spaces <= 0:
            continue
        matches.append(carpark)
        if len(matches) == 5:
            break

    if not matches:
        if chinese:
            return (
                "我未對到這個地方。請講地區或停車場名，例如「中環」、「尖沙咀」或「環球大廈」。\n"
                "可以一併講車種（私家車、電單車）同埋係今日定聽日。"
            )
        return (
            "I could not match that place. Name a district or car park, for example Central or Tsim Sha Tsui.\n"
            "You can also say the vehicle type and whether you mean today or tomorrow."
        )

    lines = []
    if chinese:
        lines.append("以下是而家的即時空位（政府資料），不是聽日的預測。")
    else:
        lines.append("These are live vacancies from the government feed, not a forecast for tomorrow.")

    for index, carpark in enumerate(matches, start=1):
        lines.append("")
        lines.append("{}. {}（{}）".format(index, _name(carpark, chinese), _status(carpark, chinese)))
        address = _address(carpark, chinese)
        if address:
            lines.append(address)
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
