import os, json, csv
from pathlib import Path
from glob import glob
from towhee import pipe, ops, DataCollection
from pymilvus import connections

# ENVs
# Bucket path where search images resides
COS_BUCKET_URL = os.getenv("COS_BUCKET_URL")
# Milvus parameters
HOST = os.getenv("MILVUS_HOST")
PORT = os.getenv("MILVUS_PORT")
SERVER_NAME = os.getenv("MILVUS_SERVER_NAME")
USER = os.getenv("MILVUS_USER")
PASSWORD = os.getenv("MILVUS_PASSWORD")
TOPK = 5
DIM = 2048 # dimension of embedding extracted by MODEL
COLLECTION_NAME = 'reverse_image_search'
INDEX_TYPE = 'IVF_FLAT'
METRIC_TYPE = 'L2'

# Towhee parameters
MODEL = 'resnet50'
DEVICE = None # if None, use default device (cuda is enabled if available)

# read product's details from json
with open('product_details.json') as products_data:
    produts = json.load(products_data)

# milvus connection
def milvus_connection():
    try:
        connections.connect(alias="default",host=HOST, port=PORT, user=USER, password=PASSWORD, secure=True)
        print('Milvus Database connected successfully.')
        return True
    except Exception as e:
        print(f'Error connecting to Milvus Database: {e}')
        return False

# VECTOR_RELATED FUNCTIONS
# Load image path
def load_image(x):
    if x.endswith('csv'):
        with open(x) as f:
            reader = csv.reader(f)
            next(reader)
            for item in reader:
                yield item[1]
    else:
        for item in glob(x):
            yield item

# Embedding pipeline
p_embed = (
    pipe.input('src')
        .flat_map('src', 'img_path', load_image)
        .map('img_path', 'img', ops.image_decode())
        .map('img', 'vec', ops.image_embedding.timm(model_name=MODEL, device=DEVICE))
)

# Search pipeline
p_search_pre = (
    p_embed.map('vec', ('search_res'), ops.ann_search.milvus_client(
        host=HOST, port=PORT, secure=True,
        server_name=SERVER_NAME,
        user=USER,
        password=PASSWORD, limit=TOPK,
        collection_name=COLLECTION_NAME))
    .map('search_res', 'pred', lambda x: [f"/{Path(y[0]).as_posix()}" for y in x])  # Prepend "/" to each path
)

# Utility
def search_image(src):
    connection = milvus_connection()
    if(connection):
        p_search = p_search_pre.output('img_path', 'pred')
        result = DataCollection(p_search(src[1:]))
        image_paths = result[0]['pred']
        display_result = []
        if(len(image_paths)==0):
            display_result = "No result found!"
        else:
            try:
                for path in image_paths:
                    details = produts[path]
                    image_url = COS_BUCKET_URL+path
                    display_result.append({"image_url": image_url, "details": details})
            except Exception as e:
                    print(e)
                    display_result = "Image or data not found: " + str(e)
        return display_result
    else:
        print("Connection failed with milvus")
        return "Connection with milvus failed"
