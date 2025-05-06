
import os
# import datetime
import time
import copy
# import yaml
import json
import pandas as pd
from pathlib import Path
# import pandas as pd
import logging
from warnings import filterwarnings
# from pydantic import Field
from typing import Iterable
from rich.pretty import pprint

from services.services_factory import ServicesFactory
from services.rag.docling.custom_chunker import CustomHierarchicalChunker
from services.rag.docling.custom_node_parser import ChunkConfig, CustomNodeParser
from models.rag_model import LoadSelectionEnum, RagConfig, TextSplitterEnum
from services.utils import CommonUtils

import uuid
from llama_index.core import Document as LIDocument

from docling_core.types.doc.document import DoclingDocument as DLDocument
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import ConversionStatus
from docling.datamodel.document import ConversionResult
# from docling.datamodel.settings import settings

# import uuid
# from llama_index.core import Document as LIDocument
from llama_index.readers.docling import DoclingReader
from llama_index.node_parser.docling import DoclingNodeParser

from core.log_config import init_loggers

filterwarnings(action="ignore", category=UserWarning, module="pydantic")
filterwarnings(action="ignore", category=FutureWarning, module="easyocr")
os.environ["TOKENIZERS_PARALLELISM"] = "false"

init_loggers(__name__)
logger = logging.getLogger(__name__) 

