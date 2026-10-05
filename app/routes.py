from flask import render_template, jsonify, flash, redirect, url_for, request, g, session, send_from_directory
import requests
from flask_babel import _, get_locale
from app import app, db, client
from app.govdata import (
    fetch_en_carparks,
    fetch_zh_carparks,
    read_excel_rows,
    get_carpark_by_id,
    search_carparks,
    vacancy_cards,
    carpark_profile,
    get_coverage_stats,
)
from app.parking_advisor import advise
from app.vacancy_history import record_hourly_snapshot, typical_for_now, load_history, start_hourly_recorder
import json
import xml.etree.ElementTree as ET
import logging
import pandas as pd
import os

def _safe_en_carparks():
    try:
        return fetch_en_carparks()
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError):
        return []


def _safe_zh_carparks():
    try:
        return fetch_zh_carparks()
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError):
        return []


@app.context_processor
def inject_coverage():
    try:
        return {"coverage": get_coverage_stats()}
    except Exception:
        return {"coverage": None}


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.svg',
        mimetype='image/svg+xml'
    )

@app.route('/zh/metered_parking_spaces_new_territories')
def metered_parking_spaces_new_territories_chi():
    url = "https://www.td.gov.hk/filemanager/tc/content_5036/opendata/nt_parking_spaces_chi.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('zh.metered_parking_spaces_new_territories.html.j2', parking_spaces=parking_spaces)
 
@app.route('/metered_parking_spaces_new_territories')
def metered_parking_spaces_new_territories():
    url = "https://www.td.gov.hk/filemanager/en/content_5036/opendata/nt_parking_spaces_eng.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('metered_parking_spaces_new_territories.html.j2', parking_spaces=parking_spaces)
 
@app.route('/zh/metered_parking_spaces_kowloon')
def metered_parking_spaces_kowloon_chi():
    url = "https://www.td.gov.hk/filemanager/tc/content_5036/opendata/kln_parking_spaces_chi.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('zh.metered_parking_spaces_kowloon.html.j2', parking_spaces=parking_spaces)
 
@app.route('/metered_parking_spaces_kowloon')
def metered_parking_spaces_kowloon():
    url = "https://www.td.gov.hk/filemanager/en/content_5036/opendata/kln_parking_spaces_eng.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('metered_parking_spaces_kowloon.html.j2', parking_spaces=parking_spaces)
 
@app.route('/zh/metered_parking_spaces_hong_kong_island')
def metered_parking_spaces_hong_kong_island_chi():
    url = "https://www.td.gov.hk/filemanager/tc/content_5036/opendata/hki_parking_spaces_chi.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('zh.metered_parking_spaces_hong_kong_island.html.j2', parking_spaces=parking_spaces)
 
@app.route('/metered_parking_spaces_hong_kong_island')
def mmetered_parking_spaces_hong_kong_island():
    url = "https://www.td.gov.hk/filemanager/en/content_5036/opendata/hki_parking_spaces_eng.xlsx"
    parking_spaces = read_excel_rows(url)
 
    return render_template('metered_parking_spaces_hong_kong_island.html.j2', parking_spaces=parking_spaces)

@app.route('/privacy_policy')
def privacy_policy():
    return render_template('privacy_policy.html.j2')

def _typical_for(carparks):
    park_ids = []
    for item in carparks:
        park_id = str(item.get("park_id") or item.get("park_Id") or "")
        if park_id:
            park_ids.append(park_id)
    try:
        record_hourly_snapshot(carparks)
        return typical_for_now(park_ids)
    except Exception:
        app.logger.exception("vacancy history unavailable for advisor")
        return {}


@app.route('/send_message', methods=['POST'])
def send_message():
    payload = request.get_json(silent=True) or {}
    message = (payload.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'No message provided'}), 400

    try:
        carparks = fetch_zh_carparks()
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError):
        try:
            carparks = fetch_en_carparks()
        except (requests.RequestException, ValueError, KeyError, TypeError, IndexError):
            carparks = []

    reply, source = advise(
        message,
        carparks,
        gemini_client=client,
        model=app.config.get("GEMINI_MODEL") or "gemini-2.5-flash",
        typical=_typical_for(carparks),
        focus_id=(payload.get("park_id") or "").strip(),
    )
    return jsonify({"reply": reply, "source": source})


