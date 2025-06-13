import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { GitService } from '../../git.service';

// CVSS-aligned Security Answers Model
class CVSSSecurityAnswers {
  // Project Information
  projectName: string = '';
  repoType: 'public' | 'private' | '' = '';
  githubURL: string = '';
  gitlabURL: string = '';
  gitlabToken: string = '';
  githubToken: string = '';
  projectObjective: string = '';
  stakeholders: string = '';
  email: string = '';

  // CVSS Base Metrics - Exploitability
  attackVector?: 'network' | 'adjacent' | 'local' | 'physical'; // AV
  attackComplexity?: 'low' | 'high' ; // AC
  privilegesRequired?: 'none' | 'low' | 'high' ; // PR
  userInteraction?: 'none' | 'required' ; // UI
  scope?: 'unchanged' | 'changed' ; // S

  // CVSS Base Metrics - Impact
  confidentialityImpact?: 'none' | 'low' | 'high' ; // C
  integrityImpact?: 'none' | 'low' | 'high' ; // I
  availabilityImpact?: 'none' | 'low' | 'high' ; // A

  // CVSS Temporal Metrics
  exploitCodeMaturity?: 'not-defined' | 'unproven' | 'proof-of-concept' | 'functional' | 'high' ;
  remediationLevel?: 'not-defined' | 'official-fix' | 'temporary-fix' | 'workaround' | 'unavailable' ;
  reportConfidence?: 'not-defined' | 'unknown' | 'reasonable' | 'confirmed' ;

  // CVSS Environmental Metrics
  modifiedAttackVector?: 'not-defined' | 'network' | 'adjacent' | 'local' | 'physical' | '' = '';
  modifiedAttackComplexity?: 'not-defined' | 'low' | 'high' | '' = '';
  modifiedPrivilegesRequired?: 'not-defined' | 'none' | 'low' | 'high' | '' = '';
  modifiedUserInteraction?: 'not-defined' | 'none' | 'required' | '' = '';
  modifiedScope?: 'not-defined' | 'unchanged' | 'changed' | '' = '';
  modifiedConfidentiality?: 'not-defined' | 'none' | 'low' | 'high' | '' = '';
  modifiedIntegrity?: 'not-defined' | 'none' | 'low' | 'high' | '' = '';
  modifiedAvailability?: 'not-defined' | 'none' | 'low' | 'high' | '' = '';

  // Security Practice Questions (mapped to CVSS context)
  mfa: 'yes' | 'no' | '' = ''; // Maps to Privileges Required
  gitProtection: 'yes' | 'no' | '' = ''; // Maps to Attack Complexity
  secretsManagement: 'yes' | 'no' | '' = ''; // Maps to Confidentiality Impact
  staticAnalysis: 'yes' | 'no' | '' = ''; // Maps to Exploit Code Maturity
  dynamicAnalysis: 'yes' | 'no' | '' = ''; // Maps to Exploit Code Maturity
  scaTools: 'yes' | 'no' | '' = ''; // Maps to Remediation Level
  vulnerabilityScans: 'yes' | 'no' | '' = ''; // Maps to Report Confidence
  scanFrequency: 'weekly' | 'monthly' | 'quarterly' | 'never' | '' = '';
  identifiedVulnerabilities: 'yes' | 'no' | '' = '';
  vulnerabilitySeverity: 'critical' | 'high' | 'medium' | 'low' | 'none' | '' = '';
  patchingFrequency: 'immediate' | 'weekly' | 'monthly' | 'quarterly' | 'never' | '' = '';
  monitoringTools: 'yes' | 'no' | '' = '';
  contingencyPlan: 'yes' | 'no' | '' = '';
  complianceStandards: string = '';
  securityTraining: 'yes' | 'no' | '' = '';
  trainingFrequency: 'monthly' | 'quarterly' | 'annually' | 'never' | '' = '';
   // Additional CVSS-aligned questions
  exploitMitigation: 'yes' | 'no' | '' = ''; // ASLR, DEP, CSP, etc.
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted' | '' = '';
  networkSegmentation: 'yes' | 'no' | '' = '';
  accessControlModel: 'none' | 'basic' | 'rbac' | 'abac' | '' = '';
  // Security Measures (composite)
  securityMeasures = {
    accessControl: false,
    encryption: false,
    audits: false,
    networkSecurity: false,
    incidentResponse: false
  };

