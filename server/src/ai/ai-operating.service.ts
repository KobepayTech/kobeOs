import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KobeAgentService } from './agent.service';
import {
  AiApprovalRequest,
  AiDashboardSpec,
  AiInsight,
  AiMemoryEdge,
  AiMemoryNode,
  AiOperatingAudit,
  AiSkillInstall,
  AiWorkflowPlan,
  AiWorkflowStep,
} from './ai-operating.entity';
import { SearchDoc } from '../search/search.entity';

export interface KobeSkillPack {
  id: string;
  name: string;
  description: string;
  domains: string[];
  skills: string[];
  knowledge: string[];
  recommendedRoles: string[];
  defaultInstalled?: boolean;
}

const SKILL_PACKS: KobeSkillPack[] = [
  {
    id: 'core-operator',
    name: 'Kobe Core Operator',
    description: 'Cross-module search, business memory, diagnostics, command execution and safe confirmations.',
    domains: ['general'],
    skills: ['semantic_search', 'search_documents', 'remember', 'diagnose_system', 'configure_automation'],
    knowledge: ['KobeOS operating procedures'],
    recommendedRoles: ['admin', 'user'],
    defaultInstalled: true,
  },
  {
    id: 'accountant',
    name: 'Kobe Accountant',
    description: 'Sales, expenses, forecasts, reconciliation, management reporting and month-end workflows.',
    domains: ['finance', 'erp'],
    skills: ['sales_today', 'expenses_summary', 'sales_forecast', 'record_expense'],
    knowledge: ['chart of accounts', 'tax rules', 'company finance policies'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'hotel-manager',
    name: 'Hotel Manager',
    description: 'Occupancy, revenue, bookings, room status, guest operations and hotel decision support.',
    domains: ['hotels'],
    skills: ['hotel_occupancy', 'hotel_revenue', 'create_booking', 'set_room_status'],
    knowledge: ['hotel SOPs', 'rate policies', 'guest policies'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'property-manager',
    name: 'Property Manager',
    description: 'Tenants, rent, arrears, projections, communications and property operations.',
    domains: ['properties'],
    skills: ['unpaid_tenants', 'rent_projection', 'set_rent', 'add_tenant', 'record_rent_payment', 'send_tenant_notification'],
    knowledge: ['leases', 'rent policies', 'property SOPs'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'retail-manager',
    name: 'Retail & Inventory Manager',
    description: 'Sales, product performance, stock, purchasing signals and catalogue operations.',
    domains: ['shop', 'inventory'],
    skills: ['sales_today', 'low_stock', 'top_rated_products', 'warehouse_stock', 'adjust_stock', 'add_product'],
    knowledge: ['supplier catalogues', 'pricing policy', 'inventory SOPs'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'cargo-manager',
    name: 'Cargo Manager',
    description: 'Shipment visibility, parcel exceptions, warehouse follow-up and logistics operating support.',
    domains: ['cargo'],
    skills: ['cargo_status'],
    knowledge: ['cargo SOPs', 'route rules', 'claims procedures'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'sacco-credit',
    name: 'SACCO Credit Officer',
    description: 'Member lending, collateral, sponsor logic, approvals, repayments and capital planning.',
    domains: ['sacco', 'finance'],
    skills: ['semantic_search', 'search_documents'],
    knowledge: ['SACCO lending policy', 'member shares', 'loan committee rules'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'recruitment',
    name: 'Recruitment Officer',
    description: 'Applicant screening, document completeness, employer workflows and recruitment operations.',
    domains: ['recruitment'],
    skills: ['semantic_search', 'search_documents'],
    knowledge: ['job descriptions', 'screening policy', 'employment requirements'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'creator-growth',
    name: 'Creator Campaign Analyst',
    description: 'Creator performance, campaign reasoning, audience fit and commercial recommendations.',
    domains: ['creators', 'marketing'],
    skills: ['semantic_search', 'search_documents'],
    knowledge: ['campaign briefs', 'brand rules', 'creator performance history'],
    recommendedRoles: ['admin', 'user'],
  },
  {
    id: 'school-admin',
    name: 'School Administrator',
    description: 'School operations, student records, attendance, payments, reports and parent-service workflows.',
    domains: ['school'],
    skills: ['semantic_search', 'search_documents'],
    knowledge: ['school policies', 'timetables', 'student procedures'],
    recommendedRoles: ['admin', 'user'],
  },
];

const ROLE_WRITE_DENY = new Set(['government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement']);

@Injectable()
export class AiOperatingService {
  constructor(
    @InjectRepository(AiSkillInstall) private readonly installs: Repository<AiSkillInstall>,
    @InjectRepository(AiMemoryNode) private readonly nodes: Repository<AiMemoryNode>,
    @InjectRepository(AiMemoryEdge) private readonly edges: Repository<AiMemoryEdge>,
    @InjectRepository(AiWorkflowPlan) private readonly workflows: Repository<AiWorkflowPlan>,
    @InjectRepository(AiApprovalRequest) private readonly approvals: Repository<AiApprovalRequest>,
    @InjectRepository(AiOperatingAudit) private readonly audits: Repository<AiOperatingAudit>,
    @InjectRepository(AiDashboardSpec) private readonly dashboards: Repository<AiDashboardSpec>,
    @InjectRepository(AiInsight) private readonly insights: Repository<AiInsight>,
    @InjectRepository(SearchDoc) private readonly searchDocs: Repository<SearchDoc>,
    private readonly agent: KobeAgentService,
  ) {}

  skillCatalogue() { return SKILL_PACKS; }

  async installedSkills(ownerId: string) {
    const installed = await this.installs.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
    const explicit = new Map(installed.map((row) => [row.skillId, row]));
    return SKILL_PACKS.map((pack) => ({
      ...pack,
      installed: explicit.get(pack.id)?.enabled ?? Boolean(pack.defaultInstalled),
      config: explicit.get(pack.id)?.config ?? {},
    }));
  }

  async installSkill(ownerId: string, skillId: string, config: Record<string, unknown> = {}) {
    const pack = SKILL_PACKS.find((item) => item.id === skillId);
    if (!pack) throw new NotFoundException('AI skill pack not found');
    let row = await this.installs.findOne({ where: { ownerId, skillId } });
    if (!row) row = this.installs.create({ ownerId, skillId, enabled: true, config, installedAt: new Date() });
    row.enabled = true;
    row.config = config;
    row.installedAt = row.installedAt ?? new Date();
    await this.installs.save(row);
    await this.audit(ownerId, null, 'admin', 'SKILL_INSTALLED', 'ai', skillId, '', '', 1, [], { skillId });
    return { ...pack, installed: true, config };
  }

  async uninstallSkill(ownerId: string, skillId: string) {
    if (skillId === 'core-operator') throw new BadRequestException('Kobe Core Operator is required');
    let row = await this.installs.findOne({ where: { ownerId, skillId } });
    if (!row) row = this.installs.create({ ownerId, skillId, enabled: false, config: {} });
    row.enabled = false;
    await this.installs.save(row);
    await this.audit(ownerId, null, 'admin', 'SKILL_DISABLED', 'ai', skillId, '', '', 1, [], { skillId });
    return { skillId, installed: false };
  }

  async allowedToolNames(ownerId: string, role = 'user') {
    if (ROLE_WRITE_DENY.has(role)) {
      return new Set(this.agent.listSkills().filter((skill) => !skill.write).map((skill) => skill.name));
    }
    const installed = await this.installedSkills(ownerId);
    const enabledPacks = installed.filter((pack) => pack.installed);
    const names = new Set(enabledPacks.flatMap((pack) => pack.skills));
    // Existing KobeOS tools remain available to owner/admin until a pack explicitly
    // takes ownership of them; this keeps upgrades backward compatible.
    for (const skill of this.agent.listSkills()) {
      if (skill.domains?.includes('shared') || role === 'admin') names.add(skill.name);
    }
    return names;
  }

  async upsertMemoryNode(ownerId: string, input: {
    nodeType: string; externalKey: string; label: string; attributes?: Record<string, unknown>;
    confidence?: number; source?: string;
  }) {
    const nodeType = input.nodeType.trim().slice(0, 60);
    const externalKey = input.externalKey.trim().slice(0, 160);
    if (!nodeType || !externalKey) throw new BadRequestException('nodeType and externalKey are required');
    let node = await this.nodes.findOne({ where: { ownerId, nodeType, externalKey } });
    if (!node) node = this.nodes.create({ ownerId, nodeType, externalKey, label: input.label, attributes: {}, confidence: 1, source: 'user' });
    node.label = input.label.trim().slice(0, 220) || node.label;
    node.attributes = { ...(node.attributes || {}), ...(input.attributes || {}) };
    node.confidence = Math.max(0, Math.min(1, input.confidence ?? node.confidence ?? 1));
    node.source = input.source || node.source || 'user';
    node.lastVerifiedAt = new Date();
    return this.nodes.save(node);
  }

  async linkMemory(ownerId: string, input: {
    fromNodeId: string; relation: string; toNodeId: string; attributes?: Record<string, unknown>; confidence?: number;
  }) {
    const [from, to] = await Promise.all([
      this.nodes.findOne({ where: { ownerId, id: input.fromNodeId } }),
      this.nodes.findOne({ where: { ownerId, id: input.toNodeId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Memory node not found');
    let edge = await this.edges.findOne({ where: { ownerId, fromNodeId: from.id, relation: input.relation, toNodeId: to.id } });
    if (!edge) edge = this.edges.create({ ownerId, fromNodeId: from.id, relation: input.relation, toNodeId: to.id, attributes: {}, confidence: 1 });
    edge.attributes = { ...(edge.attributes || {}), ...(input.attributes || {}) };
    edge.confidence = Math.max(0, Math.min(1, input.confidence ?? edge.confidence ?? 1));
    return this.edges.save(edge);
  }

  async memoryGraph(ownerId: string, query?: string) {
    const nodes = await this.nodes.find({ where: { ownerId }, order: { updatedAt: 'DESC' }, take: 500 });
    const filtered = query
      ? nodes.filter((node) => JSON.stringify(node).toLowerCase().includes(query.toLowerCase())).slice(0, 100)
      : nodes;
    const ids = filtered.map((node) => node.id);
    const edges = ids.length
      ? await this.edges.find({ where: [{ ownerId, fromNodeId: In(ids) }, { ownerId, toNodeId: In(ids) }], take: 1000 })
      : [];
    return { nodes: filtered, edges };
  }

  async learnCorrection(ownerId: string, correction: { subject: string; previous?: string; corrected: string; category?: string }) {
    const subject = correction.subject.trim();
    const node = await this.upsertMemoryNode(ownerId, {
      nodeType: correction.category || 'correction',
      externalKey: subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120) || 'correction',
      label: subject,
      attributes: { previous: correction.previous || '', corrected: correction.corrected, learnedAt: new Date().toISOString() },
      confidence: 1,
      source: 'human-correction',
    });
    await this.audit(ownerId, null, 'user', 'CORRECTION_LEARNED', 'memory', subject, '', '', 1, [], { nodeId: node.id });
    return node;
  }

  private approvalChain(actorRole: string, amount?: number, highRisk = false) {
    const needsAdmin = highRisk || Number(amount || 0) >= 1_000_000;
    if (actorRole === 'admin') {
      return [{ role: 'admin', label: needsAdmin ? 'Owner / admin approval' : 'Business approval', status: 'PENDING' as const }];
    }
    return needsAdmin
      ? [
          { role: actorRole || 'user', label: 'Requesting manager approval', status: 'PENDING' as const },
          { role: 'admin', label: 'Owner / admin approval', status: 'PENDING' as const },
        ]
      : [{ role: actorRole || 'user', label: 'Business approval', status: 'PENDING' as const }];
  }

  async createWorkflow(ownerId: string, objective: string, context: Record<string, unknown> = {}) {
    const clean = objective.trim();
    if (!clean) throw new BadRequestException('Workflow objective is required');
    const skills = this.agent.listSkills();
    const terms = clean.toLowerCase();
    const candidates = skills
      .filter((skill) => skill.description.toLowerCase().split(/[^a-z0-9]+/).some((term) => term.length > 4 && terms.includes(term)))
      .slice(0, 4);
    const steps: AiWorkflowStep[] = [
      { id: 'gather', title: 'Gather verified data', description: `Gather the KobeOS data needed for: ${clean}`, type: 'READ', status: 'PENDING' },
      { id: 'analyse', title: 'Analyse and identify exceptions', description: `Analyse the verified data and explain the important risks, reasons and options for: ${clean}`, type: 'ANALYSE', status: 'PENDING' },
    ];
    for (const skill of candidates.filter((item) => item.write).slice(0, 1)) {
      steps.push({ id: `action-${skill.name}`, title: `Prepare ${skill.name.replace(/_/g, ' ')}`, description: skill.description, type: 'ACTION', tool: skill.name, status: 'PENDING' });
      steps.push({ id: 'approval', title: 'Human approval', description: 'Review and approve the proposed business action before execution.', type: 'APPROVAL', status: 'PENDING' });
    }
    steps.push({ id: 'output', title: 'Deliver result', description: 'Produce the final concise outcome, evidence and next actions.', type: 'OUTPUT', status: 'PENDING' });
    const highRisk = /pay|transfer|delete|refund|loan|salary|tax|legal|terminate|send/i.test(clean);
    const plan = await this.workflows.save(this.workflows.create({
      ownerId,
      title: clean.slice(0, 160),
      objective: clean,
      status: highRisk || steps.some((step) => step.type === 'ACTION') ? 'APPROVAL_REQUIRED' : 'DRAFT',
      steps,
      context,
      riskLevel: highRisk ? 'high' : steps.some((step) => step.type === 'ACTION') ? 'medium' : 'low',
      confidence: candidates.length ? 0.78 : 0.58,
      currentStep: 0,
      summary: '',
    }));
    await this.audit(ownerId, null, 'user', 'WORKFLOW_CREATED', 'workflow', plan.title, '', '', plan.confidence, [], { workflowId: plan.id });
    return plan;
  }

  async listWorkflows(ownerId: string) {
    return this.workflows.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async updateWorkflow(ownerId: string, id: string, patch: Partial<Pick<AiWorkflowPlan, 'title' | 'objective' | 'steps' | 'context'>>) {
    const plan = await this.workflows.findOne({ where: { ownerId, id } });
    if (!plan) throw new NotFoundException('Workflow not found');
    if (!['DRAFT', 'APPROVAL_REQUIRED'].includes(plan.status)) throw new BadRequestException('Only draft workflows can be edited');
    if (patch.title !== undefined) plan.title = patch.title.slice(0, 160);
    if (patch.objective !== undefined) plan.objective = patch.objective.slice(0, 4000);
    if (patch.steps !== undefined) plan.steps = patch.steps;
    if (patch.context !== undefined) plan.context = patch.context;
    return this.workflows.save(plan);
  }

  async approveWorkflow(ownerId: string, id: string, actorId: string, actorRole: string) {
    const plan = await this.workflows.findOne({ where: { ownerId, id } });
    if (!plan) throw new NotFoundException('Workflow not found');
    if (ROLE_WRITE_DENY.has(actorRole)) throw new BadRequestException('This role cannot approve business AI workflows');
    plan.status = 'RUNNING';
    plan.approvedAt = new Date();
    await this.workflows.save(plan);
    await this.audit(ownerId, actorId, actorRole, 'WORKFLOW_APPROVED', 'workflow', plan.title, '', '', plan.confidence, [], { workflowId: plan.id });
    return plan;
  }

  async executeWorkflow(ownerId: string, id: string, actorId: string, actorRole: string) {
    const plan = await this.workflows.findOne({ where: { ownerId, id } });
    if (!plan) throw new NotFoundException('Workflow not found');
    if (plan.status === 'APPROVAL_REQUIRED') throw new BadRequestException('Approve this workflow first');
    if (!['RUNNING', 'DRAFT'].includes(plan.status)) throw new BadRequestException('Workflow cannot be executed in its current status');
    plan.status = 'RUNNING';
    await this.workflows.save(plan);
    let summary = '';
    for (let i = plan.currentStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      step.status = 'RUNNING';
      plan.currentStep = i;
      await this.workflows.save(plan);
      if (step.type === 'APPROVAL') {
        const approval = await this.createApproval(ownerId, {
          workflowId: plan.id,
          actionType: 'workflow_step',
          summary: `Approve workflow “${plan.title}” to continue`,
          payload: { workflowId: plan.id, stepId: step.id },
          chain: this.approvalChain(actorRole, undefined, plan.riskLevel === 'high'),
        });
        step.status = 'PENDING';
        plan.status = 'APPROVAL_REQUIRED';
        plan.summary = `Awaiting approval: ${approval.summary}`;
        await this.workflows.save(plan);
        return { plan, approval };
      }
      const response = await this.agent.run(ownerId, `${step.description}\nWorkflow objective: ${plan.objective}`, [], 'quality');
      step.result = { reply: response.reply, data: response.data, used: response.used };
      summary = response.reply;
      if (response.pendingAction) {
        const actionAmount = Number(response.pendingAction.args?.amount || response.pendingAction.args?.total || 0) || undefined;
        const approval = await this.createApproval(ownerId, {
          workflowId: plan.id,
          actionType: response.pendingAction.tool,
          summary: response.pendingAction.summary,
          payload: response.pendingAction,
          amount: actionAmount,
          currency: String(response.pendingAction.args?.currency || 'TZS'),
          chain: this.approvalChain(actorRole, actionAmount, plan.riskLevel === 'high'),
        });
        step.status = 'DONE';
        plan.status = 'APPROVAL_REQUIRED';
        plan.summary = response.pendingAction.summary;
        plan.currentStep = i + 1;
        await this.workflows.save(plan);
        return { plan, approval };
      }
      step.status = 'DONE';
      plan.currentStep = i + 1;
      await this.workflows.save(plan);
    }
    plan.status = 'COMPLETED';
    plan.completedAt = new Date();
    plan.summary = summary || 'Workflow completed.';
    await this.workflows.save(plan);
    await this.audit(ownerId, actorId, actorRole, 'WORKFLOW_COMPLETED', 'workflow', plan.title, '', '', plan.confidence, [], { workflowId: plan.id });
    return { plan };
  }

  async createApproval(ownerId: string, input: {
    workflowId?: string; actionType: string; summary: string; payload?: Record<string, unknown>;
    chain?: Array<{ role: string; label: string; status?: 'PENDING' | 'APPROVED' | 'REJECTED' }>;
    amount?: number; currency?: string;
  }) {
    const chain = (input.chain?.length ? input.chain : [{ role: 'admin', label: 'Owner approval', status: 'PENDING' }])
      .map((step) => ({ ...step, status: step.status || 'PENDING' as const }));
    return this.approvals.save(this.approvals.create({
      ownerId,
      workflowId: input.workflowId || null,
      actionType: input.actionType,
      summary: input.summary,
      payload: input.payload || {},
      chain,
      currentStep: 0,
      status: 'PENDING',
      amount: input.amount != null ? String(input.amount) : null,
      currency: input.currency || 'TZS',
    }));
  }

  async listApprovals(ownerId: string) {
    return this.approvals.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  async decideApproval(ownerId: string, id: string, actorId: string, actorRole: string, decision: 'approve' | 'reject', note = '') {
    const request = await this.approvals.findOne({ where: { ownerId, id } });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Approval request is already decided');
    const step = request.chain[request.currentStep];
    if (!step) throw new BadRequestException('Approval chain is invalid');
    if (actorRole !== 'admin' && step.role !== actorRole) throw new BadRequestException(`Current approval requires role: ${step.role}`);
    step.status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    step.actorId = actorId;
    step.actedAt = new Date().toISOString();
    step.note = note;
    if (decision === 'reject') {
      request.status = 'REJECTED';
      request.decidedAt = new Date();
    } else if (request.currentStep < request.chain.length - 1) {
      request.currentStep += 1;
    } else {
      request.status = 'APPROVED';
      request.decidedAt = new Date();
    }
    request.chain = [...request.chain];
    await this.approvals.save(request);
    let execution: unknown = null;
    if (request.status === 'APPROVED' && request.payload?.tool) {
      execution = await this.agent.execute(ownerId, {
        tool: String(request.payload.tool),
        args: (request.payload.args as Record<string, unknown>) || {},
      });
    }
    if (request.status === 'APPROVED' && request.workflowId) {
      const plan = await this.workflows.findOne({ where: { ownerId, id: request.workflowId } });
      if (plan && plan.status === 'APPROVAL_REQUIRED') {
        plan.status = 'RUNNING';
        plan.currentStep = Math.max(plan.currentStep, plan.steps.findIndex((item) => item.type === 'APPROVAL') + 1);
        await this.workflows.save(plan);
      }
    }
    await this.audit(ownerId, actorId, actorRole, `APPROVAL_${request.status}`, 'approval', request.summary, '', request.actionType, 1, [], { approvalId: request.id, execution });
    return { request, execution };
  }

  async createDashboard(ownerId: string, prompt: string) {
    const q = prompt.toLowerCase();
    const widgets: Array<Record<string, unknown>> = [];
    const add = (id: string, title: string, source: string, visualization: string) => widgets.push({ id, title, source, visualization });
    if (/sales|revenue|business|dashboard/.test(q)) add('sales', 'Sales', 'sales_today', 'kpi');
    if (/expense|profit|finance|business|dashboard/.test(q)) add('expenses', 'Expenses', 'expenses_summary', 'kpi');
    if (/rent|property|business|dashboard/.test(q)) add('rent', 'Outstanding rent', 'unpaid_tenants', 'kpi');
    if (/hotel|occupancy|business|dashboard/.test(q)) add('hotel', 'Hotel occupancy', 'hotel_occupancy', 'gauge');
    if (/stock|inventory|business|dashboard/.test(q)) add('stock', 'Low stock', 'low_stock', 'table');
    if (/cargo|parcel|business|dashboard/.test(q)) add('cargo', 'Cargo status', 'cargo_status', 'donut');
    if (!widgets.length) add('sales', 'Sales', 'sales_today', 'kpi');
    const dashboard = await this.dashboards.save(this.dashboards.create({
      ownerId,
      name: prompt.trim().slice(0, 160) || 'Kobe AI Dashboard',
      description: 'Generated by Kobe from the requested operating metrics.',
      widgets,
      filters: {},
      createdByAi: true,
    }));
    await this.audit(ownerId, null, 'user', 'DASHBOARD_GENERATED', 'dashboard', dashboard.name, '', '', 1, [], {
      dashboardId: dashboard.id,
      widgets: dashboard.widgets.map((widget) => widget.source),
    });
    return dashboard;
  }

  async listDashboards(ownerId: string) {
    return this.dashboards.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async renderDashboard(ownerId: string, id: string) {
    const dashboard = await this.dashboards.findOne({ where: { ownerId, id } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    const prompts: Record<string, string> = {
      sales_today: 'What are today’s sales?',
      expenses_summary: 'How much did I spend this month?',
      unpaid_tenants: 'How many tenants have unpaid rent?',
      hotel_occupancy: 'What is my hotel occupancy right now?',
      low_stock: 'Show me low stock items.',
      cargo_status: 'What is my cargo status?',
      business_health: 'Give me my overall business health.',
    };
    const widgets = await Promise.all(dashboard.widgets.map(async (widget) => {
      const source = String(widget.source || '');
      const prompt = prompts[source] || `Give me the current verified value for ${String(widget.title || source)}.`;
      try {
        const result = await this.agent.run(ownerId, prompt, [], 'fast');
        return {
          ...widget,
          summary: result.reply,
          data: result.data,
          confidence: result.confidence,
          citations: result.citations,
          needsVerification: result.needsVerification,
        };
      } catch (error) {
        return { ...widget, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    await this.audit(ownerId, null, 'user', 'DASHBOARD_RENDERED', 'dashboard', dashboard.name, '', '', 1, [], {
      dashboardId: dashboard.id,
      widgetCount: widgets.length,
    });
    return { dashboard, widgets, generatedAt: new Date().toISOString() };
  }

  async simulate(ownerId: string, scenario: {
    salesChangePct?: number; expenseChangePct?: number; rentCollectionChangePct?: number; roomRateChangePct?: number;
  }) {
    const [sales, expenses, rent, hotel] = await Promise.all([
      this.agent.run(ownerId, 'What are today’s sales?', [], 'fast'),
      this.agent.run(ownerId, 'How much did I spend this month?', [], 'fast'),
      this.agent.run(ownerId, 'What is my monthly rent projection?', [], 'fast'),
      this.agent.run(ownerId, 'What is this month hotel revenue?', [], 'fast'),
    ]);
    const data = (reply: { data?: unknown }) => (reply.data && typeof reply.data === 'object' ? reply.data as Record<string, unknown> : {});
    const s = data(sales); const e = data(expenses); const r = data(rent); const h = data(hotel);
    const num = (value: unknown) => Number(value || 0);
    const baseline = {
      sales: num(s.total),
      expenses: num(e.total),
      monthlyRent: num(r.monthly),
      hotelRevenue: num(h.revenue),
    };
    const projected = {
      sales: baseline.sales * (1 + (scenario.salesChangePct || 0) / 100),
      expenses: baseline.expenses * (1 + (scenario.expenseChangePct || 0) / 100),
      monthlyRent: baseline.monthlyRent * (1 + (scenario.rentCollectionChangePct || 0) / 100),
      hotelRevenue: baseline.hotelRevenue * (1 + (scenario.roomRateChangePct || 0) / 100),
    };
    const baselineNet = baseline.sales + baseline.monthlyRent + baseline.hotelRevenue - baseline.expenses;
    const projectedNet = projected.sales + projected.monthlyRent + projected.hotelRevenue - projected.expenses;
    const result = {
      currency: 'TZS',
      baseline,
      scenario,
      projected,
      baselineNet,
      projectedNet,
      netChange: projectedNet - baselineNet,
      confidence: 0.65,
      note: 'Scenario uses current KobeOS operating values and simple percentage sensitivities; it is a planning model, not a guarantee.',
    };
    await this.audit(ownerId, null, 'user', 'BUSINESS_SIMULATION', 'simulation', 'scenario', '', 'business_health', result.confidence, [
      { kind: 'tool', label: 'sales_today', ref: 'sales_today' },
      { kind: 'tool', label: 'expenses_summary', ref: 'expenses_summary' },
      { kind: 'tool', label: 'rent_projection', ref: 'rent_projection' },
      { kind: 'tool', label: 'hotel_revenue', ref: 'hotel_revenue' },
    ], { scenario, baseline, projected, netChange: result.netChange });
    return result;
  }

  async refreshInsights(ownerId: string) {
    const briefing = await this.agent.briefing(ownerId);
    const saved: AiInsight[] = [];
    for (const alert of briefing.alerts || []) {
      const dedupeKey = `${alert.severity}:${alert.text}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120);
      let row = await this.insights.findOne({ where: { ownerId, dedupeKey } });
      const wasNew = !row;
      if (!row) row = this.insights.create({ ownerId, dedupeKey, insightType: 'business_alert', severity: alert.severity === 'warning' ? 'warning' : 'info', title: 'Kobe noticed something', summary: alert.text, evidence: {}, status: 'OPEN' });
      row.summary = alert.text;
      row.severity = alert.severity === 'warning' ? 'warning' : 'info';
      if (row.status === 'RESOLVED') row.status = 'OPEN';
      const stored = await this.insights.save(row);
      saved.push(stored);
      if (wasNew) {
        await this.audit(ownerId, null, 'system', 'PROACTIVE_INSIGHT_CREATED', 'insights', stored.summary.slice(0, 500), '', '', alert.severity === 'warning' ? 0.9 : 0.8, [], {
          insightId: stored.id,
          severity: stored.severity,
        });
      }
    }
    return saved;
  }

  async listInsights(ownerId: string) {
    return this.insights.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async setInsightStatus(ownerId: string, id: string, status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED') {
    const row = await this.insights.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Insight not found');
    row.status = status;
    row.resolvedAt = status === 'RESOLVED' ? new Date() : null;
    return this.insights.save(row);
  }

  @Cron('17 * * * *')
  async refreshKnownBusinesses() {
    const rows = await this.searchDocs.createQueryBuilder('doc')
      .select('DISTINCT doc.ownerId', 'ownerId')
      .limit(100)
      .getRawMany<{ ownerId: string }>();
    for (const row of rows) {
      await this.refreshInsights(row.ownerId).catch(() => undefined);
    }
  }

  async audit(
    ownerId: string, actorId: string | null, actorRole: string, eventType: string,
    module: string, action: string, model: string, tool: string, confidence: number,
    citations: Array<Record<string, unknown>>, metadata: Record<string, unknown>,
  ) {
    return this.audits.save(this.audits.create({
      ownerId, actorId, actorRole, eventType, module, action, model, tool,
      confidence: Math.max(0, Math.min(1, confidence || 0)), citations, metadata,
    }));
  }

  async listAudit(ownerId: string) {
    return this.audits.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  async adminSummary(ownerId: string) {
    const [skills, workflows, approvals, nodes, dashboards, insights, audits, docs] = await Promise.all([
      this.installedSkills(ownerId),
      this.workflows.count({ where: { ownerId } }),
      this.approvals.count({ where: { ownerId, status: 'PENDING' } }),
      this.nodes.count({ where: { ownerId } }),
      this.dashboards.count({ where: { ownerId } }),
      this.insights.count({ where: { ownerId, status: 'OPEN' } }),
      this.audits.count({ where: { ownerId } }),
      this.searchDocs.count({ where: { ownerId } }),
    ]);
    return {
      installedSkillPacks: skills.filter((item) => item.installed).length,
      availableSkillPacks: skills.length,
      workflows,
      pendingApprovals: approvals,
      memoryNodes: nodes,
      dashboards,
      openInsights: insights,
      auditEvents: audits,
      indexedBusinessRecords: docs,
    };
  }
}
