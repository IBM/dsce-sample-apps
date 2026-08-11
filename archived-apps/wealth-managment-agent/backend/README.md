# Wealth Manager Agent Backend

Run the following commands to get the app running :

```
pip install -r requirements.txt
```
```
uvicorn main:app --reload
```

Environament variables
```
IBM_CLOUD_API_KEY=
WX_PROJECT_ID=
WX_ENDPOINT=https://us-south.ml.cloud.ibm.com
FASTAPI_KEY=wm
USE_TOOL_CACHE=true # set to false to use the live tool results
TAVILY_API_KEY=
```