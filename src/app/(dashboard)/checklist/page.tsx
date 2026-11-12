'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  XCircle,
  FileQuestion,
  UserCheck,
  Sparkles,
  RefreshCw,
  Play,
  Layers,
  Info,
  Calendar,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Opportunity, RequirementEvidenceMatch, ReadinessOverview, MatchOutcome } from '@/types/models';

export default function ChecklistPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppId, setSelectedOppId] = useState<string>('');
  const [matches, setMatches] = useState<RequirementEvidenceMatch[]>([]);
  const [readiness, setReadiness] = useState<ReadinessOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'mandatory' | 'desirable'>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  // Load opportunities on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        // Ensure evidence library is seeded if empty
        await fetch('/api/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed' }),
        }).catch(() => {});

        // Fetch opportunities
        const res = await fetch('/api/opportunities');
        const data = await res.json();
        if (data.success && data.opportunities && data.opportunities.length > 0) {
          setOpportunities(data.opportunities);
          setSelectedOppId(data.opportunities[0].id);
        } else {
          // Fallback demo opportunity
          const demoOpp: Opportunity = {
            id: 'opp-faa-radar-098',
            organization_id: 'org-1',
            created_by_user_id: 'user-1',
            title: 'FAA Radar Modernization — Synthetic Tender',
            reference_code: 'RFP-2026-FAA-RADAR',
            stage: 'IN_PREPARATION',
            priority: 'high',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setOpportunities([demoOpp]);
          setSelectedOppId(demoOpp.id);
        }
      } catch (err: any) {
        setError(`Erro ao carregar oportunidades: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Fetch matches for selected opportunity
  const loadMatches = useCallback(async (oppId: string) => {
    if (!oppId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${oppId}/matches`);
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches || []);
        setReadiness(data.readiness || null);
      } else {
        setError(data.error || 'Falha ao buscar correspondências');
      }
    } catch (err: any) {
      setError(`Erro na requisição: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOppId) {
      loadMatches(selectedOppId);
    }
  }, [selectedOppId, loadMatches]);

  // Execute matching engine
  const handleRunMatching = async () => {
    if (!selectedOppId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${selectedOppId}/matches/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches || []);
        setReadiness(data.readiness || null);
      } else {
        setError(data.error || 'Falha ao executar o motor de correspondência');
      }
    } catch (err: any) {
      setError(`Erro ao executar matching: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  // Record human verification override
  const handleRecordHumanVerification = async (
    matchId: string,
    verified: boolean,
    customOutcome?: MatchOutcome
  ) => {
    if (!selectedOppId) return;
    setActionLoading(matchId);
    try {
      const res = await fetch(`/api/opportunities/${selectedOppId}/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified,
          matchOutcome: customOutcome || (verified ? 'MATCHED' : 'REQUIRES_REVIEW'),
          notes: verified
            ? 'Aprovado pelo analista de propostas após validação documental.'
            : 'Marcado para auditoria humana presencial ou complementação técnica.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh matches from server to ensure complete persistence
        await loadMatches(selectedOppId);
      } else {
        alert(`Erro ao salvar verificação: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha de rede: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = matches.filter((item) => {
    if (filterType === 'mandatory' && item.requirement?.type !== 'mandatory') return false;
    if (filterType === 'desirable' && item.requirement?.type !== 'desirable') return false;
    if (filterOutcome !== 'all' && item.match_outcome !== filterOutcome) return false;
    return true;
  });

  const selectedOpp = opportunities.find((o) => o.id === selectedOppId);

  // Compute coverage percentage
  const mandatoryTotal = readiness?.mandatory_total ?? matches.filter((m) => m.requirement?.type === 'mandatory').length;
  const mandatoryMatched = readiness?.mandatory_matched ?? matches.filter((m) => m.requirement?.type === 'mandatory' && m.match_outcome === 'MATCHED').length;
  const mandatoryCoveragePct = mandatoryTotal > 0 ? Math.round((mandatoryMatched / mandatoryTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Opportunity Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-blue-600" />
            Evidence Matching & Supplier Readiness Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Motor de inteligência que cruza requisitos de editais com a biblioteca de evidências da sua organização.
          </p>
        </div>

        {/* Opportunity Selector and Run Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Oportunidade Selecionada
            </label>
            <select
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[280px]"
            >
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.title} {opp.reference_code ? `(${opp.reference_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 pt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMatches(selectedOppId)}
              disabled={loading || running}
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleRunMatching}
              disabled={running || !selectedOppId}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Executar Análise de Correspondência</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>
            Fechar
          </Button>
        </div>
      )}

      {/* Selected Opportunity Info Strip */}
      {selectedOpp && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              {selectedOpp.issuing_body || 'Órgão Licitante'}
            </span>
            {selectedOpp.reference_code && (
              <Badge variant="outline" className="font-mono">
                {selectedOpp.reference_code}
              </Badge>
            )}
            <Badge variant="secondary" className="uppercase text-[10px]">
              {selectedOpp.stage || 'Em Preparação'}
            </Badge>
          </div>
          {selectedOpp.submission_deadline && (
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Prazo de Submissão: {new Date(selectedOpp.submission_deadline).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Readiness Intelligence Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Requisitos */}
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requisitos</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {matches.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Obrigatórios: {mandatoryTotal}
          </div>
        </Card>

        {/* Card 2: MATCHED */}
        <Card className="p-4 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Matched
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {matches.filter((m) => m.match_outcome === 'MATCHED').length}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-500 mt-0.5">
            Evidência ativa e válida
          </div>
        </Card>

        {/* Card 3: PARTIALLY_MATCHED */}
        <Card className="p-4 border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Parcial
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
            {matches.filter((m) => m.match_outcome === 'PARTIALLY_MATCHED').length}
          </div>
          <div className="text-[11px] text-blue-600/80 dark:text-blue-500 mt-0.5">
            Exige narrativa técnica
          </div>
        </Card>

        {/* Card 4: MISSING_EVIDENCE */}
        <Card className="p-4 border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10">
          <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <FileQuestion className="w-3.5 h-3.5" />
            Ausente
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {matches.filter((m) => m.match_outcome === 'MISSING_EVIDENCE').length}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-500 mt-0.5">
            Sem comprovação
          </div>
        </Card>

        {/* Card 5: EXPIRED_EVIDENCE */}
        <Card className="p-4 border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expirada
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {matches.filter((m) => m.match_outcome === 'EXPIRED_EVIDENCE').length}
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-500 mt-0.5">
            Documento vencido
          </div>
        </Card>

        {/* Card 6: REQUIRES_REVIEW */}
        <Card className="p-4 border-purple-200 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Revisão
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
            {matches.filter((m) => m.match_outcome === 'REQUIRES_REVIEW').length}
          </div>
          <div className="text-[11px] text-purple-600/80 dark:text-purple-500 mt-0.5">
            Auditoria humana pendente
          </div>
        </Card>
      </div>

      {/* Readiness Stage Banner & Transparent Methodology */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Estado de Prontidão da Proposta:
            </span>
            {readiness?.readiness_stage === 'SUBMISSION_READY' && (
              <Badge variant="success" className="text-xs py-1 px-2.5">
                SUBMISSION READY (Pronto para Submissão)
              </Badge>
            )}
            {readiness?.readiness_stage === 'NEEDS_VERIFICATION' && (
              <Badge variant="warning" className="text-xs py-1 px-2.5">
                NEEDS VERIFICATION (Pendente de Revisão)
              </Badge>
            )}
            {readiness?.readiness_stage === 'ACTION_REQUIRED' && (
              <Badge variant="destructive" className="text-xs py-1 px-2.5">
                ACTION REQUIRED (Lacunas ou Evidências Expiradas)
              </Badge>
            )}
            {(!readiness || readiness?.readiness_stage === 'NOT_READY') && (
              <Badge variant="outline" className="text-xs py-1 px-2.5">
                NOT READY (Em Levantamento)
              </Badge>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Cobertura de Requisitos Obrigatórios:{' '}
            <strong className="text-slate-900 dark:text-white">{mandatoryCoveragePct}%</strong> ({mandatoryMatched}/{mandatoryTotal})
          </div>
        </div>

        {readiness?.calculation_explanation && (
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {readiness.calculation_explanation}
          </p>
        )}

        {/* Disclaimer Transparente Obrigatório */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
          <span>
            <strong>Diretriz de Transparência Regulatória:</strong> O índice de prontidão reflete estritamente a conformidade e cobertura documental interna catalogada. Não constitui parecer jurídico e não garante classificação, habilitação ou adjudicação na licitação. Evidências vencidas são sumariamente invalidadas independente do teor de seu texto.
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Type Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filterType === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="text-xs h-8"
          >
            Todos ({matches.length})
          </Button>
          <Button
            variant={filterType === 'mandatory' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('mandatory')}
            className="text-xs h-8"
          >
            Obrigatórios ({matches.filter((i) => i.requirement?.type === 'mandatory').length})
          </Button>
          <Button
            variant={filterType === 'desirable' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('desirable')}
            className="text-xs h-8"
          >
            Desejáveis ({matches.filter((i) => i.requirement?.type === 'desirable').length})
          </Button>
        </div>

        {/* Outcome Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-slate-400 text-[11px] uppercase mr-1">Status:</span>
          {['all', 'MATCHED', 'PARTIALLY_MATCHED', 'MISSING_EVIDENCE', 'EXPIRED_EVIDENCE', 'REQUIRES_REVIEW'].map((o) => (
            <Button
              key={o}
              size="sm"
              variant={filterOutcome === o ? 'secondary' : 'ghost'}
              onClick={() => setFilterOutcome(o)}
              className="text-[11px] h-7 px-2.5 whitespace-nowrap"
            >
              {o === 'all' ? 'Todos' : o.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      {loading && matches.length === 0 ? (
        <div className="py-16 text-center text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm">Carregando requisitos e correspondências da oportunidade...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Nenhum requisito encontrado para os filtros selecionados
          </h3>
          <p className="text-xs max-w-md mx-auto">
            {matches.length === 0
              ? 'Nenhuma análise de correspondência foi executada para esta oportunidade ainda. Clique em "Executar Análise de Correspondência" acima para iniciar.'
              : 'Altere os filtros acima para visualizar os requisitos desta oportunidade.'}
          </p>
          {matches.length === 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunMatching}
              disabled={running}
              className="mt-2"
            >
              <Play className="w-4 h-4 mr-1.5" /> Executar Análise Agora
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const req = item.requirement;
            const ev = item.evidence;
            const isMandatory = req?.type === 'mandatory';
            const isMissing = item.match_outcome === 'MISSING_EVIDENCE';
            const isExpired = item.match_outcome === 'EXPIRED_EVIDENCE';
            const isCriticalGap = isMandatory && (isMissing || isExpired);

            return (
              <Card
                key={item.id}
                className={`transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                  isCriticalGap
                    ? 'border-rose-400 dark:border-rose-900/80 bg-rose-50/20 dark:bg-rose-950/10 ring-1 ring-rose-300 dark:ring-rose-900/40'
                    : isExpired
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                    : isMissing
                    ? 'border-rose-300 dark:border-rose-900/60'
                    : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      {/* Header Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={isMandatory ? 'destructive' : 'secondary'}
                          className="uppercase text-[10px]"
                        >
                          {req?.type || 'Mandatory'}
                        </Badge>

                        <Badge variant="outline" className="text-[11px]">
                          {req?.category}
                        </Badge>

                        {/* Match Outcome Badge */}
                        {item.match_outcome === 'MATCHED' && (
                          <Badge variant="success" className="gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>MATCHED</span>
                          </Badge>
                        )}
                        {item.match_outcome === 'PARTIALLY_MATCHED' && (
                          <Badge variant="warning" className="gap-1 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>PARTIALLY MATCHED</span>
                          </Badge>
                        )}
                        {item.match_outcome === 'MISSING_EVIDENCE' && (
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <FileQuestion className="w-3.5 h-3.5" />
                            <span>MISSING EVIDENCE</span>
                          </Badge>
                        )}
                        {item.match_outcome === 'EXPIRED_EVIDENCE' && (
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>EXPIRED EVIDENCE</span>
                          </Badge>
                        )}
                        {item.match_outcome === 'REQUIRES_REVIEW' && (
                          <Badge variant="warning" className="gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>REQUIRES REVIEW</span>
                          </Badge>
                        )}

                        <span className="text-xs text-slate-400">
                          Aderência: {(item.confidence_score * 100).toFixed(0)}%
                        </span>

                        {isCriticalGap && (
                          <Badge variant="destructive" className="animate-pulse text-[10px]">
                            BLOQUEADOR DE SUBMISSÃO
                          </Badge>
                        )}
                      </div>

                      {/* Requirement Title and Description */}
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          {req?.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {req?.description}
                        </p>
                      </div>

                      {/* Literal Citation from Source Tender Document */}
                      {req?.source_reference && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <span className="font-semibold text-blue-600 dark:text-blue-400 block text-[11px]">
                            Origem no Edital: Página {req.source_reference.page_number || 1} &bull; {req.source_reference.section_title}
                          </span>
                          <blockquote className="italic border-l-2 border-blue-500 pl-2.5 mt-1.5 text-slate-700 dark:text-slate-300 font-sans text-xs leading-relaxed">
                            &ldquo;{req.source_reference.raw_quote}&rdquo;
                          </blockquote>
                        </div>
                      )}

                      {/* Matching Engine Audit Explanation & Linked Evidence */}
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                            Justificativa do Motor de Correspondência:
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.match_explanation}
                        </p>

                        {/* Linked Evidence Card */}
                        {ev && (
                          <div className={`mt-2 p-2.5 rounded border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            ev.verification_status === 'expired'
                              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                          }`}>
                            <div className="space-y-0.5">
                              <span className="font-semibold block flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                Evidência Vinculada: {ev.title}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                Emissor: {ev.issuing_organization || 'Corporativo'} &bull; Categoria: {ev.category}
                              </span>
                            </div>
                            <div className="text-right">
                              {ev.valid_until && (
                                <Badge
                                  variant={ev.verification_status === 'expired' ? 'destructive' : 'outline'}
                                  className="text-[10px]"
                                >
                                  Validade: {new Date(ev.valid_until).toLocaleDateString()}
                                  {ev.verification_status === 'expired' ? ' (VENCIDO)' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Gaps Identified */}
                        {item.missing_information && (
                          <div className="mt-2 p-2 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300">
                            <strong>Lacuna Identificada:</strong> {item.missing_information}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Human Verification Action Box */}
                    <div className="w-full lg:w-60 flex-shrink-0 flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                        Auditoria Humana
                      </span>

                      {item.verified_at ? (
                        <div className="space-y-1">
                          <Badge variant="success" className="text-[10px] w-full justify-center">
                            Verificado por Analista
                          </Badge>
                          <span className="text-[10px] text-slate-400 block text-center">
                            {new Date(item.verified_at).toLocaleString()}
                          </span>
                          {item.human_review_notes && (
                            <p className="text-[11px] text-slate-500 italic mt-1">
                              &ldquo;{item.human_review_notes}&rdquo;
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === item.id}
                            onClick={() => handleRecordHumanVerification(item.id, false, 'REQUIRES_REVIEW')}
                            className="w-full text-[11px] h-7 mt-2"
                          >
                            Reabrir Auditoria
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-[11px] text-slate-500 block">
                            {item.human_review_required
                              ? 'Exige revisão humana antes da aprovação final da proposta.'
                              : 'Correspondência automática aprovada pelo motor.'}
                          </span>
                          <div className="space-y-1.5 pt-1">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={actionLoading === item.id}
                              onClick={() => handleRecordHumanVerification(item.id, true, 'MATCHED')}
                              className="w-full text-[11px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {actionLoading === item.id ? 'Salvando...' : 'Confirmar Conformidade'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoading === item.id}
                              onClick={() => handleRecordHumanVerification(item.id, false, 'REQUIRES_REVIEW')}
                              className="w-full text-[11px] h-7 text-amber-700 dark:text-amber-400 border-amber-300"
                            >
                              Sinalizar Pendência
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