@app.route('/zh/news')
def zh_news():
    urls = {
        "Temporary Road Closure": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml",
        "Expressways": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Expressways.xml",
        "Prohibited Zone": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Prohibited_Zone.xml",
        "Special Traffic and Transport Arrangement": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml",
        "Other Notices": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Other_Notices.xml",
        "有關臨時車速限制的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Speed_Limits.xml",
        "有關禁止上落客貨區的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Clearways.xml",
        "有關公共交通服務的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml",
        "特別交通及運輸措施":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml"
    }

    selected_types = request.args.getlist('type')
    notices = []

    if not selected_types:
        selected_types = urls.keys()

    for notice_type in selected_types:
        url = urls.get(notice_type)
        if url:
            try:
                response = requests.get(url)
                response.raise_for_status()  # Raise an HTTPError for bad responses
                if 'application/xml' in response.headers.get('Content-Type', ''):
                    root = ET.fromstring(response.content)
                    for notice in root.findall('Notice'):
                        content_TC = notice.find('Content_TC').text
                        if '.pdf' not in content_TC:
                            notice_data = {
                                'Title_TC': notice.find('Title_TC').text,
                                'Content_TC': content_TC
                            }
                            notices.append(notice_data)
                else:
                    logging.error(f"Unexpected content type from {url}: {response.headers.get('Content-Type')}")
            except requests.exceptions.RequestException as e:
                logging.error(f"Error fetching data from {url}: {e}")
            except ET.ParseError as e:
                logging.error(f"Error parsing XML from {url}: {e}")

    return render_template('zh.news.html.j2', notices=notices)

@app.route('/news')
def news():
    urls = {
        "Temporary Road Closure": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml",
        "Expressways": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Expressways.xml",
        "Prohibited Zone": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Prohibited_Zone.xml",
        "Special Traffic and Transport Arrangement": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml",
        "Other Notices": "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Other_Notices.xml",
        "有關臨時車速限制的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Speed_Limits.xml",
        "有關禁止上落客貨區的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Clearways.xml",
        "有關公共交通服務的最新通告":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml",
        "特別交通及運輸措施":"https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml"
    }

    selected_types = request.args.getlist('type')
    notices = []

    if not selected_types:
        selected_types = urls.keys()

    for notice_type in selected_types:
        url = urls.get(notice_type)
        if url:
            try:
                response = requests.get(url)
                response.raise_for_status()  # Raise an HTTPError for bad responses
                if 'application/xml' in response.headers.get('Content-Type', ''):
                    root = ET.fromstring(response.content)
                    for notice in root.findall('Notice'):
                        content_en = notice.find('Content_EN').text
                        if '.pdf' not in content_en:
                            notice_data = {
                                'Title_EN': notice.find('Title_EN').text,
                                'Content_EN': content_en
                            }
                            notices.append(notice_data)
                else:
                    logging.error(f"Unexpected content type from {url}: {response.headers.get('Content-Type')}")
            except requests.exceptions.RequestException as e:
                logging.error(f"Error fetching data from {url}: {e}")
            except ET.ParseError as e:
                logging.error(f"Error parsing XML from {url}: {e}")

    return render_template('news.html.j2', notices=notices)

@app.route('/camera')
def camera():
    response = requests.get('https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml')
    tree = ET.ElementTree(ET.fromstring(response.content))
    root = tree.getroot()

    cameras = []
    for image in root.findall('image'):
        camera = {
            'key': image.find('key').text,
            'region': image.find('region').text,
            'district': image.find('district').text,
            'description': image.find('description').text,
            'latitude': image.find('latitude').text,
            'longitude': image.find('longitude').text,
            'url': image.find('url').text
        }
        cameras.append(camera)

    return render_template('camera.html.j2', cameras=cameras)

