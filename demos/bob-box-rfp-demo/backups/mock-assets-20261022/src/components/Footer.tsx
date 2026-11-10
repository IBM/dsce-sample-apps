import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BobLogo } from './BobLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8 text-xs text-gray-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            <strong className="font-semibold text-gray-700">Evidence-First Grounding:</strong> All findings and demo assets are generated strictly from Acme Corp synthetic Box workspace records.
          </span>
        </div>

        <div className="flex items-center space-x-3 text-gray-400">
          <span className="flex items-center space-x-1.5 text-gray-700 font-medium">
            <span className="w-4 h-4 rounded bg-gray-900 inline-flex items-center justify-center p-0.5">
              <BobLogo className="w-full h-full" />
            </span>
            <span>Bob + Box</span>
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1 text-gray-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>BoxWorks Demonstration Edition</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
