import React from 'react';
import { ScreenState } from '../types';
import { Sparkles, LayoutDashboard } from 'lucide-react';

interface BreadcrumbsProps {
  currentScreen: ScreenState;
  onNavigate: (screen: ScreenState) => void;
  unlockedScreens: Set<ScreenState>;
}

interface StepItem {
  id: ScreenState;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepItem[] = [
  { id: 'landing', label: 'Home', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'workspace', label: 'Workspace', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
];

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  currentScreen,
  onNavigate,
  unlockedScreens,
}) => {
  if (currentScreen === 'landing') return null;

  return (
    <div className="bg-white border-b border-gray-200 py-2.5 px-4 sm:px-6 lg:px-8 overflow-x-auto shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between min-w-max space-x-2">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {STEPS.map((step, idx) => {
            const isCurrent = currentScreen === step.id;
            const isUnlocked = unlockedScreens.has(step.id);
            const isPast = isUnlocked && !isCurrent;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && <span className="text-gray-300 text-xs">/</span>}
                <button
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && onNavigate(step.id)}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-blue-100 text-blue-800 font-semibold shadow-xs ring-1 ring-blue-300'
                      : isPast
                      ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span className={isCurrent ? 'text-blue-600' : isPast ? 'text-gray-500' : 'text-gray-400'}>
                    {step.icon}
                  </span>
                  <span>{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
