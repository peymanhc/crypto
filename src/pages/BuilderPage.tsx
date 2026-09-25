import { Wrench } from 'lucide-react';
import { useI18n } from '../i18n';
import { useEngine } from '../hooks/useEngine';
import { useSimpleSelection } from '../hooks/useSimpleSelection';
import { useStrategies } from '../hooks/useStrategies';
import PageTitle from '../components/ui/PageTitle';
import EngineSelector from '../components/strategy/EngineSelector';
import StrategyList from '../components/strategy/StrategyList';
import StrategyEditor from '../components/strategy/StrategyEditor';
import SignalLab from '../components/lab/SignalLab';

// Pro mode: build strategies rule by rule, pick the active one, test it in the lab
function BuilderPage() {
  const { t } = useI18n();
  const { engine, setEngine } = useEngine();
  const { selection } = useSimpleSelection();
  const store = useStrategies();

  const createStrategy = () => {
    const name = window.prompt(t('builder.namePrompt'), t('builder.defaultName', { n: store.strategies.length + 1 }));
    if (name !== null) store.create(name.trim() || t('builder.defaultName', { n: store.strategies.length + 1 }));
  };

  const deleteStrategy = (id: string) => {
    const strategy = store.strategies.find((s) => s.id === id);
    if (strategy && window.confirm(t('builder.confirmDelete', { name: strategy.name }))) store.remove(id);
  };

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><Wrench className="h-3.5 w-3.5" /> {t('builder.eyebrow')}</>}
        eyebrowColor="text-glow-amber"
        title={<>{t('builder.title.a')} <span className="gradient-text">{t('builder.title.b')}</span></>}
        description={t('builder.description')}
      />

      <EngineSelector
        engine={engine}
        onChange={setEngine}
        simpleStatus={t('simple.enabledCount', { count: selection.enabled.length })}
        proStatus={store.active ? store.active.name : t('builder.empty')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <StrategyList
            strategies={store.strategies}
            activeId={store.activeId}
            selectedId={store.selectedId}
            onSelect={store.setSelectedId}
            onSetActive={store.setActive}
            onCreate={createStrategy}
            onDuplicate={store.duplicate}
            onDelete={deleteStrategy}
          />
        </div>
        <div className="lg:col-span-8">
          {store.selected ? (
            <StrategyEditor strategy={store.selected} onChange={store.update} />
          ) : (
            <div className="glass flex min-h-[200px] items-center justify-center p-6 text-center text-sm text-slate-500">{t('builder.empty')}</div>
          )}
        </div>
      </div>

      <SignalLab inputs={{ engine, simple: selection, pro: store.active }} />
    </div>
  );
}

export default BuilderPage;
