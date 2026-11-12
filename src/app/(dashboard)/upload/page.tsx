'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Shield,
  FileCheck,
  Loader2,
  Clock,
  ExternalLink,
  RefreshCw,
  FileText,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TenderExtractionResult } from '@/lib/extraction/schemas';

interface QuotaInfo {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  rejectionReason?: string;
}

interface PreviousDocumentItem {
  id: string;
  file_name?: string;
  fileName?: string;
  file_size_bytes?: number;
  fileSizeBytes?: number;
  mime_type?: string;
  mimeType?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
  opportunity_id?: string;
  opportunityId?: string;
}

const DEFAULT_ORG_ID = 'b22937b6-51e5-48a0-a75d-7b3405427298';
const DEFAULT_USER_ID = 'f8936e3d-49d9-4c64-8941-888c76b53f66';

export default function DocumentUploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tenderTitle, setTenderTitle] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [buyerName, setBuyerName] = useState('');

  // Processing & UI state
  const [processingState, setProcessingState] = useState<
    'idle' | 'validating' | 'parsing' | 'extracting' | 'completed' | 'review_required' | 'failed'
  >('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiresOcrNotice, setRequiresOcrNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Analysis Result
  const [extractionResult, setExtractionResult] = useState<TenderExtractionResult | null>(null);
  const [processedDocId, setProcessedDocId] = useState<string | null>(null);
  const [processedDocName, setProcessedDocName] = useState<string | null>(null);
  const [processedOppId, setProcessedOppId] = useState<string | null>(null);
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});

  // Real-time Quota Info (Read-only from Backend)
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);

  // Previous Analyses Retrieval
  const [previousDocs, setPreviousDocs] = useState<PreviousDocumentItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedReqFilter, setSelectedReqFilter] = useState<'all' | 'mandatory' | 'desirable' | 'review'>('all');

  // Load quota and previous documents on mount
  useEffect(() => {
    fetchQuota();
    fetchPreviousAnalyses();
  }, []);

  const fetchQuota = async () => {
    setIsLoadingQuota(true);
    try {
      const res = await fetch(`/api/billing/subscription?orgId=${DEFAULT_ORG_ID}`);
      const data = await res.json();
      if (data.success && data.quota) {
        setQuotaInfo(data.quota);
      }
    } catch (e) {
      console.error('Failed to fetch subscription quota:', e);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  const fetchPreviousAnalyses = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/documents/upload?organizationId=${DEFAULT_ORG_ID}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setPreviousDocs(data.documents);
      }
    } catch (e) {
      console.error('Failed to load past documents:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = /\.(pdf|docx|xlsx)$/i;

      if (!validExtensions.test(file.name)) {
        setErrorMessage('Formato de arquivo inválido. Por favor, envie um documento PDF, DOCX ou XLSX.');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage('Tamanho do arquivo excede o limite máximo permitido de 50MB.');
        return;
      }

      setSelectedFile(file);
      setErrorMessage(null);
      setRequiresOcrNotice(false);
      setExtractionResult(null);
      setProcessingState('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isSubmitting) return;

    setIsSubmitting(true);
    setProcessingState('validating');
    setUploadProgress(15);
    setErrorMessage(null);
    setRequiresOcrNotice(false);
    setExtractionResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', tenderTitle || selectedFile.name);
    formData.append('referenceCode', referenceCode);
    formData.append('buyerName', buyerName);
    formData.append('organizationId', DEFAULT_ORG_ID);
    formData.append('userId', DEFAULT_USER_ID);

    try {
      // Progressive status progression
      const timer1 = setTimeout(() => {
        setProcessingState('parsing');
        setUploadProgress(45);
      }, 500);

      const timer2 = setTimeout(() => {
        setProcessingState('extracting');
        setUploadProgress(75);
      }, 1500);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = await response.json();

      if (!response.ok || !data.success) {
        setProcessingState('failed');
        setUploadProgress(100);

        if (response.status === 403 || data.isQuotaExceeded) {
          setErrorMessage(data.error || 'Cota de análise excedida para o período. Atualize seu plano para continuar.');
        } else if (data.requiresOcr) {
          setRequiresOcrNotice(true);
          setErrorMessage(data.error || 'Documento escaneado sem camada de texto selecionável. Processamento OCR obrigatório.');
        } else {
          setErrorMessage(data.error || 'Falha no processamento do documento.');
        }
        return;
      }

      setUploadProgress(100);
      setProcessedDocId(data.documentId);
      setProcessedDocName(data.fileName);
      setProcessedOppId(data.opportunityId);
      setProcessingState(data.status === 'review_required' ? 'review_required' : 'completed');
      setExtractionResult(data.extractionResult);

      // Refresh real quota and history list
      fetchQuota();
      fetchPreviousAnalyses();
    } catch (err: any) {
      setProcessingState('failed');
      setErrorMessage(`Erro de comunicação com o servidor: ${err?.message || 'Falha de rede'}`);
      setUploadProgress(100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadPastAnalysis = async (docId: string) => {
    try {
      setProcessingState('parsing');
      setErrorMessage(null);
      const res = await fetch(`/api/documents/upload?documentId=${docId}&organizationId=${DEFAULT_ORG_ID}`);
      const data = await res.json();

      if (data.success && data.document) {
        setProcessedDocId(data.document.id);
        setProcessedDocName(data.document.fileName);
        setProcessedOppId(data.document.opportunityId);
        setProcessingState(data.document.status === 'review_required' ? 'review_required' : 'completed');

        if (data.extractionResult) {
          setExtractionResult(data.extractionResult);
        } else if (data.requirements) {
          // Synthesize display from persisted requirements and analysis run
          setExtractionResult({
            executive_summary: data.analysisRun?.executive_summary || 'Análise recuperada do banco de dados.',
            opportunity_identification: {
              title: data.opportunity?.title || data.document.fileName,
              reference_code: data.opportunity?.reference_code,
              issuing_body: data.opportunity?.issuing_body,
            },
            important_dates: [],
            mandatory_requirements: data.requirements
              .filter((r: any) => r.type === 'mandatory')
              .map((r: any) => ({
                category: r.category,
                type: 'mandatory',
                title: r.title,
                description: r.description,
                source_reference: r.source_reference,
                confidence_score: r.confidence_score,
                manual_review_required: r.manual_review_required,
              })),
            desirable_requirements: data.requirements
              .filter((r: any) => r.type === 'desirable')
              .map((r: any) => ({
                category: r.category,
                type: 'desirable',
                title: r.title,
                description: r.description,
                source_reference: r.source_reference,
                confidence_score: r.confidence_score,
                manual_review_required: r.manual_review_required,
              })),
            required_documents_and_evidence: [],
            submission_instructions: {
              format_requirements: 'PDF/A ou padrão oficial do certame.',
              submission_channel: 'Portal oficial de compras',
              source_reference: {
                page_number: 1,
                section_title: 'Instruções',
                snippet: 'Edital oficial',
                raw_quote: 'Instruções gerais de submissão do edital.',
              },
            },
            questions_and_clarifications: {
              deadline: null,
              submission_method: 'Portal Oficial',
            },
            missing_information: [],
            human_review_warnings: [],
            extraction_metadata: {
              model_provider: data.analysisRun?.model_provider || 'gemini',
              model_version: data.analysisRun?.model_version || 'gemini-3.8-flash',
              tokens_consumed: 0,
              overall_confidence: data.analysisRun?.confidence_score || 0.9,
              extracted_at: data.analysisRun?.started_at || new Date().toISOString(),
            },
          });
        }
      }
    } catch (e: any) {
      setErrorMessage(`Falha ao carregar análise anterior: ${e.message}`);
    }
  };

  const toggleQuoteExpansion = (key: string) => {
    setExpandedQuotes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allReqs = extractionResult
    ? [
        ...extractionResult.mandatory_requirements.map((r) => ({ ...r, reqType: 'mandatory' as const })),
        ...extractionResult.desirable_requirements.map((r) => ({ ...r, reqType: 'desirable' as const })),
      ]
    : [];

  const filteredReqs = allReqs.filter((req) => {
    if (selectedReqFilter === 'mandatory') return req.reqType === 'mandatory';
    if (selectedReqFilter === 'desirable') return req.reqType === 'desirable';
    if (selectedReqFilter === 'review') return req.manual_review_required;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Title & Scope */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Upload e Análise Estruturada de Editais
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Envio real de editais (PDF, DOCX, XLSX) com extração de requisitos, indexação de citações literais e verificação de conformidade.
        </p>
      </div>

      {/* Quota Usage Component (Strict Server-Side Quota Indicator) */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cota de Análises da Organização
                </span>
                {isLoadingQuota && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {quotaInfo ? quotaInfo.used : '--'} / {quotaInfo ? quotaInfo.limit : '--'}
                </span>
                <span className="text-xs text-slate-500">análises consumidas no período</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                variant={quotaInfo && quotaInfo.remaining <= 2 ? 'warning' : 'outline'}
                className="text-xs py-1 px-2.5 font-medium"
              >
                {quotaInfo ? `${quotaInfo.remaining} análises restantes` : 'Carregando cota...'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchQuota}
                disabled={isLoadingQuota}
                title="Atualizar cota em tempo real"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuota ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {quotaInfo && (
            <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  quotaInfo.used >= quotaInfo.limit
                    ? 'bg-rose-500'
                    : quotaInfo.used / quotaInfo.limit > 0.8
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((quotaInfo.used / Math.max(1, quotaInfo.limit)) * 100))}%`,
                }}
              />
            </div>
          )}

          {quotaInfo && !quotaInfo.allowed && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Limite de Cota Esgotado:</strong> O limite mensal de análises da sua organização foi atingido. Realize um upgrade de plano para desbloquear novas análises.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Multi-Tenant Guarantee Box */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-950 dark:bg-emerald-950/20 p-4 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-300">
        <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-emerald-950 dark:text-emerald-200">
            Armazenamento Privado e Rastreabilidade Multi-Tenant
          </p>
          <p className="text-emerald-800/90 dark:text-emerald-400">
            Os documentos enviados são criptografados no Supabase Storage e protegidos por Row Level Security (RLS). Nenhuma informação é compartilhada entre organizações, nem utilizada para treinamento de modelos de terceiros.
          </p>
        </div>
      </div>

      {/* Processing Lifecycle Status Bar */}
      {processingState !== 'idle' && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {processingState === 'failed' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                ) : processingState === 'completed' || processingState === 'review_required' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
                    {processingState === 'validating' && 'Etapa 1/3: Validando Assinatura do Arquivo'}
                    {processingState === 'parsing' && 'Etapa 2/3: Extraindo Seções e Tabelas'}
                    {processingState === 'extracting' && 'Etapa 3/3: Processando Inferência por IA'}
                    {processingState === 'completed' && 'Processamento Concluído com Sucesso'}
                    {processingState === 'review_required' && 'Extração Concluída — Revisão Humana Obrigatória'}
                    {processingState === 'failed' && 'Falha no Processamento'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {processingState === 'validating' && 'Verificando magic bytes, checksum SHA-256 e tamanho máximo de 50MB...'}
                    {processingState === 'parsing' && 'Analisando layout de páginas, tabelas e camadas de texto digital...'}
                    {processingState === 'extracting' && 'Executando extração estruturada Zod com coordenadas de origem e citações literais...'}
                    {processingState === 'review_required' && 'Requisitos extraídos. Identificadas ambiguidades ou confiança inferior a 85%.'}
                    {processingState === 'completed' && 'Todos os requisitos, prazos e diretrizes foram indexados com rastreabilidade.'}
                    {processingState === 'failed' && (errorMessage || 'O processamento foi interrompido.')}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  processingState === 'failed'
                    ? 'destructive'
                    : processingState === 'completed'
                    ? 'success'
                    : processingState === 'review_required'
                    ? 'warning'
                    : 'default'
                }
                className="capitalize text-xs font-semibold"
              >
                {processingState === 'review_required' ? 'Revisão Necessária' : processingState.replace('_', ' ')}
              </Badge>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  processingState === 'failed' ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            {/* Error Message Details */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Detalhe da Interrupção:
                </p>
                <p>{errorMessage}</p>
                {requiresOcrNotice && (
                  <p className="text-[11px] text-rose-700/80 mt-1">
                    Dica: Converta o documento escaneado por uma ferramenta de reconhecimento óptico de caracteres (OCR) antes de reenviá-lo.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* POST-ANALYSIS COMPREHENSIVE VIEW */}
      {extractionResult && (
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-blue-200 dark:border-blue-900 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg text-slate-900 dark:text-white">
                      {processedDocName || extractionResult.opportunity_identification.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {processedDocId && (
                      <span>
                        Doc UUID: <code className="font-mono">{processedDocId}</code>
                      </span>
                    )}
                    {extractionResult.opportunity_identification.reference_code && (
                      <span>
                        Edital: <strong>{extractionResult.opportunity_identification.reference_code}</strong>
                      </span>
                    )}
                    {extractionResult.opportunity_identification.issuing_body && (
                      <span>
                        Órgão: <strong>{extractionResult.opportunity_identification.issuing_body}</strong>
                      </span>
                    )}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/checklist">
                    <Button size="sm" className="gap-1.5 shadow-xs">
                      <span>Abrir Checklist Traceável</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Status and Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                  Status Técnico: <strong className="ml-1 text-emerald-600">Ready</strong>
                </Badge>

                {processingState === 'review_required' ? (
                  <Badge variant="warning" className="text-xs">
                    ⚠️ Análise com Revisão Humana Obrigatória
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-xs">
                    ✅ Extração Completa
                  </Badge>
                )}

                <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                  <Sparkles className="w-3 h-3 text-purple-600 mr-1" />
                  Modelo: {extractionResult.extraction_metadata.model_version}
                </Badge>

                <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                  Confiança Global: {Math.round(extractionResult.extraction_metadata.overall_confidence * 100)}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* MANDATORY LEGAL & COMPLIANCE DISCLAIMER */}
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20 p-4 flex items-start gap-3 text-xs text-amber-950 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    Aviso de Conformidade e Responsabilidade Profissional
                  </p>
                  <p className="leading-relaxed text-amber-900/90 dark:text-amber-300">
                    A conclusão técnica do processamento e a indexação de requisitos <strong>NÃO</strong> constituem parecer jurídico, atestado de conformidade formal ou garantia de habilitação da proposta. Não declare nem presuma atendimento a nenhum item editalício sem a respectiva prova documental verificada. Todos os requisitos, citações e prazos devem ser revisados e validados por analistas humanos qualificados antes da submissão final.
                  </p>
                </div>
              </div>

              {/* Executive Summary */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sumário Executivo do Edital
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  {extractionResult.executive_summary}
                </p>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Requisitos Obrigatórios</span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {extractionResult.mandatory_requirements.length}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Requisitos Desejáveis</span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {extractionResult.desirable_requirements.length}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Prazos e Marcos</span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {extractionResult.important_dates.length}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Alertas de Revisão</span>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {extractionResult.human_review_warnings.length +
                      allReqs.filter((r) => r.manual_review_required).length}
                  </p>
                </div>
              </div>

              {/* Deadlines Section */}
              {extractionResult.important_dates.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Prazos e Marcos Críticos Identificados
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extractionResult.important_dates.map((dateItem, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {dateItem.title}
                            </p>
                            <Badge variant="outline" className="text-[10px] uppercase mt-1">
                              {dateItem.deadline_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md">
                            {new Date(dateItem.due_date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {dateItem.source_reference && (
                          <p className="text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                            Fonte: Seção "{dateItem.source_reference.section_title || 'N/A'}"
                            {dateItem.source_reference.page_number && ` (Pág. ${dateItem.source_reference.page_number})`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements List with Traceability */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Requisitos Extraídos com Rastreabilidade
                  </p>

                  {/* Filters */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={selectedReqFilter === 'all' ? 'primary' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => setSelectedReqFilter('all')}
                    >
                      Todos ({allReqs.length})
                    </Button>
                    <Button
                      variant={selectedReqFilter === 'mandatory' ? 'primary' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => setSelectedReqFilter('mandatory')}
                    >
                      Obrigatórios ({extractionResult.mandatory_requirements.length})
                    </Button>
                    <Button
                      variant={selectedReqFilter === 'desirable' ? 'primary' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => setSelectedReqFilter('desirable')}
                    >
                      Desejáveis ({extractionResult.desirable_requirements.length})
                    </Button>
                    <Button
                      variant={selectedReqFilter === 'review' ? 'primary' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5 text-amber-600"
                      onClick={() => setSelectedReqFilter('review')}
                    >
                      Revisão ({allReqs.filter((r) => r.manual_review_required).length})
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredReqs.map((req, idx) => {
                    const quoteKey = `${req.reqType}-${idx}`;
                    const isExpanded = !!expandedQuotes[quoteKey];

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          req.manual_review_required
                            ? 'border-amber-200 bg-amber-50/20 dark:border-amber-900/60 dark:bg-amber-950/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={req.reqType === 'mandatory' ? 'default' : 'secondary'}
                                className="text-[10px] uppercase font-semibold"
                              >
                                {req.reqType === 'mandatory' ? 'Obrigatório' : 'Desejável'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {req.category}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  req.confidence_score >= 0.9
                                    ? 'text-emerald-600'
                                    : req.confidence_score >= 0.8
                                    ? 'text-blue-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                Confiança: {Math.round(req.confidence_score * 100)}%
                              </Badge>
                              {req.manual_review_required && (
                                <Badge variant="warning" className="text-[10px]">
                                  Revisão Humana Recomendada
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-1">
                              {req.title}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {req.description}
                            </p>
                          </div>
                        </div>

                        {/* Source Traceability & Literal Citation Box */}
                        {req.source_reference && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                [Pág. {req.source_reference.page_number || 'N/A'} | Seção:{' '}
                                {req.source_reference.section_title || 'Geral'}]
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleQuoteExpansion(quoteKey)}
                                className="text-xs h-7 text-blue-600 dark:text-blue-400 gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <span>{isExpanded ? 'Ocultar Citação' : 'Ver Citação Original do Edital'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            </div>

                            {/* Snippet preview */}
                            {!isExpanded && req.source_reference.snippet && (
                              <p className="text-xs italic text-slate-500 dark:text-slate-400 line-clamp-1 border-l-2 border-slate-300 dark:border-slate-700 pl-2">
                                "{req.source_reference.snippet}"
                              </p>
                            )}

                            {/* Verbatim raw quote expanded */}
                            {isExpanded && (
                              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                                <p className="text-[10px] font-semibold uppercase text-slate-400">
                                  Texto Literal do Documento (Raw Quote)
                                </p>
                                <p className="text-xs font-serif italic text-slate-800 dark:text-slate-200 leading-relaxed">
                                  "{req.source_reference.raw_quote || req.source_reference.snippet}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Missing Information & Ambiguities */}
              {extractionResult.missing_information.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-500" />
                    Lacunas de Informação e Ambiguidades Identificadas
                  </p>
                  <div className="space-y-2">
                    {extractionResult.missing_information.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200"
                      >
                        <p className="font-semibold">{item.topic || (item as any).item}</p>
                        {item.description && <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.description}</p>}
                        <p className="text-amber-800/90 dark:text-amber-300 mt-0.5">
                          <strong>Ação Recomendada:</strong> {item.suggested_human_action || (item as any).suggested_action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Human Review Warnings */}
              {extractionResult.human_review_warnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Alertas Específicos para Revisão Humana
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                    {extractionResult.human_review_warnings.map((warn, idx) => {
                      const isObj = typeof warn === 'object' && warn !== null;
                      const title = isObj ? warn.item_title : String(warn);
                      const reason = isObj ? warn.reason : null;
                      const action = isObj ? warn.recommended_action : null;
                      const severity = isObj ? warn.severity : 'medium';
                      return (
                        <li key={idx} className="space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <Badge
                              variant={severity === 'critical' || severity === 'high' ? 'destructive' : 'warning'}
                              className="text-[9px] uppercase py-0"
                            >
                              {severity}
                            </Badge>
                            <span>{title}</span>
                          </div>
                          {reason && <p className="text-slate-600 dark:text-slate-400 pl-4">{reason}</p>}
                          {action && <p className="text-amber-800 dark:text-amber-300 pl-4 italic">Ação sugerida: {action}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Opportunity Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contexto do Edital e Identificadores</CardTitle>
            <CardDescription>
              Campos para associar o documento a uma oportunidade específica e rastrear prazos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título da Oportunidade / Projeto
                </label>
                <input
                  type="text"
                  placeholder="Ex: Modernização de Sistemas de Radar - FAA"
                  value={tenderTitle}
                  onChange={(e) => setTenderTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Código de Referência do Edital / RFP
                </label>
                <input
                  type="text"
                  placeholder="Ex: RFP-2026-FAA-098"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Órgão Emissor / Autoridade Compradora
              </label>
              <input
                type="text"
                placeholder="Ex: Federal Aviation Administration / Força Aérea"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* File Dropzone Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documento do Edital</CardTitle>
            <CardDescription>
              Formatos suportados: PDF, DOCX ou XLSX (Máximo de 50MB). A integridade binária é verificada no servidor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  if (!/\.(pdf|docx|xlsx)$/i.test(file.name)) {
                    setErrorMessage('Formato inválido. Apenas PDF, DOCX ou XLSX são aceitos.');
                    return;
                  }
                  setSelectedFile(file);
                  setErrorMessage(null);
                  setRequiresOcrNotice(false);
                }
              }}
            >
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Arraste e solte o arquivo do edital ou clique para navegar
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF (com texto digital), DOCX ou planilhas XLSX (Até 50MB)
                  </p>
                </div>
                <input
                  type="file"
                  id="tenderFileInput"
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('tenderFileInput')?.click()}
                >
                  Selecionar Arquivo
                </Button>
              </div>

              {selectedFile && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-rose-600 hover:text-rose-700"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              setSelectedFile(null);
              setErrorMessage(null);
              setExtractionResult(null);
              setProcessingState('idle');
            }}
          >
            Limpar
          </Button>
          <Button
            type="submit"
            disabled={
              !selectedFile ||
              isSubmitting ||
              (quotaInfo !== null && !quotaInfo.allowed) ||
              ['validating', 'parsing', 'extracting'].includes(processingState)
            }
            className="gap-2 shadow-sm"
          >
            {isSubmitting || ['validating', 'parsing', 'extracting'].includes(processingState) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando Documento...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Iniciar Extração e Análise</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Previous Analyses History Section (Recuperação de Análises Anteriores) */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Histórico de Análises Anteriores</CardTitle>
              <CardDescription>
                Consulte e recupere relatórios estruturados de editais processados previamente pela organização.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPreviousAnalyses}
              disabled={isLoadingHistory}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Atualizar Histórico</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8 text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Consultando registros de análises no Supabase...</span>
            </div>
          ) : previousDocs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Nenhuma análise anterior registrada para esta organização. Envie seu primeiro edital acima.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {previousDocs.map((doc) => {
                const docName = doc.file_name || doc.fileName || 'Documento';
                const docDate = doc.created_at || doc.createdAt;
                const isSelected = processedDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20 -mx-4 px-4 rounded-lg' : ''
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {docName}
                        </span>
                        <Badge
                          variant={
                            doc.status === 'failed'
                              ? 'destructive'
                              : doc.status === 'review_required'
                              ? 'warning'
                              : 'success'
                          }
                          className="text-[10px] capitalize"
                        >
                          {doc.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        UUID: {doc.id} {docDate && `• ${new Date(docDate).toLocaleString('pt-BR')}`}
                      </p>
                    </div>

                    <Button
                      variant={isSelected ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => loadPastAnalysis(doc.id)}
                      className="text-xs h-8 whitespace-nowrap gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'Análise Carregada' : 'Visualizar Análise'}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
