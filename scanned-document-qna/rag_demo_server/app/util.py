import os

from app import flask_app


def generate_paths(base_path, filename):
    return {
        "langchain": os.path.join(base_path, "extraction", "langchain", filename + ".txt"),
        "wdu": os.path.join(base_path, "extraction", "wdu", filename + ".iocr_parse.txt"),
        "image": os.path.join(base_path, "images", filename + ".png")
    }


# base_path = r"\app\static"
# filename = "7BS.pdf_page1"


def get_filename_without_extension(filepath):
    return os.path.splitext(os.path.basename(filepath))[0]


def create_path_dict():
    paths_dict = {}
    for file_n in os.listdir(flask_app.config['IMAGES']):
        paths_dict[get_filename_without_extension(file_n)] = generate_paths(flask_app.config['STATIC'],
                                                                            get_filename_without_extension(file_n))

    return paths_dict


def get_last_user_message(data: dict) -> str:
    """Return the last user message from the given data."""
    messages = data.get('messages', [])
    for message in reversed(messages):
        if message.get('role') == 'user':
            return message.get('content', '')
    return ''  # return an empty string if no user message is found
