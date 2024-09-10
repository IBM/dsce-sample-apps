import os
import json
import logging
import pandas as pd
from dotenv import load_dotenv
from support_function import cast_to_dataframe, call_ttm_remote_service
from flask import Flask, request, session, jsonify
from flask_cors import CORS, cross_origin


load_dotenv()
app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}}, headers='Content-Type')
logging.getLogger('flask_cors').level = logging.DEBUG


@app.route("/forecasting", methods=['POST'])
@cross_origin(origin='*')
def call_ttm_remote():
    default_url = os.environ.get('DEFAULT_URL')
    request_form = request.json
    filename = request_form.get('filename', None)
    csv_payload = request_form.get('data', '{}')
    service_url = request_form.get('url', default_url)
    model_id = request_form.get('model-id', 'ibm-granite/granite-timeseries-ttm-v1')
    context_length = request_form.get('context-length', 512)
    forecast_length = request_form.get('forecast-length', 96)

    time_column = request_form.get('time-column')
    target_columns = request_form.get('target-columns')
    forecast_timestamp = request_form.get('forecast-timestamp', None)
    target_column_postfix = request_form.get('postfix', 'forecasted')

    data = None
    if (filename is not None) and (len(filename) > 0):
        try:
            data = pd.read_csv(filename, parse_dates=[time_column])
        except ...:
            data = None

    if data is None:
        data = cast_to_dataframe(json.loads(csv_payload),
                                 time_column=time_column)
    if forecast_timestamp is not None:
        try:
            forecast_timestamp = pd.to_datetime(forecast_timestamp)
        except ...:
            forecast_timestamp = None

    if forecast_timestamp is not None:
        try:
            forecast_timestamp = pd.to_datetime(forecast_timestamp, utc=True)
            data_ = data.set_index(time_column)
            if data_[:forecast_timestamp].shape[0] >= context_length:
                data = data_[:forecast_timestamp].reset_index()
        except ...:
            forecast_timestamp = None

    response = call_ttm_remote_service(service_url=service_url,
                                       data=data,
                                       model_id=model_id,
                                       time_column=time_column,
                                       target_columns=target_columns,
                                       context_length=context_length,
                                       forecast_horizon=forecast_length,
                                       postfix=target_column_postfix)

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port='8000')

