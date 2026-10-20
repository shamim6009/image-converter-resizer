import { useCallback, useRef, useState } from 'react';
import type { WorkflowTab } from './types/image';
import { useImageWorkspace } from './hooks/useImageWorkspace';
import { useTheme } from './hooks/useTheme';
import { useToasts } from './hooks/useToasts';
import { getOutputFormat } from './lib/formats';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { UploadZone } from './components/UploadZone';
import { ImportIssues } from './components/ImportIssues';
import { SettingsPanel } from './components/SettingsPanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { ImageGrid } from './components/ImageGrid';
import { BulkToolbar } from './components/BulkToolbar';
import { GuideSections } from './components/GuideSections';
import { Footer } from './components/Footer';
import { Toasts } from './components/Toasts';

export default function App() {
  const { toasts, notify, dismiss } = useToasts();
  const { theme, toggleTheme } = useTheme();
  const workspace = useImageWorkspace(notify);
  const [activeTab, setActiveTab] = useState<WorkflowTab>('convert');
  const workspaceRef = useRef<HTMLElement | null>(null);

  const navigateTo = useCallback((tab: WorkflowTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const targetFormat = getOutputFormat(workspace.settings.format);
  const processedCount = Object.keys(workspace.results).length;
  const failedCount = Object.values(workspace.statuses).filter((status) => status === 'failed').length;
  const locked = workspace.batch.running || workspace.zip.running;

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to the image workspace
      </a>
      <Header
        activeTab={activeTab}
        onNavigate={navigateTo}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main id="main-content">
        <Hero activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="app-container">
          <UploadZone
            onFiles={workspace.addFiles}
            isImporting={workspace.isImporting}
            importProgress={workspace.importProgress}
            hasImages={workspace.sources.length > 0}
          />

          <ImportIssues
            issues={workspace.importIssues}
            onDismiss={workspace.dismissImportIssue}
            onClear={workspace.clearImportIssues}
          />

          <section
            id="workspace"
            ref={workspaceRef}
            className="workspace"
            aria-label="Image conversion and resizing workspace"
          >
            <div className="workspace-layout">
              <SettingsPanel
                settings={workspace.settings}
                onChange={workspace.updateSettings}
                onReset={workspace.resetSettings}
                onApplyAll={workspace.processAll}
                activeSource={workspace.activeSource}
                sourceCount={workspace.sources.length}
                selectedCount={workspace.selectedIds.size}
                capabilities={workspace.capabilities}
                activeTab={activeTab}
                locked={locked}
                batchRunning={workspace.batch.running}
              />

              <div className="workspace-main">
                <ComparisonPanel
                  source={workspace.activeSource}
                  result={workspace.activeResult}
                  status={workspace.activeStatus}
                  error={workspace.activeError}
                  settings={workspace.settings}
                  batchRunning={workspace.batch.running}
                  onDownload={workspace.downloadResult}
                  onRetry={workspace.reprocessActive}
                />

                <BulkToolbar
                  sourceCount={workspace.sources.length}
                  selectedCount={workspace.selectedIds.size}
                  processedCount={processedCount}
                  failedCount={failedCount}
                  batch={workspace.batch}
                  zip={workspace.zip}
                  importing={workspace.isImporting}
                  onProcessSelected={workspace.processSelected}
                  onCancel={workspace.cancelBatch}
                  onRetryFailed={workspace.retryFailed}
                  onDownloadZip={workspace.downloadAllAsZip}
                  onClearAll={workspace.clearAll}
                />

                <ImageGrid
                  sources={workspace.sources}
                  results={workspace.results}
                  statuses={workspace.statuses}
                  errors={workspace.errors}
                  activeId={workspace.activeId}
                  selectedIds={workspace.selectedIds}
                  targetFormat={targetFormat}
                  allSelected={workspace.allSelected}
                  locked={locked}
                  onActivate={workspace.setActive}
                  onToggleSelected={workspace.toggleSelected}
                  onRemove={workspace.removeSource}
                  onDownload={workspace.downloadResult}
                  onSelectAll={workspace.selectAll}
                  onSelectNone={workspace.selectNone}
                />
              </div>
            </div>
          </section>

          <GuideSections />
        </div>
      </main>

      <Footer onNavigate={navigateTo} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
