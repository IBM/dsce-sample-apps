import { BoxDocument, Finding, DocumentExcerpt, FileType } from '../types';
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

interface LiveBoxFileRecord {
  boxFileId: string;
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string | null;
  ownerName: string;
  folderPath: string;
  content: string;
}

const FILE_TYPES: FileType[] = ['docx', 'xlsx', 'pdf', 'pptx', 'email'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Live Box MCP Provider.
 * Reads the Box_Upload_Folder tree from the user's Box account through the official Box MCP
 * server (https://mcp.box.com). The browser calls the local `/api/box/documents` route
 * (see vite.config.ts) so the Box token never leaves the server.
 *
 * Live data: file name, folder path, size, owner, modified date, Box file ID and full text.
 * Retained from the curated layer (matched by file name): summary, tags and the
 * document-to-finding links, so existing findings and evidence still resolve.
 */
export class LiveBoxMcpProvider implements BoxMcpProvider {
  private documents: BoxDocument[] | null = null;

  /** Clears the document cache so the next call to load() re-fetches from Box. */
  reset(): void {
    this.documents = null;
  }
  private findings: Finding[] = SYNTHETIC_FINDINGS;

  private async load(): Promise<BoxDocument[]> {
    if (this.documents) return this.documents;

    const res = await fetch('/api/box/documents');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Box request failed (${res.status})`);
    }
    const { documents: records } = (await res.json()) as { documents: LiveBoxFileRecord[] };

    const curatedByName = new Map(SYNTHETIC_BOX_DOCUMENTS.map(d => [d.name, d]));
    this.documents = records.map((rec, i): BoxDocument => {
      const curated = curatedByName.get(rec.name);
      const ext = rec.extension.toLowerCase();
      return {
        id: curated?.id ?? `box-live-${i + 1}`,
        name: rec.name,
        type: (FILE_TYPES as string[]).includes(ext) ? (ext as FileType) : 'docx',
        size: formatBytes(rec.sizeBytes),
        modifiedAt: rec.modifiedAt ?? new Date().toISOString(),
        owner: { name: rec.ownerName, role: curated?.owner.role ?? 'Box Owner' },
        folderPath: rec.folderPath,
        summary: curated?.summary ?? rec.content.slice(0, 160).replace(/\s+/g, ' ').trim(),
        excerptCount: curated?.excerptCount ?? 0,
        supportedFindingIds: curated?.supportedFindingIds ?? [],
        fullContent: rec.content,
        metadata: {
          tags: curated?.metadata.tags ?? [],
          classification: curated?.metadata.classification ?? 'Unclassified',
          department: curated?.metadata.department ?? 'Unassigned',
          lastSynced: 'Just now via live Box MCP',
          boxFileId: rec.boxFileId,
        },
      };
    });
    return this.documents;
  }

  async searchContent(query: string, folder?: string): Promise<BoxDocument[]> {
    const q = query.toLowerCase().trim();
    return (await this.load()).filter(doc => {
      const matchesFolder = folder ? doc.folderPath.toLowerCase().includes(folder.toLowerCase()) : true;
      const matchesQuery = !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.fullContent.toLowerCase().includes(q);
      return matchesFolder && matchesQuery;
    });
  }

  async getAllDocuments(): Promise<BoxDocument[]> {
    return [...(await this.load())];
  }

  async getDocumentById(id: string): Promise<BoxDocument | undefined> {
    return (await this.load()).find(doc => doc.id === id || doc.metadata.boxFileId === id);
  }

  async getExtractedFindings(): Promise<Finding[]> {
    return [...this.findings];
  }

  async getExcerptsForFinding(findingId: string): Promise<DocumentExcerpt[]> {
    return this.findings.find(f => f.id === findingId)?.excerpts ?? [];
  }

  getItemUrl(docId: string): string {
    const doc = this.documents?.find(d => d.id === docId);
    return doc ? `https://app.box.com/file/${doc.metadata.boxFileId}` : 'https://app.box.com';
  }

  getProviderMode(): 'live_mcp' {
    return 'live_mcp';
  }
}

const mockProvider = new MockBoxMcpProvider();
const liveProvider = new LiveBoxMcpProvider();

/**
 * Clears the live provider's document cache so the next loadBoxWorkspace() call
 * re-fetches fresh data from Box. Call this at the start of each new preparation run.
 */
export function resetBoxWorkspaceCache(): void {
  liveProvider.reset();
}

/**
 * Loads documents + findings from live Box, falling back to the mock provider if Box is
 * unreachable (e.g. expired developer token) so the demo never breaks on stage.
 * Use `?source=mock` in the URL to force the mock provider.
 */
export async function loadBoxWorkspace(): Promise<{
  documents: BoxDocument[];
  findings: Finding[];
  mode: 'mock' | 'live_mcp';
  error?: string;
}> {
  const forceMock = new URLSearchParams(window.location.search).get('source') === 'mock';
  if (!forceMock) {
    try {
      const documents = await liveProvider.getAllDocuments();
      const findings = await liveProvider.getExtractedFindings();
      return { documents, findings, mode: 'live_mcp' };
    } catch (err) {
      console.warn('Live Box unavailable, falling back to mock data:', err);
      return {
        documents: await mockProvider.getAllDocuments(),
        findings: await mockProvider.getExtractedFindings(),
        mode: 'mock',
        error: err instanceof Error ? err.message : 'Live Box unavailable',
      };
    }
  }
  return {
    documents: await mockProvider.getAllDocuments(),
    findings: await mockProvider.getExtractedFindings(),
    mode: 'mock',
  };
}

export const boxMcpService: BoxMcpProvider = mockProvider;
