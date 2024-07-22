from flask import Flask, jsonify, request, render_template
import requests

app = Flask(__name__)

@app.route('/fuel_stations', methods=['GET'])
def get_fuel_stations():
    url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
    response = requests.get(url)
    data = response.json()
    return jsonify(data)

@app.route('/fuel_stations/filter', methods=['GET'])
def filter_fuel_stations():
    url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
    response = requests.get(url)
    data = response.json()
    stations = data['ListaEESSPrecio']

    filters = request.args.to_dict()
    filtered_stations = []

    for station in stations:
        match = True
        for key, value in filters.items():
            if station.get(key) != value:
                match = False
                break
        if match:
            filtered_stations.append(station)

    return jsonify(filtered_stations)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
