import os
import uvicorn
from dotenv import load_dotenv
import logging

load_dotenv()

LOG_LEVEL: str = os.environ.get('LOGLEVEL', 'WARNING').upper()
FORMAT: str = "%(levelprefix)s %(asctime)s - %(name)s - %(levelname)s - %(message)s"

logging_config = {
    "version": 1, # mandatory field
    # if you want to overwrite existing loggers' configs
    # "disable_existing_loggers": False,
    "formatters": {
        "basic": {
            "()": "uvicorn.logging.DefaultFormatter",
            "format": FORMAT,
        }
    },
    "handlers": {
        "console": {
            "formatter": "basic",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
            "level": LOG_LEVEL,
        }
    },
    "loggers": {
        "simple_example": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            # "propagate": False
        }
    },
}

def init_loggers(logger_name: str = "simple_example"):    
    # print(f'\n\n--------  init_loggers: {LOG_LEVEL} --------- \n\n')
    logger = logging.getLogger(logger_name)
    logger.setLevel(LOG_LEVEL)
    ch = logging.StreamHandler()
    # ch.setLevel(logging.INFO)
    # create formatter
    formatter = uvicorn.logging.DefaultFormatter(FORMAT)
    ch.setFormatter(formatter)
    # add ch to logger
    logger.addHandler(ch)


# 'application' code
# logger.debug('debug message')
# logger.info('info message')
# logger.warning('warn message')
# logger.error('error message')
# logger.critical('critical message')