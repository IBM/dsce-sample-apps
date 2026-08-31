import datetime
import json
from config.app_config import AppConfig

class DateTimeTool:
    def __init__(self):
        pass

    def date_time_tool(self) -> dict:
        """
        Retrieve current date and time using this tool.
        """
        try:
            app_config = AppConfig()
            if app_config.USE_CACHE_TOOL_RESPONSES:
                with open(app_config.TOOL_CACHE_LOCATION+'date_tool_cache.json', 'r') as f:
                    today_date = json.loads(f.read())
                print('[INFO]: Using cached tool response ...')
                today_date = today_date.get('tool_response')
            else:
                now = datetime.datetime.now()
                today_date = {
                    'today-date': now.strftime('%mm-%dd-%YYYY'),
                    'current-time': now.strftime('%H:%M:%S')
                }
                if app_config.UPDATE_TOOL_CACHE:
                    with open(app_config.TOOL_CACHE_LOCATION+'date_tool_cache.json', 'w') as f:
                        f.write(json.dumps({'tool_response': today_date}))
            return today_date
        except Exception as e:
            return {
                'error': str(e)
            }