  // Environmental Context
  projectCriticality: 'low' | 'medium' | 'high' | 'critical' | '' = '';
  hostingEnvironment: 'cloud' | 'on-premise' | 'hybrid' | '' = '';
  teamExperience: 'junior' | 'intermediate' | 'senior' | 'expert' | '' = '';
}
interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  dueDate?: Date;
}

interface CVSSScores {
  baseScore: number;
  temporalScore: number;
  environmentalScore: number;
  exploitabilityScore: number;
  impactScore: number;
  overallRiskScore: number;
}

interface CVSSRiskCategory {
  name: string;
  score: number;
  maxScore: number;
  status: 'success' | 'warning' | 'danger';
  metrics: string[];
  weight: number;
}

interface SecurityRecommendation {
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cvssImpact: number;
  timeline: string;
  effort: 'low' | 'medium' | 'high';
  affectedMetrics: string[];
}

@Component({
  selector: 'app-evaluation',
  templateUrl: './evaluation.component.html',
  styleUrls: ['./evaluation.component.scss']
})
export class EvaluationComponent implements OnInit {
  
  answers: CVSSSecurityAnswers = new CVSSSecurityAnswers();
  cvssScores: CVSSScores = {
    baseScore: 0,
    temporalScore: 0,
    environmentalScore: 0,
    exploitabilityScore: 0,
    impactScore: 0,
    overallRiskScore: 0
  };

  // CVSS Risk Categories with weights
  riskCategories: CVSSRiskCategory[] = [
    { 
      name: 'Exploitability', 
      score: 0, 
      maxScore: 10, 
      status: 'success',
      metrics: ['Attack Vector', 'Attack Complexity', 'Privileges Required', 'User Interaction'],
      weight: 0.3
    },
    { 
      name: 'Impact', 
      score: 0, 
      maxScore: 10, 
      status: 'success',
      metrics: ['Confidentiality', 'Integrity', 'Availability', 'Scope'],
      weight: 0.4
    },
    { 
      name: 'Temporal', 
      score: 0, 
      maxScore: 10, 
      status: 'success',
      metrics: ['Exploit Code Maturity', 'Remediation Level', 'Report Confidence'],
      weight: 0.2
    },
    { 
      name: 'Environmental', 
      score: 0, 
      maxScore: 10, 
      status: 'success',
      metrics: ['Modified Base Metrics', 'Requirements', 'Project Context'],
      weight: 0.1
    }
  ];

  // Add this property to your component class
actionPlan: ActionPlanItem[] = [];

  recommendations: SecurityRecommendation[] = [];
  repositoryAnalysis: any = null;
  automatedScanInProgress: boolean = false;
  finalReport: any = null;

  // CVSS Score Mappings
   private readonly CVSS_MAPPINGS = {
    attackVector: { network: 0.85, adjacent: 0.62, local: 0.55, physical: 0.2 },
    attackComplexity: { low: 0.77, high: 0.44 },
    privilegesRequired: { 
      unchanged: { none: 0.85, low: 0.62, high: 0.27 },
      changed: { none: 0.85, low: 0.68, high: 0.50 }
    },
    userInteraction: { none: 0.85, required: 0.62 },
    scope: { unchanged: 1, changed: 1 },
    impact: { none: 0, low: 0.22, high: 0.56 },
    temporal: {
      exploitCodeMaturity: { 'not-defined': 1, unproven: 0.91, 'proof-of-concept': 0.94, functional: 0.97, high: 1 },
      remediationLevel: { 'not-defined': 1, 'official-fix': 0.87, 'temporary-fix': 0.90, workaround: 0.95, unavailable: 1 },
      reportConfidence: { 'not-defined': 1, unknown: 0.92, reasonable: 0.96, confirmed: 1 }
    },
    // Risk weights for security practices
    riskWeights: {
      mfa: { yes: 0, no: 3 },
      gitProtection: { yes: 0, no: 2 },
      secretsManagement: { yes: 0, no: 3 },
      staticAnalysis: { yes: 0, no: 2 },
      dynamicAnalysis: { yes: 0, no: 2 },
      scaTools: { yes: 0, no: 2 },
      vulnerabilityScans: { yes: 0, no: 2 },
      monitoringTools: { yes: 0, no: 2 },
      contingencyPlan: { yes: 0, no: 3 },
      exploitMitigation: { yes: 0, no: 2 },
      networkSegmentation: { yes: 0, no: 2 }
    }
  } as const;

