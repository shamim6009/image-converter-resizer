import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { BackgroundPanel } from './components/BackgroundPanel';
import { GuideSections } from './components/GuideSections';
import { Footer } from './components/Footer';
import { Toasts } from './components/Toasts';

const EditorPage = lazy(() => import('./editor/EditorPage'));

const EDITOR_HASH = '#/editor';

function isEditorHash(): boolean {
  return window.location.hash.startsWith(EDITOR_HASH);
}

export default function App() {
  const { toasts, notify, dismiss } = useToasts();
  const { theme, toggleTheme } = useTheme();
  const workspace = useImageWorkspace(notify);
  const [activeTab, setActiveTab] = useState<WorkflowTab>('convert');
  const [editorOpen, setEditorOpen] = useState(isEditorHash);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onHashChange = () => setEditorOpen(isEditorHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const scrollToWorkspace = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const closeEditor = useCallback(() => {
    if (isEditorHash()) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
    setEditorOpen(false);
  }, []);

  const openEditor = useCallback((file?: File) => {
    if (file) setEditorFile(file);
    if (!isEditorHash()) window.location.hash = EDITOR_HASH;
    setEditorOpen(true);
    window.scrollTo({ top: 0 });
  }, []);

  const navigateTo = useCallback(
    (tab: WorkflowTab) => {
      closeEditor();
      setActiveTab(tab);
      scrollToWorkspace();
    },
    [closeEditor, scrollToWorkspace],
  );

  const consumeEditorFile = useCallback(() => setEditorFile(null), []);

  const sendToConverter = useCallback(
    (file: File) => {
      workspace.addFiles([file]);
      closeEditor();
      setActiveTab('convert');
      scrollToWorkspace();
    },
    [closeEditor, scrollToWorkspace, workspace],
  );

  const editSource = useCallback(
    (id: string) => {
      const source = workspace.sources.find((item) => item.id === id);
      if (source) openEditor(source.file);
    },
    [openEditor, workspace.sources],
  );

  const targetFormat = getOutputFormat(workspace.settings.format);
  const processedCount = Object.keys(workspace.results).length;
  const failedCount = Object.values(workspace.statuses).filter((status) => status === 'failed').length;
  const locked = workspace.batch.running || workspace.zip.running || workspace.backgroundJob.running;
  const showBackgroundPanel = activeTab === 'background' || workspace.backgroundJob.running;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to the main content
      </a>
      <Header
        activeTab={activeTab}
        onNavigate={navigateTo}
        editorOpen={editorOpen}
        onOpenEditor={() => openEditor()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {editorOpen ? (
        <main id="main-content" className="editor-main">
          <Suspense
            fallback={
              <div className="editor-loading" role="status">
                <Loader2 className="spin" size={22} aria-hidden="true" />
                Loading the photo editor…
              </div>
            }
          >
            <EditorPage
              initialFile={editorFile}
              onInitialFileConsumed={consumeEditorFile}
              onSendToConverter={sendToConverter}
              notify={notify}
            />
          </Suspense>
        </main>
      ) : (
        <>
          <main id="main-content">
            <Hero activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="app-container">
              <UploadZone
                onFiles={workspace.addFiles}
                isImporting={workspace.isImporting}
                importProgress={workspace.importProgress}
                sources={workspace.sources}
                activeId={workspace.activeId}
                locked={locked}
                onActivate={workspace.setActive}
                onRemove={workspace.removeSource}
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
                    {showBackgroundPanel ? (
                      <BackgroundPanel
                        sources={workspace.sources}
                        activeSource={workspace.activeSource}
                        selectedIds={workspace.selectedIds}
                        job={workspace.backgroundJob}
                        disabled={locked || workspace.isImporting}
                        onRemove={(ids) => void workspace.removeBackgrounds(ids)}
                        onCancel={workspace.cancelBackgroundJob}
                      />
                    ) : null}

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
                      importing={workspace.isImporting || workspace.backgroundJob.running}
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
                      onRemoveBackground={(id) => void workspace.removeBackgrounds([id])}
                      onEdit={editSource}
                      onSelectAll={workspace.selectAll}
                      onSelectNone={workspace.selectNone}
                    />
                  </div>
                </div>
              </section>

              <GuideSections />
            </div>
          </main>

          <Footer onNavigate={navigateTo} onOpenEditor={() => openEditor()} />
        </>
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
