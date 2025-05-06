from typing import Any, Iterable, Protocol, Sequence, runtime_checkable
import uuid
import copy
from pydantic import BaseModel

from llama_index.core.schema import Document as LIDocument
from llama_index.core.node_parser import NodeParser

from docling_core.transforms.chunker import BaseChunker, HierarchicalChunker
from docling_core.types import DoclingDocument as DLDocument
from llama_index.core import Document as LIDocument
from llama_index.core.node_parser import NodeParser
from llama_index.core.schema import (
    BaseNode,
    NodeRelationship,
    RelatedNodeType,
    TextNode,
)
from llama_index.core.utils import get_tqdm_iterable

from llama_index.core.node_parser import (
    SentenceSplitter
)

class ChunkConfig(BaseModel):   
    split_at: str
    chunk_size: int
    chunk_overlap: int 
    
    def __init__(self, chunk_size: int, chunk_overlap: int, split_at: str = "HEADER"):
        super().__init__(chunk_size=chunk_size, chunk_overlap=chunk_overlap, split_at=split_at)
        self.split_at = split_at
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap  

class CustomNodeParser(NodeParser):
    """Docling format node parser.

    Splits the JSON format of `DoclingReader` into nodes corresponding
    to respective document elements from Docling's data model
    (paragraphs, headings, tables etc.).

    Args:
        chunker (BaseChunker, optional): The chunker to use. Defaults to `HierarchicalChunker()`.
        id_func(NodeIDGenCallable, optional): The node ID generation function to use. Defaults to `_uuid4_node_id_gen`.
    """

    @runtime_checkable
    class NodeIDGenCallable(Protocol):
        def __call__(self, i: int, node: BaseNode) -> str:
            ...

    @staticmethod
    def _uuid4_node_id_gen(i: int, node: BaseNode) -> str:
        return str(uuid.uuid4())

    chunker: BaseChunker = HierarchicalChunker()
    id_func: NodeIDGenCallable = _uuid4_node_id_gen
    chunk_config: ChunkConfig = ChunkConfig(chunk_size=512, chunk_overlap=30)

    def _split_by_header(self, chunks):
        updated_chunks = []
        for ix, chunk in enumerate(chunks):
            if len(chunk.text) < 7:
                ## We dont need very small text nodes (like page numbers etc.)
                # print(f"REMOVING CHUNK AS THE TEXT SIZE IS VERY SMALL: {chunk.text}")
                continue 

            if len(updated_chunks) > 0:
                previousChunk = updated_chunks.pop()
                
                if previousChunk.meta.headings == chunk.meta.headings and previousChunk.text and chunk.text:
                    if 'NO PICTURE METADATA' in previousChunk.text:
                        previousChunk.text = previousChunk.text.replace('NO PICTURE METADATA', '<--  IMAGE -->')                       
                    
                    previousChunk.text = f"{previousChunk.text}\n\n{chunk.text}"
                    
                    if previousChunk.meta.doc_items and chunk.meta.doc_items:
                        previousChunk.meta.doc_items.extend(chunk.meta.doc_items)
                    if previousChunk.meta.captions and chunk.meta.captions:
                        previousChunk.meta.captions.extend(chunk.meta.captions)
                    if previousChunk.meta.node_type == "TableItem" or chunk.meta.node_type == "TableItem":
                        previousChunk.meta.node_type = "TableItem"
                        
                    updated_chunks.append(previousChunk)
                    # print(f"## CHUNKS MERGED, new text length: {len(previousChunk.text)}, Headings: {previousChunk.meta.headings}\n")
                else:
                    updated_chunks.append(previousChunk)
                    updated_chunks.append(chunk)
            else:
                updated_chunks.append(chunk)
           
        return updated_chunks

    def _split_or_merge(self, chunks):

        text_splitter = SentenceSplitter(
            # separator=" ",
            chunk_size=self.chunk_config.chunk_size,
            chunk_overlap=self.chunk_config.chunk_overlap,
            # paragraph_separator="\n\n\n",
            # secondary_chunking_regex="[^,.;。]+[,.;。]?"
        )

        updated_chunks = []
        for ix, chunk in enumerate(chunks):
            if chunk.text and len(chunk.text) <= self.chunk_config.chunk_size:
                    # if len(chunk.text) < 7:
                    #     ## We dont need very small text nodes (like page numbers etc.)
                    #     # print(f"REMOVING CHUNK AS THE TEXT SIZE IS VERY SMALL: {chunk.text}")
                    #     continue 

                    # if len(updated_chunks) > 0:
                    #     previousChunk = updated_chunks.pop()
                    #     # if previousChunk.meta.headings == chunk.meta.headings and previousChunk.text and chunk.text and (len(previousChunk.text) + len(chunk.text)) < self.chunk_config.chunk_size:
                    #     if previousChunk.text and chunk.text and (len(previousChunk.text) + len(chunk.text)) < self.chunk_config.chunk_size:
                    #         # pprint(previousChunk, max_length=10, max_string=50, max_depth=4)
                    #         # print(f"IN LOGIC TO MERGE CHUNKS, previousChunk length: {len(previousChunk.text)}, current chunk length: {len(chunk.text)}")
                    #         if 'NO PICTURE METADATA' in previousChunk.text:
                    #             # previousChunk.text = f"{chunk.text}"
                    #             previousChunk.meta.node_type = "PictureItem"
                    #             previousChunk.text = previousChunk.text.replace('NO PICTURE METADATA', '<--  IMAGE -->')
                    #             previousChunk.text = f"{previousChunk.text}\n\n{chunk.text}"
                    #         else:
                    #             previousChunk.text = f"{previousChunk.text}\n\n{chunk.text}"
                    #             # print(f"CHUNKS MERGED, Length now: {len(previousChunk.text)}")
                    #         if previousChunk.meta.doc_items and chunk.meta.doc_items:
                    #             previousChunk.meta.doc_items.extend(chunk.meta.doc_items)
                    #         if previousChunk.meta.captions and chunk.meta.captions:
                    #             previousChunk.meta.captions.extend(chunk.meta.captions)
                    #         if previousChunk.meta.node_type == "TableItem" or chunk.meta.node_type == "TableItem":
                    #             previousChunk.meta.node_type = "TableItem"
                    #         updated_chunks.append(previousChunk)
                    #         # print(f"## CHUNKS MERGED, new text length: {len(previousChunk.text)}, Headings: {previousChunk.meta.headings}\n")
                    #     else:
                    #         updated_chunks.append(previousChunk)
                    #         updated_chunks.append(chunk)                        
                    # else:
                    updated_chunks.append(chunk)
            else:
                # print(f"LOGIC FOR SPLITTING TEXT, length: {len(chunk.text)} ")
                if chunk.meta.node_type == "TableItem":
                    #Do not chunk if TableItem
                    # if chunk.meta.doc_items[0].prov[0].page_no == 97 or chunk.meta.doc_items[0].prov[0].page_no == 98:
                    #     print(f"\n\nPage: {chunk.meta.doc_items[0].prov[0].page_no}: \n{chunk.text}\n")
                    updated_chunks.append(chunk)
                else:
                    texts = text_splitter.split_text(chunk.text)
                    if len(texts) > 1:
                        for ix, text in enumerate(texts):
                            newNode = copy.deepcopy(chunk)
                            newNode.text = text                        
                            updated_chunks.append(newNode)
                            # print(f"\nAFTER SPLIT TEXT LENGTH: {ix}) {len(text)}, Original text length: {len(chunk.text)}\n")
                    else:
                        updated_chunks.append(chunk)
        return updated_chunks

    def _parse_nodes(
        self,
        nodes: Sequence[BaseNode],
        show_progress: bool = False,
        **kwargs: Any,
    ) -> list[BaseNode]:
        nodes_with_progress: Iterable[BaseNode] = get_tqdm_iterable(
            items=nodes, show_progress=show_progress, desc="Parsing nodes"
        )
        all_nodes: list[BaseNode] = []
        for input_node in nodes_with_progress:
            li_doc = LIDocument.model_validate(input_node)
            dl_doc: DLDocument = DLDocument.model_validate_json(li_doc.get_content())
            chunk_iter = self.chunker.chunk(dl_doc=dl_doc)

            if self.chunk_config.split_at == 'HEADER':
                updated_chunks = self._split_by_header(chunk_iter)    
                updated_chunks = self._split_or_merge(copy.deepcopy(updated_chunks))
                # print(f"\n\nUPDATED CHUNKS SIZE AFTER split_at=HEADER and _split_or_merge is {len(updated_chunks)}\n\n")
            else:
                updated_chunks = self._split_or_merge(chunk_iter)
            
            print(f"\n\nUPDATED CHUNKS SIZE: {len(updated_chunks)}\n\n")
            for i, chunk in enumerate(updated_chunks):
                
                rels: dict[NodeRelationship, RelatedNodeType] = {
                    NodeRelationship.SOURCE: li_doc.as_related_node_info(),
                }
                metadata = chunk.meta.export_json_dict()
                excl_embed_keys = [
                    k for k in chunk.meta.excluded_embed if k in metadata
                ]
                excl_llm_keys = [k for k in chunk.meta.excluded_llm if k in metadata]

                header = None
                if 'headings' in chunk.meta or chunk.meta.headings:
                    header = " >> ".join(chunk.meta.headings)
                    chunk.text = f"### {header}\n\n{chunk.text}"
               
                node = TextNode(
                    id_=self.id_func(i=i, node=li_doc),
                    text=chunk.text,
                    excluded_embed_metadata_keys=excl_embed_keys,
                    excluded_llm_metadata_keys=excl_llm_keys,
                    relationships=rels,
                )
                node.metadata = metadata
                all_nodes.append(node)
        return all_nodes
        