  constructor(private http: HttpClient, private gitService: GitService) {}

  ngOnInit(): void {
    this.calculateCVSSScores();
  }

  // CVSS Score Calculation Methods
  onAnswerChange(questionKey: string, value: any): void {
    this.mapSecurityPracticesToCVSS(questionKey, value);
    this.calculateCVSSScores();
    this.generateRecommendations();
  }

  onSecurityMeasureChange(measure: string, value: boolean): void {
    this.answers.securityMeasures[measure as keyof typeof this.answers.securityMeasures] = value;
    this.mapSecurityMeasuresToCVSS();
    this.calculateCVSSScores();
  }

   mapSecurityPracticesToCVSS(questionKey: string, value: any): void {
    switch (questionKey) {
      case 'mfa':
        // MFA affects Privileges Required
        this.answers.privilegesRequired = value === 'yes' ? 'high' : 'none';
        break;
        
      case 'gitProtection':
        // Git protection affects Attack Complexity
        this.answers.attackComplexity = value === 'yes' ? 'high' : 'low';
        break;
        
      case 'repoType':
        // Repository type affects Attack Vector
        this.answers.attackVector = value === 'public' ? 'network' : 'adjacent';
        break;
        
      case 'secretsManagement':
        // Secrets management affects Confidentiality Impact
        this.answers.confidentialityImpact = value === 'no' ? 'high' : 'low';
        break;
        
      case 'staticAnalysis':
      case 'dynamicAnalysis':
        // Analysis tools affect Exploit Code Maturity
        const hasAnalysis = this.answers.staticAnalysis === 'yes' || this.answers.dynamicAnalysis === 'yes';
        this.answers.exploitCodeMaturity = hasAnalysis ? 'unproven' : 'functional';
        break;
        
      case 'scaTools':
        // SCA tools affect Remediation Level
        this.answers.remediationLevel = value === 'yes' ? 'official-fix' : 'workaround';
        break;
        
      case 'vulnerabilityScans':
        // Vulnerability scans affect Report Confidence
        this.answers.reportConfidence = value === 'yes' ? 'confirmed' : 'unknown';
        break;
        
      case 'monitoringTools':
        // Monitoring affects Availability Impact
        this.answers.availabilityImpact = value === 'no' ? 'high' : 'low';
        break;
        
      case 'contingencyPlan':
        // Contingency plan affects Availability Impact and Scope
        if (value === 'no') {
          this.answers.availabilityImpact = 'high';
          this.answers.scope = 'changed';
        }
        break;
        
      case 'exploitMitigation':
        // Exploit mitigation affects Attack Complexity
        this.answers.attackComplexity = value === 'yes' ? 'high' : 'low';
        break;
        
      case 'networkSegmentation':
        // Network segmentation affects Attack Vector
        if (value === 'yes') {
          this.answers.attackVector = this.answers.attackVector === 'network' ? 'adjacent' : this.answers.attackVector;
        }
        break;
        
      case 'accessControlModel':
        // Access control model affects Privileges Required
        switch (value) {
          case 'abac':
          case 'rbac':
            this.answers.privilegesRequired = 'high';
            break;
          case 'basic':
            this.answers.privilegesRequired = 'low';
            break;
          case 'none':
            this.answers.privilegesRequired = 'none';
            break;
        }
        break;
    }
  }

