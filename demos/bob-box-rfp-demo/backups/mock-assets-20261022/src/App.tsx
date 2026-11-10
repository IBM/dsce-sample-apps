import React, { useState, useEffect } from 'react';
import { ScreenState, BoxDocument, Finding } from './types';
import { boxMcpService } from './services/boxMcpService';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Breadcrumbs } from './components/Breadcrumbs';
import { LandingScreen } from './components/LandingScreen';
import { InvestigationScreen } from './components/InvestigationScreen';
import { DiscoveredFilesScreen } from './components/DiscoveredFilesScreen';
import { DemoBriefScreen } from './components/DemoBriefScreen';
import { EvidenceModal } from './components/EvidenceModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DemoPlanScreen } from './components/DemoPlanScreen';
import { DemoAssetsScreen } from './components/DemoAssetsScreen';
import { DemoReadyScreen } from './components/DemoReadyScreen';
import { AskBobDrawer } from './components/AskBobDrawer';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('landing');
  const [unlockedScreens, setUnlockedScreens] = useState<Set<ScreenState>>(new Set(['landing']));
  const [documents, setDocuments] = useState<BoxDocument[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  
  // Modals & Drawers
  const [activeEvidenceFinding, setActiveEvidenceFinding] = useState<Finding | null>(null);
  const [previewDoc, setPreviewDoc] = useState<BoxDocument | null>(null);
  const [isAskBobOpen, setIsAskBobOpen] = useState<boolean>(false);

  // Initialize data from Box MCP mock provider
  useEffect(() => {
    async function loadData() {
      const docs = await boxMcpService.getAllDocuments();
      const f = await boxMcpService.getExtractedFindings();
      setDocuments(docs);
      setFindings(f);
    }
    loadData();
  }, []);

  const navigateTo = (screen: ScreenState) => {
    setCurrentScreen(screen);
    setUnlockedScreens((prev) => new Set([...prev, screen]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartPreparation = (_promptText: string) => {
    navigateTo('investigating');
  };

  const handleInvestigationComplete = () => {
    navigateTo('discovered_files');
  };

  const handleResetDemo = () => {
    setCurrentScreen('landing');
    setUnlockedScreens(new Set(['landing']));
    setActiveEvidenceFinding(null);
    setPreviewDoc(null);
    setIsAskBobOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fa] text-[#161616]">
      {/* Top Application Header */}
      <Header
        currentScreen={currentScreen}
        onResetDemo={handleResetDemo}
        onOpenAskBob={() => setIsAskBobOpen(true)}
      />

      {/* Breadcrumbs for flow progression */}
      <Breadcrumbs
        currentScreen={currentScreen}
        onNavigate={navigateTo}
        unlockedScreens={unlockedScreens}
      />

      {/* Main Screen Content Switcher */}
      <main className="flex-1 flex flex-col">
        {currentScreen === 'landing' && (
          <LandingScreen
            onStartPreparation={handleStartPreparation}
          />
        )}

        {currentScreen === 'investigating' && (
          <InvestigationScreen
            onComplete={handleInvestigationComplete}
          />
        )}

        {currentScreen === 'discovered_files' && (
          <DiscoveredFilesScreen
            documents={documents}
            onProceedToBrief={() => navigateTo('demo_brief')}
            onPreviewDocument={(doc) => setPreviewDoc(doc)}
          />
        )}

        {currentScreen === 'demo_brief' && (
          <DemoBriefScreen
            findings={findings}
            documents={documents}
            onSelectFinding={(finding) => setActiveEvidenceFinding(finding)}
            onBuildDemoPlan={() => navigateTo('demo_plan')}
            onViewAllSources={() => navigateTo('discovered_files')}
            onOpenAskBob={() => setIsAskBobOpen(true)}
            onResetDemo={handleResetDemo}
          />
        )}

        {currentScreen === 'demo_plan' && (
          <DemoPlanScreen
            documents={documents}
            onGenerateAssets={() => navigateTo('demo_assets')}
            onPreviewDocument={(doc) => setPreviewDoc(doc)}
            onOpenAskBob={() => setIsAskBobOpen(true)}
          />
        )}

        {currentScreen === 'demo_assets' && (
          <DemoAssetsScreen
            documents={documents}
            onProceedToDemoReady={() => navigateTo('demo_ready')}
            onPreviewDocument={(doc) => setPreviewDoc(doc)}
          />
        )}

        {currentScreen === 'demo_ready' && (
          <DemoReadyScreen
            documents={documents}
            findings={findings}
            onReviewEvidence={() => navigateTo('demo_brief')}
            onViewScript={() => navigateTo('demo_assets')}
            onResetDemo={handleResetDemo}
            onPreviewDocument={(doc) => setPreviewDoc(doc)}
            onOpenAskBob={() => setIsAskBobOpen(true)}
          />
        )}
      </main>

      {/* Evidence Verification Modal (Screen 5) */}
      <EvidenceModal
        finding={activeEvidenceFinding}
        documents={documents}
        onClose={() => setActiveEvidenceFinding(null)}
        onPreviewDocument={(doc) => {
          setActiveEvidenceFinding(null);
          setPreviewDoc(doc);
        }}
      />

      {/* Document Full Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Ask Bob Grounded Assistant Drawer */}
      <AskBobDrawer
        isOpen={isAskBobOpen}
        onClose={() => setIsAskBobOpen(false)}
        documents={documents}
        onPreviewDocument={(doc) => {
          setIsAskBobOpen(false);
          setPreviewDoc(doc);
        }}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
};