@app.route('/zh/camera')
def zh_camera():
    response = requests.get('https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_Tc.xml')
    tree = ET.ElementTree(ET.fromstring(response.content))
    root = tree.getroot()

    cameras = []
    for image in root.findall('image'):
        camera = {
            'key': image.find('key').text,
            'region': image.find('region').text,
            'district': image.find('district').text,
            'description': image.find('description').text,
            'latitude': image.find('latitude').text,
            'longitude': image.find('longitude').text,
            'url': image.find('url').text
        }
        cameras.append(camera)

    return render_template('zh.camera.html.j2', cameras=cameras)

@app.before_request
def before_request():
    g.locale = str(get_locale())

@app.route('/ai-chatbox')
def ai_chatbox():
    lang = "zh" if request.args.get("lang") == "zh" else "en"
    return render_template(
        "ai-chatbox.html.j2",
        chinese=lang == "zh",
        gemini_ready=client is not None,
        park_id=request.args.get("park") or "",
    )


def _map_payload(chinese):
    carparks = fetch_zh_carparks()
    park_ids = [str(item.get("park_id") or "") for item in carparks if item.get("park_id")]
    try:
        record_hourly_snapshot(carparks)
        typical = typical_for_now(park_ids)
    except Exception:
        app.logger.exception("vacancy history unavailable")
        typical = {}
    features = []
    for carpark in carparks:
        try:
            latitude = float(carpark.get("latitude"))
            longitude = float(carpark.get("longitude"))
        except (TypeError, ValueError):
            continue
        park_id = str(carpark.get("park_id") or "")
        history = typical.get(park_id, {"samples": 0, "private_car": None, "motorcycle": None})
        features.append({
            "id": park_id,
            "name": (carpark.get("name_tc") if chinese else carpark.get("name_en")) or carpark.get("name_tc") or "",
            "address": (carpark.get("displayAddress_tc") if chinese else carpark.get("displayAddress_en")) or "",
            "lat": latitude,
            "lng": longitude,
            "status": carpark.get("opening_status") or "",
            "private_car": carpark.get("privateCar_vacancy"),
            "motorcycle": carpark.get("motorCycle_vacancy"),
            "typical_private_car": history["private_car"],
            "typical_motorcycle": history["motorcycle"],
            "samples": history["samples"],
        })
    return features


_DOCS = os.path.join(os.path.dirname(app.root_path), "docs")


@app.route('/onestop.css')
def onestop_css():
    return send_from_directory(_DOCS, "onestop.css")


@app.route('/onestop.js')
def onestop_js():
    return send_from_directory(_DOCS, "onestop.js")


@app.route('/advisor.js')
def advisor_js():
    return send_from_directory(_DOCS, "advisor.js")


@app.route('/api/vacancy-history')
def vacancy_history_api():
    return jsonify(load_history())


@app.route('/map')
def carpark_map():
    return render_template(
        'carpark_map.html.j2',
        chinese=False,
        favorite_ids=session.get('favorite_carparks', []),
    )


@app.route('/zh/map')
def zh_carpark_map():
    return render_template(
        'carpark_map.html.j2',
        chinese=True,
        favorite_ids=session.get('favorite_carparks', []),
    )


@app.route('/api/map-carparks')
def map_carparks():
    chinese = request.args.get("lang") == "zh"
    try:
        return jsonify(_map_payload(chinese))
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError):
        return jsonify([])

@app.route('/')
def index():
    return redirect('/map')

@app.route('/toggle_favorite/<park_id>', methods=['POST'])
def toggle_favorite(park_id):
    if 'favorite_carparks' not in session:
        session['favorite_carparks'] = []

    favorite_carparks = session['favorite_carparks']

    if park_id in favorite_carparks:
        favorite_carparks.remove(park_id)
    else:
        favorite_carparks.append(park_id)

    session['favorite_carparks'] = favorite_carparks
    return jsonify(success=True)

@app.route('/zh')
@app.route('/zh<path:path>')
def zh(path=''):
    if path in ('', '/'):
        return redirect('/zh/map')
    carparks = _safe_zh_carparks()

    favorite_carparks = session.get('favorite_carparks', [])
    favorite_carparks_data = [carpark for carpark in carparks if carpark.get('park_id') in favorite_carparks]
    other_carparks_data = [carpark for carpark in carparks if carpark.get('park_id') not in favorite_carparks]

    return render_template('zh.html.j2', favorite_carparks=favorite_carparks_data, carparks=other_carparks_data)