  mapSecurityMeasuresToCVSS(): void {
    const measures = this.answers.securityMeasures;
    const implementedCount = Object.values(measures).filter(Boolean).length;
    
    // Security measures affect multiple CVSS metrics
    if (implementedCount >= 4) {
      this.answers.attackComplexity = 'high';
      this.answers.integrityImpact = 'low';
      this.answers.confidentialityImpact = 'low';
    } else if (implementedCount >= 2) {
      this.answers.attackComplexity = 'low';
      this.answers.integrityImpact = 'low';
    } else {
      this.answers.attackComplexity = 'low';
      this.answers.integrityImpact = 'high';
      this.answers.confidentialityImpact = 'high';
    }
  }

  calculateCVSSScores(): void {
    this.cvssScores.exploitabilityScore = this.calculateExploitabilityScore();
    this.cvssScores.impactScore = this.calculateImpactScore();
    this.cvssScores.baseScore = this.calculateBaseScore();
    this.cvssScores.temporalScore = this.calculateTemporalScore();
    this.cvssScores.environmentalScore = this.calculateEnvironmentalScore();
    this.cvssScores.overallRiskScore = this.calculateOverallRiskScore();
    
    this.updateRiskCategories();
  }

  calculateExploitabilityScore(): number {
    const av = this.answers.attackVector? this.CVSS_MAPPINGS.attackVector[this.answers.attackVector]: 0.85;
    const ac = this.answers.attackComplexity? this.CVSS_MAPPINGS.attackComplexity[this.answers.attackComplexity]: 0.77;
    const pr = this.getPRValue();
    const ui = this.answers.userInteraction? this.CVSS_MAPPINGS.userInteraction[this.answers.userInteraction]: 0.85;
    
    return 8.22 * av * ac * pr * ui;
  }

  calculateImpactScore(): number {
    const c = this.answers.confidentialityImpact? this.CVSS_MAPPINGS.impact[this.answers.confidentialityImpact]: 0;
    const i = this.answers.integrityImpact? this.CVSS_MAPPINGS.impact[this.answers.integrityImpact]: 0;
    const a = this.answers.availabilityImpact? this.CVSS_MAPPINGS.impact[this.answers.availabilityImpact]: 0;


    const iss = 1 - ((1 - c) * (1 - i) * (1 - a));
    
    if (this.answers.scope === 'changed') {
      return 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
    } else {
      return 6.42 * iss;
    }
  }

  calculateBaseScore(): number {
    const exploitability = this.cvssScores.exploitabilityScore;
    const impact = this.cvssScores.impactScore;
    
    if (impact <= 0) return 0;
    
    if (this.answers.scope === 'changed') {
      return Math.min(1.08 * (impact + exploitability), 10);
    } else {
      return Math.min(impact + exploitability, 10);
    }
  }

  calculateTemporalScore(): number {
    const base = this.cvssScores.baseScore;
    const e = this.answers.exploitCodeMaturity? this.CVSS_MAPPINGS.temporal.exploitCodeMaturity[this.answers.exploitCodeMaturity]: 1;
    const rl = this.answers.remediationLevel? this.CVSS_MAPPINGS.temporal.remediationLevel[this.answers.remediationLevel]: 1;
    const rc = this.answers.reportConfidence? this.CVSS_MAPPINGS.temporal.reportConfidence[this.answers.reportConfidence]: 1;

    return Math.round(base * e * rl * rc * 10) / 10;
  }

  calculateEnvironmentalScore(): number {
    // Enhanced environmental score calculation
    const temporal = this.cvssScores.temporalScore;
    let modifier = 1.0;
    
    // Adjust based on project criticality
    switch (this.answers.projectCriticality) {
      case 'critical': modifier += 0.3; break;
      case 'high': modifier += 0.2; break;
      case 'medium': modifier += 0.1; break;
      case 'low': modifier += 0.0; break;
    }
    
    // Adjust based on team experience
    switch (this.answers.teamExperience) {
      case 'junior': modifier += 0.2; break;
      case 'intermediate': modifier += 0.1; break;
      case 'senior': modifier -= 0.1; break;
      case 'expert': modifier -= 0.2; break;
    }
    
    // Adjust based on hosting environment
    switch (this.answers.hostingEnvironment) {
      case 'cloud': modifier += 0.1; break;
      case 'hybrid': modifier += 0.05; break;
      case 'on-premise': modifier -= 0.05; break;
    }
    
    return Math.min(temporal * modifier, 10);
  }

