from flask import Flask, jsonify, request, render_template
import requests
import logging

app = Flask(__name__)
if __name__ != '__main__':
    gunicorn_logger = logging.getLogger('gunicorn.error')
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)


@app.route('/fuel_stations', methods=['GET'])
def get_fuel_stations():
    url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
    response = requests.get(url)
    data = response.json()
    return jsonify(data)


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


@app.route('/sw.js')
def serve_service_worker():
    return app.send_static_file('sw.js')


if __name__ == '__main__':
    app.run(debug=True)
