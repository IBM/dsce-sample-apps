
import os
import shutil
from typing import Dict
# from uuid import UUID
import uuid

from pathlib import Path
from subprocess import call
import json
import glob
import stat
import pickledb
from tempfile import TemporaryDirectory
# import event_emitter as events
from models.common import Audit, Task

class FileUploader:
    def __init__(self, fileList, saveFolder) -> None:
        self.fileList = fileList
        self.saveFolder = saveFolder
    
    async def saveFiles(self):
        savedFiles = []
        for _file in self.fileList:
            fileContent: bytes = await _file.read()
            save_path = Path(self.saveFolder, _file.filename)
            with open(save_path, mode='wb') as w:
                w.write(fileContent)
            savedFiles.append(save_path)
            print(f"File Saved Locally: {save_path}")

        return savedFiles

def singleton(cls):
    instances = dict()

    def __new__(klass, *args, **kwargs):
        klass_path = klass.__module__ + '.' + klass.__name__
        instance = instances.get(klass_path, None)
        if instance is not None:
            return instance

        attributes = dict(klass.__dict__)
        attributes.pop('__new__')

        klass = type(klass.__name__, klass.__bases__, attributes)
        instances[klass_path] = klass(*args, **kwargs)
        return instances[klass_path]

    cls.__new__ = __new__
    return cls
