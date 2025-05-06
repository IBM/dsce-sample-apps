
import logging
from core.log_config import init_loggers
import numpy as np
from numpy.linalg import norm

import spacy
nlp = spacy.load('en_core_web_sm')

from langchain.docstore.document import Document

init_loggers(__name__)
logger = logging.getLogger(__name__) 

class Sentence(object):
    text: str
    vector: float
    vector_norm: float

class ClusteringAdjacentSentencesSplitter(object):
    def __init__(self, min_cluster_len=512, max_cluster_len=3000) -> None:
        logger.info(f"--------- INIT ClusteringAdjacentSentencesSplitter ----------min_cluster_len: {min_cluster_len}, max_cluster_len: {max_cluster_len}")
        self.min_cluster_len = min_cluster_len
        self.max_cluster_len = max_cluster_len

    def split_documents(self, documents):
        docs = []
        for document in documents:
            text = document.page_content
            if text and len(text) > 5:
                chunks = self.__chunk_text(text)
                for chunk in chunks:
                    chunked_doc = Document(page_content = chunk, metadata=document.metadata)
                    docs.append(chunked_doc)
            else:
                logger.info(f"IN ClusteringAdjacentSentencesSplitter.split_documents, NO PAGE_CONTENT in document: {document}")

        return docs
    
    # SPACY IMPLEMENTATION
    def __process(self, text):
        doc = nlp(text)
        sents = list(doc.sents)
        # for sent in sents:
        #     print(f"\n\nvector: {sent.vector}, vector_norm: {sent.vector_norm}")
        vecs = np.stack([sent.vector / sent.vector_norm for sent in sents])
        return sents, vecs
    
    # NLTK IMPLEMENTATION
    # def __process2(self, text):       
    #     sentences = nltk.sent_tokenize(text)
    #     # Create a dictionary of vectors for each sentence
    #     sents = []
    #     # vectors = {}
    #     for sentence in sentences:
    #         sent: Sentence = Sentence()
    #         tokens = nltk.word_tokenize(sentence)
    #         vector = [0] * len(tokens)
    #         for token in tokens:
    #             vector[tokens.index(token)] += 1

    #         vector = [len(word) for word in sentence.split()]
    #         vector_norm = norm(vector, 1)
    #         # vector_norm = sum([x**2 for x in vector])                
    #         sent.text = sentence
    #         sent.vector = vector
    #         sent.vector_norm = vector_norm
    #         sents.append(sent)
       
    #     vecs = np.array([sent.vector / sent.vector_norm for sent in sents], dtype=object)   
    #     print(vecs)   
    #     # vecs = np.stack([sent.vector_norm for sent in sents])
    #     return sents, vecs

    def __cluster_text(self, sents, vecs, threshold):
        clusters = [[0]]
        for i in range(1, len(sents)):
            if np.dot(vecs[i], vecs[i-1]) < threshold:
                clusters.append([])
            clusters[-1].append(i)
        
        return clusters

    def __clean_text(self, text):
        # Add your text cleaning process here
        return text
    
    def __chunk_text(self, text):
        # Initialize the clusters lengths list and final texts list
        clusters_lens = []
        final_texts = []
        threshold = 0.2
        sents, vecs = self.__process(text)
        
        # Cluster the sentences
        clusters = self.__cluster_text(sents, vecs, threshold)
        
        for cluster in clusters:
            cluster_txt = self.__clean_text(' '.join([sents[i].text for i in cluster]))
            cluster_len = len(cluster_txt)
            
            # Check if the cluster is too short
            if cluster_len < self.min_cluster_len:
                continue
            
            # Check if the cluster is too long
            elif cluster_len > self.max_cluster_len:
                threshold = 0.5
                sents_div, vecs_div = self.__process(cluster_txt)
                reclusters = self.__cluster_text(sents_div, vecs_div, threshold)
                
                for subcluster in reclusters:
                    div_txt = self.__clean_text(' '.join([sents_div[i].text for i in subcluster]))
                    div_len = len(div_txt)
                    
                    if div_len < self.min_cluster_len or div_len > self.max_cluster_len:
                        continue
                    
                    clusters_lens.append(div_len)
                    final_texts.append(div_txt)
                    
            else:
                clusters_lens.append(cluster_len)
                final_texts.append(cluster_txt)
        
        return final_texts