@app.template_filter('translate_status')
def translate_status(status):
    translations = {
        'NONE': '未提供',
        'none': '未提供',
        'OPEN': '營業中',
        'open': '營業中',
        'None': '未提供',
        'CLOSED': '非營業',
        'closed': '非營業'

    }
    normalized_status = str(status).lower()
    return translations.get(normalized_status, '未提供')

@app.route('/carparkinfo/<district>')
def carparkinfo(district):
    carparks = [cp for cp in _safe_en_carparks() if cp.get('district') == district]
    return render_template('carparkinfo.html.j2', carparks=carparks, district=district)

@app.route('/zh/carparkinfo/<district>')
def zh_carparkinfo(district):
    carparks = [cp for cp in _safe_zh_carparks() if cp.get('district_en') == district]
    district_tc = carparks[0]['district_tc'] if carparks else district
    return render_template('zh.carparkinfo.html.j2', carparks=carparks, district_tc=district_tc)

@app.route('/carparkinfo')
def carpark_info():
    carparks = get_carpark_data()  # 確保這裡返回的是一個包含 carpark 對象的列表
    print(carparks)  # 調試輸出
    return render_template('carparkinfo.html.j2', carparks=carparks, district='Your District')
    url = 'https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar&lang=en_US'
    response = requests.get(url)
    data = response.json()

    # Find park with ID "12" and extract required information
    park_info = next((park for park in data['results'] if park['park_Id'] == "12"), None)

    if not park_info:
        return "Park ID not found", 404

    # Prepare data for rendering
    private_car = park_info['privateCar'][0]
    lgv = park_info['LGV'][0]
    hgv = park_info['HGV'][0]
    motorcycle = park_info['motorCycle'][0]

    vacancy_data = [
        {'type': 'Private Car', 'vacancy': private_car['vacancy'], 'last_update': private_car['lastupdate']},
        {'type': 'Large Goods Vehicle', 'vacancy': lgv['vacancy'], 'last_update': lgv['lastupdate']},
        {'type': 'Heavy Goods Vehicle', 'vacancy': hgv['vacancy'], 'last_update': hgv['lastupdate']},
        {'type': 'Motor Cycle', 'vacancy': motorcycle['vacancy'], 'last_update': motorcycle['lastupdate']}
    ]

    return render_template('『carparkinfo_map.html.j2', vacancy_data=vacancy_data)

@app.route('/carpark/<park_id>')
def carpark_detail(park_id):
    carpark = get_carpark_by_id(park_id)
    if not carpark:
        return "Carpark not found", 404
    carpark['vacancy_data'] = vacancy_cards(carpark, 'en')
    carpark['profile'] = carpark_profile(carpark, 'en')
    return render_template('carpark_detail.html.j2', carpark=carpark)

@app.route('/zh/carpark/<park_id>')
def zh_carpark_detail(park_id):
    carpark = get_carpark_by_id(park_id)
    if not carpark:
        return "Carpark not found", 404
    carpark['vacancy_data'] = vacancy_cards(carpark, 'zh')
    carpark['profile'] = carpark_profile(carpark, 'zh')
    return render_template('zh.carpark_detail.html.j2', carpark=carpark)

if __name__ == '__main__':
    app.run(debug=True)

@app.route('/hong_kong_island')
def hong_kong_island():
    hk_island_districts = ['Central & Western', 'Wan Chai', 'Eastern', 'Southern']
    carparks = [cp for cp in _safe_en_carparks() if cp.get('district') in hk_island_districts]
    return render_template('hong_kong_island.html.j2', carparks=carparks)
    response = requests.get('https://api.data.gov.hk/v1/carpark-info-vacancy')
    data = response.json()

    # Filter carparks by districts in Hong Kong Island
    hk_island_districts = ['Central & Western', 'Wan Chai', 'Eastern', 'Southern']
    carparks = [cp for cp in data['results'] if cp['district'] in hk_island_districts]

    return render_template('hong_kong_island.html.j2', carparks=carparks)

