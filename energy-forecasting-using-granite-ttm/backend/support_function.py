import requests
import pandas as pd
from typing import Dict, Any, List, Union


def encode_data(df: pd.DataFrame, timestamp_column: str) -> Dict[str, Any]:
    df[timestamp_column] = df[timestamp_column].apply(lambda x: x.isoformat())
    data_payload = df.to_dict(orient="list")
    return data_payload


def cast_to_dataframe(data: dict,
                      time_column: str):
    df = pd.DataFrame.from_dict(data)
    if time_column in df:
        df[time_column] = pd.to_datetime(df[time_column], utc=True)
    return df


def post_process_dataframe(df,
                           time_column: str,
                           target_columns: List[str]):
    payload = list()
    for i, _ in enumerate(df.index):
        for col in target_columns:
            row = dict()
            row['date'] = pd.to_datetime(df[time_column].values[i]).strftime('%Y-%m-%d %H:%M:%S')
            row['value'] = df[col].values[i]
            row['group'] = str(col)
            payload.append(row)
    return payload


def call_ttm_remote_service(service_url: str,
                            data: pd.DataFrame,
                            time_column: str,
                            target_columns: Union[str, List[str]],
                            context_length: int,
                            forecast_horizon: int,
                            model_id: str,
                            postfix: str,
                            ):
    if isinstance(target_columns, str):
        target_columns = [target_columns]

    target_columns = [col for col in target_columns if col in data]

    if (time_column not in data) or (len(target_columns) == 0):
        return post_process_dataframe(pd.DataFrame([]),
                                      time_column,
                                      target_columns)

    data_ = data[[time_column] + target_columns][-context_length:]
    data_['data_id'] = 'a'
    msg = dict(
        model_id=model_id,
        parameters=dict(),
        metadata=dict(
            timestamp_column=time_column,
            id_columns=['data_id'],
            target_columns=target_columns
        ),
        data=encode_data(data_, timestamp_column=time_column)
    )
    response = requests.post(service_url,
                             json=msg,
                             headers={})
    resp = response.json()
    result = [cast_to_dataframe(r, time_column)
              for r in resp["results"]][0]
    df_columns =  [f'{c}-{postfix}' if c in target_columns else c for c in result.columns]
    mod_target_columns = [f'{c}-{postfix}'for c in result.columns if c in target_columns]
    result.columns = df_columns
    result = result[:forecast_horizon]
    return post_process_dataframe(result,
                                  time_column=time_column,
                                  target_columns=mod_target_columns)

