import { FileType } from '../types';

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function getFileTypeBadge(type: FileType): { label: string; bg: string; text: string; border: string } {
  switch (type) {
    case 'docx':
      return { label: 'DOCX', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'xlsx':
      return { label: 'XLSX', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'pdf':
      return { label: 'PDF', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'pptx':
      return { label: 'PPTX', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    default:
      return { label: 'DOC', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
}