# @singleton
class DoclingService:

    IMAGE_RESOLUTION_SCALE = 2.0
    USE_V2 = True
    USE_LEGACY = False
     
    def __init__(self) -> None:
        self.utils: CommonUtils = CommonUtils()
        logger.info(f"Inside DoclingService: >>>>>>>>>>> ")

    # def _uuid4_doc_id_gen(doc: DLDocument, file_path: str | Path) -> str:
    #     return str(uuid.uuid4())

    async def load_documents(self, ragConfig: RagConfig, saveFolder=None, files = None, loadSelectionType: LoadSelectionEnum = LoadSelectionEnum.load_all):
        try:
            PARQUET_DIR_PATH = self.utils.getFromCache("TEMP_DIR") + "/parquet_dir"
            input_doc_paths = []
            if files is not None:
                for file_path in files:
                    # input_doc_paths.append(Path(file_path))
                    input_doc_paths.append(file_path)
            elif saveFolder is not None:
                files = self.utils.get_file_paths(saveFolder)
                for file_path in files:
                    # input_doc_paths.append(Path(file_path))
                    input_doc_paths.append(file_path)
                

            # Docling Parse with EasyOCR
            # ----------------------
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = ragConfig['do_ocr']
            # pipeline_options.do_ocr = True
            pipeline_options.do_table_structure = ragConfig['do_table_structure']
            pipeline_options.table_structure_options.do_cell_matching = ragConfig['do_cell_matching']
            logger.info(f"\n\nIN load_documents, do_ocr: {ragConfig['do_ocr']}, do_table_structure: {ragConfig['do_table_structure']}, do_cell_matching: {ragConfig['do_cell_matching']}\n\n")
           
            doc_converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                }
            )
            # doc_converter: DocumentConverter = Field(default_factory=DocumentConverter)
            # reader = DoclingReader(export_type=DoclingReader.ExportType.JSON, doc_converter=doc_converter)
            # documents=reader.load_data(input_doc_paths)

            start_time = time.time()
            conv_results = doc_converter.convert_all(
                input_doc_paths,
                raises_on_error=False,  # to let conversion run through all and examine results at the end
            )
            # PARQUET_DIR_PATH = self.utils.getFromCache("DATASET_DIR") + "/parquet_dir"
            collection_name =  ragConfig["vectordb_config"]["collection_name"]  
            parquet_file_path, failure_count = self.export_documents(
                conv_results, output_dir=Path(PARQUET_DIR_PATH),
                doc_filename=collection_name
            )
            end_time = time.time() - start_time
            logger.info(f"\n\nDocument conversion completed in {end_time:.2f} seconds.\n\n")
            if failure_count > 0:
                raise RuntimeError(
                    f"The example failed converting {failure_count} on {len(input_doc_paths)}."
                )
            
            # parquet_file_path = f"{PARQUET_DIR_PATH}/IBM_Annual_Report_2022.parquet"
            dl_object = self.read_parquet(parquet_file_path)
            pprint(dl_object, max_length=1, max_string=50, max_depth=4)
            li_documents = self.convert_to_LIDocuments(dl_object)
            chunked_nodes = await self.parse_documents(li_documents, ragConfig=ragConfig)
            return chunked_nodes
        except Exception as err:
            logger.error(err)
            raise err
        
    def convert_to_LIDocuments(self, dl_object: DLDocument):
        def _uuid4_doc_id_gen(doc: DLDocument, file_path: str | Path) -> str:
            return str(uuid.uuid4())

        copied_dl_obj = copy.deepcopy(dl_object)
        extra_info = None
        # SOURCE = f"{self.utils.getFromCache("DATASET_DIR")}/"
        SOURCE = copied_dl_obj.origin.filename
        text = json.dumps(copied_dl_obj.export_to_dict())
        li_doc = LIDocument(
                        doc_id=_uuid4_doc_id_gen(doc=copied_dl_obj, file_path=SOURCE),
                        text=text,
                    )
        li_doc.metadata = extra_info or {}
        return [li_doc]

    async def parse_documents(self, li_docs, ragConfig):
        if ragConfig["splitter"] == TextSplitterEnum.CustomHierarchicalChunker.value:
            chunk_config: ChunkConfig = ChunkConfig(chunk_size=ragConfig['chunk_size'], chunk_overlap=ragConfig['chunk_overlap'], split_at=ragConfig['split_at'])
            node_parser = CustomNodeParser(node_meta_keys_allowed={"heading"}, chunker=CustomHierarchicalChunker(), chunk_config=chunk_config)
            logger.info(f"\n\n USING CUSTOM NODE PARSER, with chunk_config: {chunk_config} \n\n")
        else:
            node_parser = DoclingNodeParser(node_meta_keys_allowed={"heading"})
        
        nodes = node_parser.get_nodes_from_documents(li_docs)
        logger.info(f"\n\nInside DoclingService.load_documents: >> size of parsed_nodes:  {len(nodes)}\n\n")
        # ragConfig['splitter'] = TextSplitterEnum.SentenceSplitter.value
        # chunked_nodes = await ServicesFactory.get_llamaindex_service().split_documents(nodes, ragConfig=ragConfig)
        return nodes    

    def export_documents(self,
        conv_results: Iterable[ConversionResult],
        output_dir: Path,
        doc_filename: str = None
    ):
        output_dir.mkdir(parents=True, exist_ok=True)

        success_count = 0
        failure_count = 0
        partial_success_count = 0
        parquet_file_path = None
        cos = ServicesFactory.get_cos_service()
        for conv_res in conv_results:
            if conv_res.status == ConversionStatus.SUCCESS:
                success_count += 1
                if doc_filename is None:
                    doc_filename = conv_res.input.file.stem

                if self.USE_V2:
                    # Export Docling document format to JSON:
                    # with (output_dir / f"{doc_filename}.json").open("w") as fp:
                    #     dl_dict = conv_res.document.export_to_dict()
                    #     jsonObj = json.dumps(dl_dict)
                    #     fp.write(jsonObj)
                    dl_dict = conv_res.document.export_to_dict()
                    jsonObj = json.dumps(dl_dict)

                    # jsonStr = dl_doc.model_dump_json()
                    # jsonObj = json.loads(jsonStr)
                    df = pd.DataFrame.from_dict([jsonObj])
                    # df.head()   
                    
                    parquet_file_path = output_dir / f"{doc_filename}.parquet"
                    df.to_parquet(parquet_file_path)

                    with open(parquet_file_path, 'rb') as f:
                        binary_data: bytes = f.read()
                    
                    if binary_data is not None:
                        cos.upload_file(file_key=f"{doc_filename}.parquet", file_content=binary_data, REPLACE=True)
                        f.close()

                    # # Export Docling document format to YAML:
                    # with (output_dir / f"{doc_filename}.yaml").open("w") as fp:
                    #     fp.write(yaml.safe_dump(conv_res.document.export_to_dict()))

                    # # Export Docling document format to doctags:
                    # with (output_dir / f"{doc_filename}.doctags.txt").open("w") as fp:
                    #     fp.write(conv_res.document.export_to_document_tokens())

                    # # Export Docling document format to markdown:
                    # with (output_dir / f"{doc_filename}.md").open("w") as fp:
                    #     fp.write(conv_res.document.export_to_markdown())

                    # # Export Docling document format to text:
                    # with (output_dir / f"{doc_filename}.txt").open("w") as fp:
                    #     fp.write(conv_res.document.export_to_markdown(strict_text=True))

                if self.USE_LEGACY:
                    # Export Deep Search document JSON format:
                    with (output_dir / f"{doc_filename}.legacy.json").open(
                        "w", encoding="utf-8"
                    ) as fp:
                        fp.write(json.dumps(conv_res.legacy_document.export_to_dict()))

                    # Export Text format:
                    with (output_dir / f"{doc_filename}.legacy.txt").open(
                        "w", encoding="utf-8"
                    ) as fp:
                        fp.write(
                            conv_res.legacy_document.export_to_markdown(strict_text=True)
                        )

                    # Export Markdown format:
                    with (output_dir / f"{doc_filename}.legacy.md").open(
                        "w", encoding="utf-8"
                    ) as fp:
                        fp.write(conv_res.legacy_document.export_to_markdown())

                    # Export Document Tags format:
                    with (output_dir / f"{doc_filename}.legacy.doctags.txt").open(
                        "w", encoding="utf-8"
                    ) as fp:
                        fp.write(conv_res.legacy_document.export_to_document_tokens())

            elif conv_res.status == ConversionStatus.PARTIAL_SUCCESS:
                logger.info(
                    f"Document {conv_res.input.file} was partially converted with the following errors:"
                )
                for item in conv_res.errors:
                    logger.info(f"\t{item.error_message}")
                partial_success_count += 1
            else:
                logger.info(f"Document {conv_res.input.file} failed to convert.")
                failure_count += 1

        logger.info(
            f"Processed {success_count + partial_success_count + failure_count} docs, "
            f"of which {failure_count} failed "
            f"and {partial_success_count} were partially converted."
        )
        return parquet_file_path, failure_count

        # pprint(docs, max_length=1, max_string=50, max_depth=4)
    
    def read_parquet(self, file_path):
        logger.info(f"IN read_parquet, file_path: {file_path}")
        document_content_df = pd.read_parquet(file_path)
        tempStr: str = document_content_df.to_json(orient='records')
        tempObj = json.loads(tempStr)
        jsonString = json.dumps(tempObj[0]["0"])
        jsonObj = json.loads(jsonString)
        # print(jsonObj)
        # pprint(jsonObj, max_length=5, max_string=50, max_depth=4)       
        dl_output: DLDocument = DLDocument.model_validate_json(jsonObj)    
        return dl_output