  calculateOverallRiskScore(): number {
    // Weighted combination of all scores
    const weights = this.riskCategories.reduce((acc, cat) => acc + cat.weight, 0);
    
    return this.riskCategories.reduce((total, category, index) => {
      let score = 0;
      switch (index) {
        case 0: score = this.cvssScores.exploitabilityScore; break;
        case 1: score = this.cvssScores.impactScore; break;
        case 2: score = this.cvssScores.temporalScore; break;
        case 3: score = this.cvssScores.environmentalScore; break;
      }
      return total + (score * category.weight);
    }, 0);
  }

  private getPRValue(): number {
    const scope = this.answers.scope || 'unchanged';
    const pr = this.answers.privilegesRequired || 'none';
    return this.CVSS_MAPPINGS.privilegesRequired[scope][pr] || 0.85;
  }

  updateRiskCategories(): void {
    // Exploitability Category
    this.riskCategories[0].score = Math.round(this.cvssScores.exploitabilityScore * 10) / 10;
    this.riskCategories[0].status = this.getStatusFromScore(this.cvssScores.exploitabilityScore, 10);
    
    // Impact Category
    this.riskCategories[1].score = Math.round(this.cvssScores.impactScore * 10) / 10;
    this.riskCategories[1].status = this.getStatusFromScore(this.cvssScores.impactScore, 10);
    
    // Temporal Category
    this.riskCategories[2].score = Math.round(this.cvssScores.temporalScore * 10) / 10;
    this.riskCategories[2].status = this.getStatusFromScore(this.cvssScores.temporalScore, 10);
    
    // Environmental Category
    this.riskCategories[3].score = Math.round(this.cvssScores.environmentalScore * 10) / 10;
    this.riskCategories[3].status = this.getStatusFromScore(this.cvssScores.environmentalScore, 10);
  }

  getStatusFromScore(score: number, maxScore: number): 'success' | 'warning' | 'danger' {
    const percentage = (score / maxScore) * 100;
    if (percentage < 30) return 'success';
    if (percentage < 70) return 'warning';
    return 'danger';
  }

  getCVSSSeverityRating(): string {
    const score = this.cvssScores.environmentalScore || this.cvssScores.baseScore;
    if (score >= 9.0) return 'Critical';
    if (score >= 7.0) return 'High';
    if (score >= 4.0) return 'Medium';
    if (score >= 0.1) return 'Low';
    return 'None';
  }

  getRiskColor(): string {
    const rating = this.getCVSSSeverityRating();
    switch (rating) {
      case 'Critical': return '#d32f2f';
      case 'High': return '#f57c00';
      case 'Medium': return '#fbc02d';
      case 'Low': return '#388e3c';
      default: return '#757575';
    }
  }
  
get implementedSecurityMeasuresCount(): number {
  return Object.values(this.answers.securityMeasures || {}).filter(value => !!value).length;
}

get implementedSecurityMeasuresStatus(): 'success' | 'warning' {
  return this.implementedSecurityMeasuresCount >= 3 ? 'success' : 'warning';
}

