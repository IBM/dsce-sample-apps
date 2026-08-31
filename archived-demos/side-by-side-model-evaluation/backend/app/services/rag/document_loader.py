import os
import logging

from services.services_factory import ServicesFactory
from models.rag_model import LoadSelectionEnum, RagConfig

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class DocumentLoader:
    def __init__(self, loadSelectionType: LoadSelectionEnum = LoadSelectionEnum.load_all) -> None:   
        self.loadSelectionType: LoadSelectionEnum = loadSelectionType
        logger.debug(f"Inside DocumentLoader.init, loadSelectionType: {self.loadSelectionType}")         

    async def load(self, ragConfig: RagConfig, saveFolder=None, files = None):
        logger.debug(f"Inside DocumentLoader.load, ragConfig: {ragConfig}, saveFolder: {saveFolder}  ") 
        # loader_type = ragConfig['loader']
        # print(f"\n\nloader_type: >> {loader_type}\n\n")
        loader_Service = ServicesFactory.get_loader_service(ragConfig['loader'])
        nodes = await loader_Service.load_documents(ragConfig=ragConfig, saveFolder=saveFolder, files = files, loadSelectionType=self.loadSelectionType)
        return nodes
    
    
    