@singleton
class CommonUtils():
    # def __new__(cls):
    #     if not hasattr(cls, 'instance'):
    #         cls.instance = super(CommonUtils, cls).__new__(cls)
    #     return cls.instance

    def __init__(self) -> None:
        """ Initialize CommonUtils """
        self.cache = {
            'UPDATES': False,
            'CONFIG': {}
        }

        self.user_cache = {
            'vector_store': None,
            'vector_index': None,
            'embed_model': None
        }
        
        self.db = None
        # self.em = events.EventEmitter()
        # print(f"\n\n-----CommonUtils Initialized with cache >> {self.cache}---------\n\n")

    def setup_localdb(self):
        DATASET_DIR = os.environ.get("DATASET_DIR")
        self.db = pickledb.load(DATASET_DIR+'/local.db', False)

    def setInDB(self, key, value):
        if self.db is not None:
            self.db.set(key, value)

    def getFromDB(self, key):
        result = None
        try:
            if self.db is not None:
                value = self.db.get(key)
                if value:
                    result = value
            return result
        except KeyError as e:
            print(f"In CommonUtils.getFromDB KeyError: {key}")
            return None
        
    def setInCache(self, key, value):
        # print(f"In CommonUtils.setInCache, {key}: {value}")
        self.cache[key] = value

    def getFromCache(self, key):
        try:
            value = self.cache[key]            
            return value
        except KeyError as e:
            print(f"In CommonUtils.getFromCache KeyError: {key}")
            return None
        
    def setInUserCache(self, key, value):
        # print(f"In CommonUtils.setInCache, {key}: {value}")
        self.user_cache[key] = value

    def getFromUserCache(self, key):
        try:
            value = self.user_cache[key]  
            if value is None: 
                print(f"\n\n<<<<<<<<< IN UTILS.getFromUserCache, {key} is None>>>>>>>>>\n\n")         
            return value
        except KeyError as e:
            print(f"In CommonUtils.getFromUserCache KeyError: {key}")
            return None
    
    def getDefaultValue(self, key):
        CONFIG_DIR = self.cache['CONFIG']['CONFIG_DIR']
        with open(os.path.join(CONFIG_DIR,"llm-config.json"), "r") as config_file:
            data = json.load(config_file)   
            if key in data:
                return data[key]
            else:
                return None
            
    def checkDirectories(self):
        DATASET_DIR = os.environ.get("DATASET_DIR")
        VECTORDB_DIR = os.environ.get("VECTORDB_DIR")
        TEMP_DIR = (tmp_dir := TemporaryDirectory()).name
        # VECTORDB_DIR = os.path.join(VECTORDB_DIR, 'vectors')
        if not os.path.exists(DATASET_DIR):
            os.makedirs(DATASET_DIR)
            print(f"\n\n{DATASET_DIR} CREATED \n")
        if not os.path.exists(VECTORDB_DIR):
            os.makedirs(VECTORDB_DIR)
            print(f"\n\n{VECTORDB_DIR} CREATED \n")
        TEMP_DIR = os.environ.get('TEMP_DIR', TEMP_DIR)
        if not os.path.exists(TEMP_DIR):
            os.makedirs(TEMP_DIR)
            print(f"\n\n{TEMP_DIR} CREATED \n")
        else:
            print(f"\n\n{TEMP_DIR} ALREADY EXISTS \n")
        
        self.setInCache('DATASET_DIR', os.environ.get('DATASET_DIR', 'datasets'))
        self.setInCache('VECTORDB_DIR', os.environ.get('VECTORDB_DIR', 'vectors'))
        self.setInCache('TEMP_DIR', os.environ.get('TEMP_DIR', TEMP_DIR))
        # print(f"\n\nTEMP_DIR: {TEMP_DIR} \n")
       
    def upload_files(self, files, prefix: str = None):
        try:
            dataset_dir = self.getFromCache("DATASET_DIR")
            if prefix is not None:
                dataset_dir = f"{dataset_dir}/{prefix}"
            
            if not os.path.exists(dataset_dir):
                os.makedirs(dataset_dir)
            # dataset_dir = (tmp_dir := TemporaryDirectory()).name
            # temp_file_path = f"{(tmp_dir := TemporaryDirectory()).name}/{file_key}"        
            file_uploader_obj = FileUploader(files, saveFolder=dataset_dir)
            savedFiles = file_uploader_obj.saveFiles()
            return savedFiles
        except Exception as err:
            # print(err)
            raise err
            # pass

    def deleteDirectoryContent(self, directory_path, ignore="chroma"):
            for filename in glob.iglob(directory_path+"/**/*", recursive=True):
                try:
                    if ignore not in filename:
                        for root, dirs, files in os.walk(directory_path, topdown=False):
                            for file in files:
                                try:
                                    file_path = os.path.join(root, file)
                                    os.chmod(file_path, stat.S_IWUSR)
                                    os.remove(file_path)
                                except Exception as err: 
                                    print(err)
                                    pass
                            for dir in dirs:
                                try:
                                    dir_path = os.path.join(root, dir)
                                    os.rmdir(dir_path)
                                    # shutil.rmtree(dir_path)
                                    # os.system('rmdir "{}"'.format(dir_path))
                                    # call("rm -rf {}".format(dir_path), shell=True)
                                except Exception as err: 
                                    print(err)
                                    pass
                # os.rmdir(directory_path)
                except Exception as err: 
                    print(err)
                    pass

    def get_file_paths(self, directory, ignore="chroma"):
        file_paths = []
        for filename in glob.iglob(directory+"/**/*", recursive=True):
                try:
                    if ignore not in filename:
                        for root, dirs, files in os.walk(directory, topdown=False):
                            for file in files:
                               file_path = os.path.join(root, file)
                               file_paths.append(file_path)                            
                except Exception as err: 
                    print(err)
                    pass
        return file_paths
    
    def create_task(self, data, audit: Audit):
        task = Task()
        task.uid = str(uuid.uuid4())
        task.data = data
        task.audit = audit
        task.status = "IN_PROGRESS"
        tasks: Dict[str, Task] = self.getFromDB("TASKS")
        if tasks is None:
            tasks = {}
        tasks[task.uid] = task
        self.setInDB("TASKS", tasks)
        return task

    def get_all_tasks(self):
        tasks: Dict[str, Task] = self.getFromDB("TASKS")
        return tasks
    
    def get_task(self, task_id):
        tasks: Dict[str, Task] = self.getFromDB("TASKS")
        if tasks is None:
            return None
        task = tasks[task_id]
        return task
    
    def update_task(self, task: Task):
        tasks: Dict[str, Task] = self.getFromDB("TASKS")
        if tasks is None:
            return None
        tasks[task.uid] = task

    def delete_task(self, task_id):
        tasks: Dict[str, Task] = self.getFromDB("TASKS")
        if tasks is None:
            return None
        del tasks[task_id]
        return tasks

    # def emit_event(self, name: str, data: object):
    #     print(f"IN emit_event: {name} with data: {data}")
    #     self.em.emit(name, data=data)

    # def subscribe(self, name: str, func):
    #     self.em.on(name, func)



