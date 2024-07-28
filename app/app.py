from flask import Flask, jsonify, request, render_template
import requests
import logging
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
if __name__ != '__main__':
    gunicorn_logger = logging.getLogger('gunicorn.error')
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)

CACHE_FILE = 'fuel_stations_cache.json'
last_fetch_time = None
cached_data = None

def should_fetch_data():
    global last_fetch_time
    current_time = datetime.now()

    if last_fetch_time is None:
        return True

    time_diff = current_time - last_fetch_time
    minutes_passed = time_diff.total_seconds() / 60

    return (current_time.minute % 30 == 0 and minutes_passed >= 1) or minutes_passed >= 30

def fetch_and_cache_data():
    global last_fetch_time, cached_data

    url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
    response = requests.get(url)
    data = response.json()

    with open(CACHE_FILE, 'w') as cache_file:
        json.dump(data, cache_file)

    last_fetch_time = datetime.now()
    cached_data = data
    return data

def get_cached_data():
    global cached_data
    if cached_data is None:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as cache_file:
                cached_data = json.load(cache_file)
        else:
            cached_data = fetch_and_cache_data()
    return cached_data

@app.route('/fuel_stations', methods=['GET'])
def get_fuel_stations():
    app.logger.info("OS requesting: " + request.headers.get('User-Agent'))
    if should_fetch_data():
        app.logger.info("Fetching new data from API")
        return jsonify(fetch_and_cache_data())
    else:
        app.logger.info("Returning cached data")
        return jsonify(get_cached_data())



@app.route('/fuel_stations/filter/<mmid>', methods=['GET'])
def filter_fuel_stations(mmid):
    app.logger.info(f"Filtering fuel stations for municipio ID: {mmid}")
    url = f"https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroMunicipio/{mmid}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if 'ListaEESSPrecio' in data:
            return jsonify(data)
        else:
            app.logger.error(f"Unexpected data structure received from API: {data}")
            return jsonify({"error": "Unexpected data structure received from API"}), 500
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error fetching data from API: {str(e)}")
        return jsonify({"error": "Failed to fetch data from the API"}), 500


@app.route('/provincias', methods=['GET'])
def get_provincias():
    url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Provincias/"
    response = requests.get(url)
    data = response.json()
    return jsonify(data)


@app.route('/municipios/<provid>', methods=['GET'])
def get_municipios(provid):
    url = f"https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/MunicipiosPorProvincia/{provid}"
    response = requests.get(url)
    data = response.json()
    return jsonify(data)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/manifest.json')
def serve_manifest():
    return app.send_static_file('manifest.json')

@app.route('/translations')
def server_translations():
    return app.send_static_file('translations.json')
@app.route('/sw.js')
def serve_service_worker():
    return app.send_static_file('sw.js')


if __name__ == '__main__':
    app.run(debug=True)