@app.route('/zh/hong_kong_island')
def zh_hong_kong_island():
    hk_island_districts = ['Central & Western', 'Wan Chai', 'Eastern', 'Southern']
    carparks = [cp for cp in _safe_zh_carparks() if cp.get('district_en') in hk_island_districts]
    return render_template('zh.hong_kong_island.html.j2', carparks=carparks)


@app.route('/kowloon')
def kowloon():
    kowloon_districts = ['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong']
    carparks = [cp for cp in _safe_en_carparks() if cp.get('district') in kowloon_districts]
    return render_template('kowloon.html.j2', carparks=carparks)
    response = requests.get('https://api.data.gov.hk/v1/carpark-info-vacancy')
    data = response.json()

    # Filter carparks by districts in kowloon
    kowloon_districts = ['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong']
    carparks = [cp for cp in data['results'] if cp['district'] in kowloon_districts]

    return render_template('kowloon.html.j2', carparks=carparks)

@app.route('/zh/kowloon')
def zh_kowloon():
    kowloon_districts = ['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong']
    carparks = [cp for cp in _safe_zh_carparks() if cp.get('district_en') in kowloon_districts]
    return render_template('zh.kowloon.html.j2', carparks=carparks)

@app.route('/new_territories')
def new_territories():
    new_territories_districts = ['Kwai Tsing', 'Tsuen Wan', 'Yuen Long', 'Tuen Mun', 'North', 'Tai Po', 'Sha Tin', 'Sai Kung', 'Islands']
    carparks = [cp for cp in _safe_en_carparks() if cp.get('district') in new_territories_districts]
    return render_template('new_territories.html.j2', carparks=carparks)
    response = requests.get('https://api.data.gov.hk/v1/carpark-info-vacancy')
    data = response.json()

    # Filter carparks by districts in kowloon
    kowloon_districts = ['Kwai Tsing', 'Tsuen Wan', 'Yuen Long', 'Tuen Mun', 'North', 'Tai Po', 'Sha Tin', 'Sai Kung', 'Islands']
    carparks = [cp for cp in data['results'] if cp['district'] in new_territories_districts]

    return render_template('new_territories.j2', carparks=carparks)

@app.route('/zh/new_territories')
def zh_new_territories():
    new_territories_districts = ['Islands', 'Kwai Tsing', 'North', 'Sai Kung', 'Sha Tin', 'Tai Po', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long']
    carparks = [cp for cp in _safe_zh_carparks() if cp.get('district_en') in new_territories_districts]
    return render_template('zh.new_territories.html.j2', carparks=carparks)


@app.route('/result', methods=['GET'])
def result():
    query = request.args.get('p', '')
    results = search_carparks(query, 'en') if query else _safe_en_carparks()
    return render_template(
        'index.html.j2',
        favorite_carparks=[],
        carparks=results,
        search_query=query,
    )

@app.route('/api/carpark-suggest')
def carpark_suggest():
    query = request.args.get('q', '')
    lang = request.args.get('lang', 'en')
    suggestions = []
    for carpark in search_carparks(query, lang)[:8]:
        if lang == 'zh':
            suggestions.append({
                'name': carpark.get('name_tc') or carpark.get('name'),
                'address': carpark.get('displayAddress_tc') or carpark.get('displayAddress') or '',
            })
        else:
            suggestions.append({
                'name': carpark.get('name'),
                'address': carpark.get('displayAddress') or '',
            })
    return jsonify(suggestions)

@app.route('/data1', methods=['GET'])
def data1():
    query = request.args.get('q', '')
    suggestions = [
        carpark.get('name')
        for carpark in search_carparks(query, 'en')[:5]
    ]
    return jsonify(suggestions)

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    results = search_carparks(query, 'en')[:8]
    return render_template('result.html.j2', carparks=results)


@app.route('/zh/search', methods=['GET'])
def zh_search():
    query = request.args.get('w', '')
    results = search_carparks(query, 'zh') if query else []
    return render_template('zh.result.html.j2', carparks=results, search_query=query)

start_hourly_recorder()

if __name__ == '__main__':
    app.run(debug=True)