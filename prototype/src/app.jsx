// === APP ===
const { useState: _us, useEffect: _ue, useMemo: _um } = React;
const {
  Sidebar, BottomNav, TopBar, Toast, I,
  LoginScreen, DashboardScreen, BatchesScreen, NewBatchScreen, SettingsScreen,
  MOCK_BATCHES, COMPANY,
} = window;

function App() {
  const [authed, setAuthed] = _us(false);
  const [screen, setScreen] = _us('dashboard');
  const [navOpts, setNavOpts] = _us({});
  const [batches, setBatches] = _us(MOCK_BATCHES);
  const [company, setCompany] = _us(COMPANY);
  const [toast, setToast] = _us(null);
  const [flashId, setFlashId] = _us(null);

  // Global "N" shortcut → new batch
  _ue(() => {
    if (!authed) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('new');
      } else if (e.key === '/') {
        e.preventDefault();
        navigate('batches');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authed]);

  const navigate = (s, opts = {}) => {
    setScreen(s);
    setNavOpts(opts);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNewBatch = (batch) => {
    setBatches(prev => [batch, ...prev]);
    setFlashId(batch.id);
    setTimeout(() => setFlashId(null), 2200);
    navigate('batches');
    setToast({ kind: 'success', message: 'Lote cadastrado', sub: batch.product });
  };

  const handleDelete = (id) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    setToast({ kind: 'success', message: 'Lote removido' });
  };

  if (!authed) {
    return (
      <>
        <LoginScreen onLogin={() => setAuthed(true)} />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  // Screen title
  const titleMap = {
    dashboard: { t: 'Painel',   s: `Bom dia, ${company.managerName.split(' ')[0]}. Aqui está sua operação hoje.` },
    batches:   { t: 'Lotes',    s: 'Acompanhe seus produtos por status de validade.' },
    new:       { t: 'Cadastrar lote', s: 'Velocidade máxima — bipe, salve, próximo.' },
    settings:  { t: 'Configurações', s: 'Empresa, alertas e canal de envio.' },
  };
  const meta = titleMap[screen];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar active={screen} onNavigate={navigate} company={company} />

      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar
          title={meta.t}
          subtitle={meta.s}
          onNavigate={navigate}
          active={screen}
          company={company}
        />

        <div className="flex-1 min-w-0">
          {screen === 'dashboard' && (
            <DashboardScreen
              batches={batches}
              onNavigate={navigate}
              onNewBatch={() => navigate('new')}
            />
          )}
          {screen === 'batches' && (
            <BatchesScreen
              batches={batches}
              onNewBatch={() => navigate('new')}
              onDelete={handleDelete}
              initialFilter={navOpts.filter}
              flashId={flashId}
            />
          )}
          {screen === 'new' && (
            <NewBatchScreen
              onCancel={() => navigate('batches')}
              onSave={handleNewBatch}
              knownProducts={batches}
            />
          )}
          {screen === 'settings' && (
            <SettingsScreen
              company={company}
              onSave={(updates) => {
                setCompany({ ...company, ...updates });
                setToast({ kind: 'success', message: 'Configurações salvas' });
              }}
              onTestAlert={() => setToast({ kind: 'success', message: 'Mensagem de teste enviada', sub: 'WhatsApp ' + company.whatsapp })}
            />
          )}
        </div>
      </main>

      <BottomNav active={screen} onNavigate={navigate} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
