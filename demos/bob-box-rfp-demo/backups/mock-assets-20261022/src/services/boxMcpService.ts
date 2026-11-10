import { BoxDocument, Finding, DocumentExcerpt } from '../types';
import { SYNTHETIC_BOX_DOCUMENTS } from '../data/syntheticDocuments';
import { SYNTHETIC_FINDINGS } from '../data/syntheticFindings';

/**
 * Common abstraction for Box Content retrieval via Model Context Protocol (MCP).
 * This interface defines the contract that both the Mock Provider and future
 * Live Box MCP Provider will fulfill.
 */
export interface BoxMcpProvider {
  /**
   * Search Box workspace for customer documents matching query or filters
   */
  searchContent(query: string, folder?: string): Promise<BoxDocument[]>;

  /**
   * Retrieve list of all relevant documents in the workspace
   */
  getAllDocuments(): Promise<BoxDocument[]>;

  /**
   * Retrieve single document by Box ID
   */
  getDocumentById(id: string): Promise<BoxDocument | undefined>;

  /**
   * Retrieve extracted findings backed by Box evidence
   */
  getExtractedFindings(): Promise<Finding[]>;

  /**
   * Retrieve specific excerpts for a document or finding
   */
  getExcerptsForFinding(findingId: string): Promise<DocumentExcerpt[]>;

  /**
   * Simulate or open item in Box
   */
  getItemUrl(docId: string): string;

  /**
   * Provider mode indicator
   */
  getProviderMode(): 'mock' | 'live_mcp';
}

/**
 * Mock Box MCP Provider implementation.
 * Uses structured synthetic Acme Corp documentation to deliver deterministic,
 * high-speed, offline-safe demo experiences.
 */
export class MockBoxMcpProvider implements BoxMcpProvider {
  private documents: BoxDocument[] = SYNTHETIC_BOX_DOCUMENTS;
  private findings: Finding[] = SYNTHETIC_FINDINGS;

  async searchContent(query: string, folder?: string): Promise<BoxDocument[]> {
    const q = query.toLowerCase().trim();
    return this.documents.filter(doc => {
      const matchesFolder = folder ? doc.folderPath.toLowerCase().includes(folder.toLowerCase()) : true;
      const matchesQuery = !q || 
        doc.name.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.fullContent.toLowerCase().includes(q) ||
        doc.metadata.tags.some(t => t.toLowerCase().includes(q));
      return matchesFolder && matchesQuery;
    });
  }

  async getAllDocuments(): Promise<BoxDocument[]> {
    return [...this.documents];
  }

  async getDocumentById(id: string): Promise<BoxDocument | undefined> {
    return this.documents.find(doc => doc.id === id || doc.metadata.boxFileId === id);
  }

  async getExtractedFindings(): Promise<Finding[]> {
    return [...this.findings];
  }

  async getExcerptsForFinding(findingId: string): Promise<DocumentExcerpt[]> {
    const finding = this.findings.find(f => f.id === findingId);
    return finding ? finding.excerpts : [];
  }

  getItemUrl(docId: string): string {
    const doc = this.documents.find(d => d.id === docId);
    return doc ? `https://acme.app.box.com/file/${doc.metadata.boxFileId}` : `https://app.box.com`;
  }

  getProviderMode(): 'mock' | 'live_mcp' {
    return 'mock';
  }
}

/**
 * Live Box MCP Provider Stub.
 * When integrating with a live Box MCP server, replace the methods below
 * with actual MCP tool calls (e.g., mcp__box__search, mcp__box__get_file_content).
 */
export class LiveBoxMcpProviderStub implements BoxMcpProvider {
  private endpointUrl: string;

  constructor(endpoint?: string) {
    this.endpointUrl = endpoint || 'http://127.0.0.1:8080/mcp';
  }

  getEndpoint(): string {
    return this.endpointUrl;
  }

  async searchContent(_query: string, _folder?: string): Promise<BoxDocument[]> {
    throw new Error('Live Box MCP connection not configured. Use MockBoxMcpProvider for demo mode.');
  }

  async getAllDocuments(): Promise<BoxDocument[]> {
    throw new Error('Live Box MCP connection not configured.');
  }

  async getDocumentById(_id: string): Promise<BoxDocument | undefined> {
    throw new Error('Live Box MCP connection not configured.');
  }

  async getExtractedFindings(): Promise<Finding[]> {
    throw new Error('Live Box MCP connection not configured.');
  }

  async getExcerptsForFinding(_findingId: string): Promise<DocumentExcerpt[]> {
    throw new Error('Live Box MCP connection not configured.');
  }

  getItemUrl(docId: string): string {
    return `https://app.box.com/file/${docId}`;
  }

  getProviderMode(): 'live_mcp' {
    return 'live_mcp';
  }
}

// Singleton active instance default to Mock provider
export const boxMcpService: BoxMcpProvider = new MockBoxMcpProvider();