  generateRecommendations(): void {
    this.recommendations = [];
    
    // High exploitability recommendations
    if (this.cvssScores.exploitabilityScore > 7) {
      if (this.answers.mfa === 'no') {
        this.recommendations.push({
          category: 'Authentication',
          priority: 'critical',
          title: 'Implement Multi-Factor Authentication',
          description: 'Enable MFA to increase Privileges Required metric and reduce exploitability',
          cvssImpact: -2.5,
          timeline: 'Immediate',
          effort: 'low',
          affectedMetrics: ['Privileges Required', 'Attack Complexity']
        });
      }
      
      if (this.answers.gitProtection === 'no') {
        this.recommendations.push({
          category: 'Access Control',
          priority: 'high',
          title: 'Enable Repository Protection Rules',
          description: 'Implement branch protection to increase Attack Complexity',
          cvssImpact: -1.8,
          timeline: '1-2 weeks',
          effort: 'medium',
          affectedMetrics: ['Attack Complexity', 'User Interaction']
        });
      }
      
      if (this.answers.exploitMitigation === 'no') {
        this.recommendations.push({
          category: 'System Security',
          priority: 'high',
          title: 'Implement Exploit Mitigation Techniques',
          description: 'Deploy ASLR, DEP, CSP and other exploit mitigation controls',
          cvssImpact: -2.0,
          timeline: '2-4 weeks',
          effort: 'high',
          affectedMetrics: ['Attack Complexity', 'Exploit Code Maturity']
        });
      }
    }
    
    // High impact recommendations
    if (this.cvssScores.impactScore > 6) {
      if (this.answers.secretsManagement === 'no') {
        this.recommendations.push({
          category: 'Data Protection',
          priority: 'critical',
          title: 'Implement Secrets Management',
          description: 'Deploy secrets management to reduce Confidentiality Impact',
          cvssImpact: -2.0,
          timeline: '2-3 weeks',
          effort: 'high',
          affectedMetrics: ['Confidentiality Impact', 'Integrity Impact']
        });
      }
      
      if (this.answers.monitoringTools === 'no') {
        this.recommendations.push({
          category: 'Monitoring',
          priority: 'high',
          title: 'Deploy Security Monitoring',
          description: 'Implement monitoring tools to reduce Availability Impact',
          cvssImpact: -1.5,
          timeline: '3-4 weeks',
          effort: 'high',
          affectedMetrics: ['Availability Impact', 'Report Confidence']
        });
      }
      
      if (this.answers.networkSegmentation === 'no') {
        this.recommendations.push({
          category: 'Network Security',
          priority: 'medium',
          title: 'Implement Network Segmentation',
          description: 'Segment networks to limit blast radius and reduce Attack Vector score',
          cvssImpact: -1.2,
          timeline: '4-6 weeks',
          effort: 'high',
          affectedMetrics: ['Attack Vector', 'Scope']
        });
      }
    }
    
    // Temporal recommendations
    if (this.answers.vulnerabilityScans === 'no') {
      this.recommendations.push({
        category: 'Vulnerability Management',
        priority: 'medium',
        title: 'Implement Regular Vulnerability Scanning',
        description: 'Improve Report Confidence metric through systematic scanning',
        cvssImpact: -0.8,
        timeline: '2-4 weeks',
        effort: 'medium',
        affectedMetrics: ['Report Confidence', 'Remediation Level']
      });
    }
    
    if (this.answers.staticAnalysis === 'no' && this.answers.dynamicAnalysis === 'no') {
      this.recommendations.push({
        category: 'Code Security',
        priority: 'medium',
        title: 'Implement Static and Dynamic Analysis',
        description: 'Deploy SAST/DAST tools to improve Exploit Code Maturity metrics',
        cvssImpact: -1.0,
        timeline: '3-5 weeks',
        effort: 'medium',
        affectedMetrics: ['Exploit Code Maturity', 'Report Confidence']
      });
    }
    
    // Environmental recommendations
    if (this.answers.securityTraining === 'no') {
      this.recommendations.push({
        category: 'Training & Awareness',
        priority: 'low',
        title: 'Implement Security Training Program',
        description: 'Regular security training reduces environmental risk factors',
        cvssImpact: -0.5,
        timeline: '4-8 weeks',
        effort: 'medium',
        affectedMetrics: ['Environmental Score', 'User Interaction']
      });
    }
    
    // Sort recommendations by priority and CVSS impact
    this.recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(b.cvssImpact) - Math.abs(a.cvssImpact);
    });
  }
  // Repository Analysis Methods (existing functionality)
  cloneGithubRepo(): void {
    const payload = {
      type: 'public',
      repoUrl: this.answers.githubURL
    };
    
    this.http.post<any>('http://localhost:5000/api/git', payload).subscribe({
      next: res => alert(`✅ GitHub Repo Cloned Successfully!\n📁 Path: ${res.path}`),
      error: err => alert("❌ Error: " + err.error?.error)
    });
  }
  
  cloneGitlabRepo(): void {
    const payload = {
      type: 'private',
      repoUrl: this.answers.gitlabURL,
      token: this.answers.gitlabToken
    };
  
    this.http.post<any>('http://localhost:5000/api/git', payload).subscribe({
      next: res => alert(`✅ GitLab Repo Cloned Successfully!\n📁 Path: ${res.path}`),
      error: err => alert("❌ Error: " + err.error?.error)
    });
  }

  analyzeRepository(type: 'github' | 'gitlab'): void {
    const url = type === 'github' ? this.answers.githubURL : this.answers.gitlabURL;
    if (!url) return;

    this.automatedScanInProgress = true;
    this.repositoryAnalysis = {
      type: type,
      url: url,
      findings: {
        branches: null,
        secrets: 0,
        vulnerabilities: 0,
        dependencies: 0
      }
    };

    this.startAutomatedScan(type);
  }

  startAutomatedScan(type: 'github' | 'gitlab'): void {
    this.analyzeClientRepositoryComplete(type);
  }

  analyzeClientRepositoryComplete(type: 'github' | 'gitlab'): void {
    const repoUrl = type === 'github' ? this.answers.githubURL : this.answers.gitlabURL;
    const token = type === 'github' ? this.answers.githubToken : this.answers.gitlabToken;
    
    if (!repoUrl) {
      this.automatedScanInProgress = false;
      return;
    }

    const payload = { repoUrl: repoUrl, token: token };

    this.http.post('http://localhost:5000/api/git/analyze', payload).subscribe({
      next: (res: any) => {
        if (this.repositoryAnalysis) {
          this.repositoryAnalysis.gitlabProjectUrl = res.analysisRepo?.url;
          this.repositoryAnalysis.pipelineUrl = res.analysisRepo?.pipelineUrl;
          this.repositoryAnalysis.automatedScanTriggered = true;
          this.repositoryAnalysis.analysisRepoId = res.analysisRepo?.id;
        }

        alert(`🚀 Repository Analysis Setup Completed!
🌐 Analysis Repository: ${res.analysisRepo?.url}
📊 Pipeline: ${res.analysisRepo?.pipelineUrl}`);

        this.waitForPipelineCompletion(res.analysisRepo?.id);
      },
      error: (err) => {
        alert("❌ Repository analysis failed: " + (err.error?.details || err.error?.error || 'Unknown error'));
        this.automatedScanInProgress = false;
      }
    });
  }

  waitForPipelineCompletion(analysisRepoId: string): void {
    setTimeout(() => {
      this.saveScanResults(analysisRepoId);
    }, 15000); 
  }

  saveScanResults(analysisRepoId?: string): void {
    const result = {
      repoUrl: this.answers.gitlabURL || this.answers.githubURL,
      analysisRepoId: analysisRepoId,
      timestamp: new Date().toISOString(),
      cvssScore: this.cvssScores.baseScore,
      severity: this.getCVSSSeverityRating(),
      findings: this.repositoryAnalysis?.findings || {}
    };

    this.http.post('http://localhost:5000/api/git/scan-results', result).subscribe({
      next: (res) => {
        alert("✅ Automated scan completed and results saved successfully!");
        this.automatedScanInProgress = false;
      },
      error: (err) => {
        alert("❌ Failed to save scan results: " + (err.error?.details || err.error?.error));
        this.automatedScanInProgress = false;
      }
    });
  }

  // Report Generation Methods
  generateFinalReport(): void {
    this.finalReport = {
      projectName: this.answers.projectName,
      assessmentDate: new Date(),
      cvssScores: { ...this.cvssScores },
      severityRating: this.getCVSSSeverityRating(),
      riskCategories: [...this.riskCategories],
      recommendations: [...this.recommendations],
      repositoryAnalysis: this.repositoryAnalysis,
      securityMetrics: this.getSecurityMetricsSummary()
    };
  }

  getSecurityMetricsSummary(): any {
    return {
      baseMetrics: {
        attackVector: this.answers.attackVector,
        attackComplexity: this.answers.attackComplexity,
        privilegesRequired: this.answers.privilegesRequired,
        userInteraction: this.answers.userInteraction,
        scope: this.answers.scope,
        confidentialityImpact: this.answers.confidentialityImpact,
        integrityImpact: this.answers.integrityImpact,
        availabilityImpact: this.answers.availabilityImpact
      },
      temporalMetrics: {
        exploitCodeMaturity: this.answers.exploitCodeMaturity,
        remediationLevel: this.answers.remediationLevel,
        reportConfidence: this.answers.reportConfidence
      },
      securityPractices: {
        mfa: this.answers.mfa,
        gitProtection: this.answers.gitProtection,
        secretsManagement: this.answers.secretsManagement,
        staticAnalysis: this.answers.staticAnalysis,
        dynamicAnalysis: this.answers.dynamicAnalysis,
        scaTools: this.answers.scaTools,
        vulnerabilityScans: this.answers.vulnerabilityScans
      }
    };
  }

  exportToPDF(): void {
    if (!this.finalReport) return;

    const doc = new jsPDF.jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text('CVSS Security Assessment Report', 20, yPosition);
    yPosition += 20;

    // CVSS Scores
    doc.setFontSize(14);
    doc.text(`Project: ${this.finalReport.projectName}`, 20, yPosition);
    yPosition += 10;
    doc.text(`CVSS Base Score: ${this.finalReport.cvssScores.baseScore.toFixed(1)}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Severity Rating: ${this.finalReport.severityRating}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Temporal Score: ${this.finalReport.cvssScores.temporalScore.toFixed(1)}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Environmental Score: ${this.finalReport.cvssScores.environmentalScore.toFixed(1)}`, 20, yPosition);
    yPosition += 20;

    // Risk Categories
    doc.text('Risk Categories:', 20, yPosition);
    yPosition += 10;
    this.riskCategories.forEach(category => {
      doc.text(`${category.name}: ${category.score}/${category.maxScore}`, 30, yPosition);
      yPosition += 8;
    });

    // Recommendations
    yPosition += 10;
    doc.text('Priority Recommendations:', 20, yPosition);
    yPosition += 10;
    this.recommendations.slice(0, 5).forEach((rec, index) => {
      doc.text(`${index + 1}. ${rec.title} (${rec.priority})`, 30, yPosition);
      yPosition += 8;
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    doc.save('security-assessment-report.pdf');
  }


  sendEmailReport(): void {
    if (!this.answers.email || !this.finalReport) return;

    // Mock email sending - In real implementation, this would call an email service
    const emailBody = this.generateEmailBody();
    
    // Simulate email sending
    console.log('Sending email to:', this.answers.email);
    console.log('Email body:', emailBody);
    
    // You could use a service like EmailJS or integrate with your backend email service
    alert(`Email report would be sent to ${this.answers.email}`);
  }

  generateEmailBody(): string {
    return `
Dear ${this.answers.stakeholders || 'Stakeholder'},

Your security assessment for "${this.finalReport.projectName}" has been completed.

Summary:
- Global Risk Score: ${this.finalReport.globalRiskScore}%
- Assessment Date: ${this.finalReport.assessmentDate.toLocaleDateString()}

Key Risk Areas:
${this.riskCategories.map(cat => `- ${cat.name}: ${cat.score}%`).join('\n')}

Priority Actions:
${this.actionPlan.filter(action => action.priority === 'high').map((action, index) => `${index + 1}. ${action.title}`).join('\n')}

Please find the detailed report attached.

    `;
  }
}