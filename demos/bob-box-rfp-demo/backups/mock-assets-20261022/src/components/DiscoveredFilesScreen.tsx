import React, { useState } from 'react';
import { BoxDocument } from '../types';
import { getFileTypeBadge, formatDate } from '../utils/formatters';
import { 
  FolderSearch, 
  ShieldCheck, 
  Eye, 
  Filter, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Folder 
} from 'lucide-react';

interface DiscoveredFilesScreenProps {
  documents: BoxDocument[];
  onProceedToBrief: () => void;
  onPreviewDocument: (doc: BoxDocument) => void;
  onViewEvidenceForDoc?: (docId: string) => void;
}

export const DiscoveredFilesScreen: React.FC<DiscoveredFilesScreenProps> = ({
  documents,
  onProceedToBrief,
  onPreviewDocument,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');

  const folders = Array.from(new Set(documents.map(d => d.folderPath.split(' / ').pop() || 'Other')));

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.owner.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    const matchesFolder = selectedFolder === 'all' || doc.folderPath.includes(selectedFolder);

    return matchesSearch && matchesType && matchesFolder;
  });

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-slide-up">
      {/* Top Header & Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#0061d5] text-white">
              <FolderSearch className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              12 Relevant Box Files Discovered
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Acme Corp Workspace
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onProceedToBrief}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all self-start md:self-auto cursor-pointer"
        >
          <span>View Demo Brief</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discovered files..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center space-x-1 text-xs text-gray-500 mr-2 flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="all">All File Formats</option>
            <option value="docx">Word (.docx)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>

          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Folders</option>
            {folders.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Box Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filteredDocs.map((doc) => {
          const badge = getFileTypeBadge(doc.type);

          return (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-card-hover p-4 flex flex-col justify-between transition-all group"
            >
              <div>
                {/* Top Card Header */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400 truncate max-w-[120px]">
                      {doc.size}
                    </span>
                  </div>

                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{doc.supportedFindingIds.length} findings backed</span>
                  </span>
                </div>

                {/* File Name */}
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#0061d5] transition-colors leading-snug break-words">
                  {doc.name}
                </h3>

                {/* Folder Path */}
                <p className="text-[11px] text-gray-400 flex items-center space-x-1 mt-1 truncate">
                  <Folder className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{doc.folderPath}</span>
                </p>

                {/* Summary */}
                <p className="text-xs text-gray-600 mt-2.5 line-clamp-2 leading-relaxed">
                  {doc.summary}
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="truncate max-w-[140px]">
                  <span className="font-medium text-gray-700">{doc.owner.name}</span>
                  <span className="block text-[10px] text-gray-400">{formatDate(doc.modifiedAt)}</span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onPreviewDocument(doc)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    title="Read synthetic document content"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>All 12 files verified via Box MCP • 22 distinct evidence citations mapped</span>
        </div>

        <button
          onClick={onProceedToBrief}
          className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all cursor-pointer w-full sm:w-auto"
        >
          <span>Build Acme Demo Brief</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
