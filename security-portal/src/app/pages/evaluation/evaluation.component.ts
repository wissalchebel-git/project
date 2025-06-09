import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { GitService } from '../../git.service';

class SecurityAnswers {
  projectName: string = '';
  repoType: 'public' | 'private' | '' = '';
  githubURL: string = '';
  gitlabURL: string = '';
  gitlabToken: string = '';
  projectObjective: string = '';
  stakeholders: string = '';
  email: string = '';
  mfa: 'yes' | 'no' | '' = '';
  gitProtection: 'yes' | 'no' | '' = '';
  securityMeasures = {
    accessControl: false,
    encryption: false,
    audits: false
  };
  analysisTools: string = '';
  securityTests: string = '';
  scaTools: 'yes' | 'no' | '' = '';
  vulnerabilityScans: 'yes' | 'no' | '' = '';
  identifiedVulnerabilities: 'yes' | 'no' | '' = '';
  vulnerabilityHandling: string = '';
  securityUpdates: string = '';
  monitoringTools: 'yes' | 'no' | '' = '';
  secretsManagement: 'yes' | 'no' | '' = '';
  contingencyPlan: 'yes' | 'no' | '' = '';
  complianceStandards: string = '';
  riskAssessment: 'yes' | 'no' | '' = '';
  securityTraining: 'yes' | 'no' | '' = '';
  trainingFrequency: string = '';
  userAwareness: string = '';
}

interface RiskCategory {
  name: string;
  score: number;
  status: 'success' | 'warning' | 'danger';
}

interface RiskAssessment {
  status: 'success' | 'warning' | 'danger';
  message: string;
  consequence?: string;
  recommendation?: string;
}

interface ActionPlanItem {
  title: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  timeline: string;
  resources: string;
  completed: boolean;
}

interface MatrixLevel {
  label: string;
  value: number;
}

@Component({
  selector: 'app-evaluation',
  templateUrl: './evaluation.component.html',
  styleUrls: ['./evaluation.component.scss']
})
export class EvaluationComponent implements OnInit {
  
  // Form answers
  answers: SecurityAnswers = new SecurityAnswers();

  // Risk assessment
  globalRiskScore: number = 0;
  riskCategories: RiskCategory[] = [
    { name: 'Authentication', score: 0, status: 'success' },
    { name: 'Code Security', score: 0, status: 'success' },
    { name: 'Infrastructure', score: 0, status: 'success' },
    { name: 'Compliance', score: 0, status: 'success' },
    { name: 'Incident Response', score: 0, status: 'success' }
  ];

  currentQuestionRisk: { [key: string]: RiskAssessment } = {};

  // Risk Matrix
  showRiskMatrix: boolean = false;
  probabilityLevels: MatrixLevel[] = [
    { label: 'Very High', value: 5 },
    { label: 'High', value: 4 },
    { label: 'Medium', value: 3 },
    { label: 'Low', value: 2 },
    { label: 'Very Low', value: 1 }
  ];

  impactLevels: MatrixLevel[] = [
    { label: 'Low', value: 1 },
    { label: 'Medium', value: 2 },
    { label: 'High', value: 3 },
    { label: 'Critical', value: 4 }
  ];

  // Action Plan and Reports
  actionPlan: ActionPlanItem[] = [];
  finalReport: any = null;

  // Repository Analysis
  repositoryAnalysis: any = null;
  
  automatedScanInProgress: boolean = false;
  constructor(private http: HttpClient, private gitService: GitService) {}

  ngOnInit(): void {
    this.updateGlobalRiskScore();
  }

  // Real-time risk assessment for individual questions
  onAnswerChange(questionKey: string, value: any): void {
    this.assessQuestionRisk(questionKey, value);
    this.updateGlobalRiskScore();
  }

  onSecurityMeasureChange(measure: string, value: boolean): void {
    this.answers.securityMeasures[measure as keyof typeof this.answers.securityMeasures] = value;
    this.assessQuestionRisk('securityMeasures', this.answers.securityMeasures);
    this.updateGlobalRiskScore();
  }

  assessQuestionRisk(questionKey: string, value: any): void {
    switch (questionKey) {
      case 'projectName':
        if (!value || value.trim().length === 0) {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Project identification is important for security tracking'
          };
        } else {
          delete this.currentQuestionRisk[questionKey];
        }
        break;

      case 'repoType':
        if (value === 'public') {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Public repositories increase exposure risk',
            consequence: 'Source code and potential secrets exposed to public',
            recommendation: 'Ensure no sensitive data is committed and implement proper access controls'
          };
        } else if (value === 'private') {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'Private repositories provide better security control'
          };
        }
        break;

      case 'mfa':
        if (value === 'no') {
          this.currentQuestionRisk[questionKey] = {
            status: 'danger',
            message: 'HIGH RISK: No multi-factor authentication',
            consequence: 'Account compromise through credential theft or brute force attacks',
            recommendation: 'Immediately implement MFA for all accounts with repository access'
          };
        } else if (value === 'yes') {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'MFA provides strong authentication security'
          };
        }
        break;

      case 'gitProtection':
        if (value === 'no') {
          this.currentQuestionRisk[questionKey] = {
            status: 'danger',
            message: 'HIGH RISK: No repository protection rules',
            consequence: 'Unauthorized changes, malicious code injection, accidental deletions',
            recommendation: 'Configure branch protection, require reviews, and enable signed commits'
          };
        } else if (value === 'yes') {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'Repository protection rules enhance code security'
          };
        }
        break;

      case 'securityMeasures':
        const measures = value as typeof this.answers.securityMeasures;
        const implementedCount = Object.values(measures).filter(Boolean).length;
        
        if (implementedCount === 0) {
          this.currentQuestionRisk[questionKey] = {
            status: 'danger',
            message: 'CRITICAL: No security measures implemented'
          };
        } else if (implementedCount <= 1) {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Limited security measures - consider implementing additional controls'
          };
        } else if (implementedCount === 2) {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Good security foundation - consider implementing all three measures'
          };
        } else {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'Comprehensive security measures implemented'
          };
        }
        break;

      case 'analysisTools':
        if (!value || value.trim().length === 0) {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Static/Dynamic analysis tools help identify vulnerabilities early'
          };
        } else {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'Analysis tools enhance code security'
          };
        }
        break;

      case 'scaTools':
        if (value === 'no') {
          this.currentQuestionRisk[questionKey] = {
            status: 'warning',
            message: 'Software Composition Analysis helps identify vulnerable dependencies'
          };
        } else if (value === 'yes') {
          this.currentQuestionRisk[questionKey] = {
            status: 'success',
            message: 'SCA tools provide important dependency security'
          };
        }
        break;

      default:
        break;
    }
  }

  updateGlobalRiskScore(): void {
    let totalRisk = 0;
    const factors = [
      { key: 'mfa', weight: 20, riskValue: this.answers.mfa === 'no' ? 100 : 0 },
      { key: 'gitProtection', weight: 15, riskValue: this.answers.gitProtection === 'no' ? 100 : 0 },
      { key: 'securityMeasures', weight: 15, riskValue: this.calculateSecurityMeasuresRisk() },
      { key: 'scaTools', weight: 10, riskValue: this.answers.scaTools === 'no' ? 100 : 0 },
      { key: 'vulnerabilityScans', weight: 10, riskValue: this.answers.vulnerabilityScans === 'no' ? 100 : 0 },
      { key: 'monitoringTools', weight: 10, riskValue: this.answers.monitoringTools === 'no' ? 100 : 0 },
      { key: 'secretsManagement', weight: 10, riskValue: this.answers.secretsManagement === 'no' ? 100 : 0 },
      { key: 'contingencyPlan', weight: 5, riskValue: this.answers.contingencyPlan === 'no' ? 100 : 0 },
      { key: 'securityTraining', weight: 5, riskValue: this.answers.securityTraining === 'no' ? 100 : 0 }
    ];

    factors.forEach(factor => {
      totalRisk += (factor.riskValue * factor.weight) / 100;
    });

    this.globalRiskScore = Math.round(totalRisk);
    this.updateRiskCategories();
  }

  calculateSecurityMeasuresRisk(): number {
    const measures = this.answers.securityMeasures;
    const implementedCount = Object.values(measures).filter(Boolean).length;
    return ((3 - implementedCount) / 3) * 100;
  }

  updateRiskCategories(): void {
    // Authentication
    const authRisk = this.answers.mfa === 'no' ? 80 : 
                    this.answers.secretsManagement === 'no' ? 40 : 10;
    this.riskCategories[0] = {
      name: 'Authentication',
      score: authRisk,
      status: authRisk > 60 ? 'danger' : authRisk > 30 ? 'warning' : 'success'
    };

    // Code Security
    const codeRisk = this.calculateCodeSecurityRisk();
    this.riskCategories[1] = {
      name: 'Code Security',
      score: codeRisk,
      status: codeRisk > 60 ? 'danger' : codeRisk > 30 ? 'warning' : 'success'
    };

    // Infrastructure
    const infraRisk = this.answers.monitoringTools === 'no' ? 60 : 20;
    this.riskCategories[2] = {
      name: 'Infrastructure',
      score: infraRisk,
      status: infraRisk > 60 ? 'danger' : infraRisk > 30 ? 'warning' : 'success'
    };

    // Compliance
    const complianceRisk = this.answers.riskAssessment === 'no' ? 70 : 
                          !this.answers.complianceStandards ? 50 : 15;
    this.riskCategories[3] = {
      name: 'Compliance',
      score: complianceRisk,
      status: complianceRisk > 60 ? 'danger' : complianceRisk > 30 ? 'warning' : 'success'
    };

    // Incident Response
    const incidentRisk = this.answers.contingencyPlan === 'no' ? 80 : 20;
    this.riskCategories[4] = {
      name: 'Incident Response',
      score: incidentRisk,
      status: incidentRisk > 60 ? 'danger' : incidentRisk > 30 ? 'warning' : 'success'
    };
  }

  calculateCodeSecurityRisk(): number {
    let risk = 0;
    if (this.answers.gitProtection === 'no') risk += 40;
    if (this.answers.scaTools === 'no') risk += 30;
    if (!this.answers.analysisTools) risk += 20;
    if (this.answers.vulnerabilityScans === 'no') risk += 10;
    return Math.min(risk, 100);
  }

  getRiskStatus(): 'success' | 'warning' | 'danger' {
    if (this.globalRiskScore < 30) return 'success';
    if (this.globalRiskScore < 70) return 'warning';
    return 'danger';
  }

   cloneGithubRepo() {
    const payload = {
      type: 'public',
      repoUrl: this.answers.githubURL
    };
    
    console.log("📦 Payload to send:", payload);
    
    this.http.post<any>('http://localhost:5000/api/git', payload).subscribe({
      next: res => alert(`✅ GitHub Repo Cloned Successfully!\n📁 Path: ${res.path}`),
      error: err => alert("❌ Error: " + err.error?.error)
    });
  }
  
  cloneGitlabRepo() {
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
  
// Repository Analysis with Automated Scanning
  analyzeRepository(type: 'github' | 'gitlab'): void {
    const url = type === 'github' ? this.answers.githubURL : this.answers.gitlabURL;
    if (!url) return;

    this.automatedScanInProgress = true;

    // Mock repository analysis - In real implementation, this would call an actual API
    setTimeout(() => {
      this.repositoryAnalysis = {
        type: type,
        url: url,
        findings: {
          branches: type === 'github' ? this.analyzeGitHubRepo(url) : this.analyzeGitLabRepo(url),
          secrets: Math.floor(Math.random() * 5),
          vulnerabilities: Math.floor(Math.random() * 10),
          dependencies: Math.floor(Math.random() * 50) + 50
        },
        recommendations: this.generateRepositoryRecommendations()
      };
      
      // Update risk assessment based on repository analysis
      this.updateRiskFromRepositoryAnalysis();

      // If it's a GitLab repository, trigger automated scanning
      if (type === 'gitlab' && this.answers.gitlabURL && this.answers.gitlabToken) {
        this.startAutomatedScan();
      } else {
        this.automatedScanInProgress = false;
      }
    }, 2000);
  }

  // Start the automated scanning process
  startAutomatedScan(): void {
    console.log('🚀 Starting automated security scan...');
    
    // Step 1: Create GitLab project and push
    this.createGitLabProjectAndPush();
    
    // Step 2: Wait for CI pipeline to complete (simulated delay)
    setTimeout(() => {
      this.saveScanResults();
      this.automatedScanInProgress = false;
    }, 10000); // 10 second delay to simulate CI pipeline execution
  }

  // Create GitLab project and push repository
  createGitLabProjectAndPush() {
    const payload = {
      repoUrl: this.answers.gitlabURL,
      token: this.answers.gitlabToken
    };
    
    console.log("📦 Creating GitLab project and pushing...", payload);
    
    this.http.post<any>('http://localhost:5000/api/git/gitlab-push', payload).subscribe({
      next: res => {
        console.log(`✅ Project Created & Pushed to GitLab! URL: ${res.gitlabUrl}`);
        alert(`🚀 Project Created & Pushed to GitLab!\n🌐 URL: ${res.gitlabUrl}`);
        
        // Update repository analysis with GitLab project info
        if (this.repositoryAnalysis) {
          this.repositoryAnalysis.gitlabProjectUrl = res.gitlabUrl;
          this.repositoryAnalysis.automatedScanTriggered = true;
        }
      },
      error: err => {
        console.error("❌ Push Error:", err);
        alert("❌ Push Error: " + err.error?.error);
        this.automatedScanInProgress = false;
      }
    });
  }

  // Save scan results
  saveScanResults() {
    const result = {
      repoUrl: this.answers.gitlabURL,
      timestamp: new Date().toISOString(),
      resultSummary: 'Automated security scan completed',
      status: 'Completed',
      findings: {
        vulnerabilities: this.repositoryAnalysis?.findings?.vulnerabilities || 0,
        secrets: this.repositoryAnalysis?.findings?.secrets || 0,
        dependencies: this.repositoryAnalysis?.findings?.dependencies || 0
      }
    };
    
    console.log("💾 Saving scan results...", result);
    
    this.http.post<any>('http://localhost:5000/api/git/scan-results', result).subscribe({
      next: res => {
        console.log("✅ Scan results saved successfully!");
        alert("✅ Automated scan completed and results saved successfully!");
        
        // Store scan results for display
    this.gitService.saveScanResult(result).subscribe({
      next: (res) => {
        console.log('Scan result saved:', res);
        // You can use this data however you want
      },
      error: (err) => {
        console.error('Error saving scan result:', err);
      }
    });
        
        // Update repository analysis with scan results
        if (this.repositoryAnalysis) {
          this.repositoryAnalysis.automatedScanResults = this.saveScanResults;
          this.repositoryAnalysis.scanCompleted = true;
        }
      },
      error: err => {
        console.error("❌ Failed to save scan results:", err);
        alert("❌ Failed to save scan results: " + err.error?.error);
      }
    });
  }

    analyzeGitHubRepo(url: string): any {
    // Mock GitHub API analysis
    return {
      totalBranches: Math.floor(Math.random() * 10) + 1,
      protectedBranches: Math.floor(Math.random() * 3),
      lastCommit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      contributors: Math.floor(Math.random() * 5) + 1
    };
  }

  analyzeGitLabRepo(url: string): any {
    // Mock GitLab API analysis
    return {
      totalBranches: Math.floor(Math.random() * 10) + 1,
      protectedBranches: Math.floor(Math.random() * 3),
      lastCommit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      contributors: Math.floor(Math.random() * 5) + 1
    };
  }

 
  generateRepositoryRecommendations(): string[] {
    const recommendations = [
      'Enable branch protection rules for main/master branch',
      'Implement required pull request reviews',
      'Add status checks before merging',
      'Enable signed commits verification',
      'Set up automated security scanning',
      'Configure dependency vulnerability alerts',
      'Implement secrets scanning',
      'Add code quality gates'
    ];
    
    return recommendations.slice(0, Math.floor(Math.random() * 4) + 3);
  }

  updateRiskFromRepositoryAnalysis(): void {
    if (!this.repositoryAnalysis) return;

    const findings = this.repositoryAnalysis.findings;
    
    // Adjust git protection risk based on actual repository state
    if (findings.branches.protectedBranches === 0) {
      this.answers.gitProtection = 'no';
    } else {
      this.answers.gitProtection = 'yes';
    }

    // Update current question risk assessment
    this.assessQuestionRisk('gitProtection', this.answers.gitProtection);
    this.updateGlobalRiskScore();
  }

  // Risk Matrix
  getCellClass(probability: number, impact: number): string {
    const riskScore = probability * impact;
    if (riskScore <= 5) return 'low';
    if (riskScore <= 10) return 'medium';
    if (riskScore <= 15) return 'high';
    return 'critical';
  }

  getRiskCountInCell(probability: number, impact: number): number {
    // Mock risk count calculation based on current assessment
    const riskScore = probability * impact;
    return Math.floor(Math.random() * 3) + (riskScore > 10 ? 2 : 0);
  }

  showRisksInCell(probability: number, impact: number): void {
    // Mock implementation - would show detailed risks in this cell
    console.log(`Showing risks for probability: ${probability}, impact: ${impact}`);
  }

  // Final Report Generation
  generateFinalReport(): void {
    this.generateActionPlan();
    this.showRiskMatrix = true;
    
    this.finalReport = {
      projectName: this.answers.projectName,
      assessmentDate: new Date(),
      globalRiskScore: this.globalRiskScore,
      riskCategories: this.riskCategories,
      recommendations: this.generateRecommendations(),
      actionPlan: this.actionPlan,
      repositoryAnalysis: this.repositoryAnalysis
    };
  }

  generateActionPlan(): void {
    this.actionPlan = [];

    // High priority actions based on risk assessment
    if (this.answers.mfa === 'no') {
      this.actionPlan.push({
        title: 'Implement Multi-Factor Authentication',
        priority: 'high',
        description: 'Enable MFA for all accounts with access to the repository and related systems',
        timeline: 'Immediate - 1 week',
        resources: 'Admin privileges, MFA app/hardware tokens',
        completed: false
      });
    }

    if (this.answers.gitProtection === 'no') {
      this.actionPlan.push({
        title: 'Configure Repository Protection Rules',
        priority: 'high',
        description: 'Set up branch protection, require pull request reviews, and enable status checks',
        timeline: '1-2 weeks',
        resources: 'Repository admin access, CI/CD pipeline configuration',
        completed: false
      });
    }

    if (this.answers.scaTools === 'no') {
      this.actionPlan.push({
        title: 'Implement Software Composition Analysis',
        priority: 'medium',
        description: 'Deploy SCA tools like Snyk or OWASP Dependency-Check to monitor dependencies',
        timeline: '2-4 weeks',
        resources: 'SCA tool subscription, CI/CD integration',
        completed: false
      });
    }

    if (this.answers.secretsManagement === 'no') {
      this.actionPlan.push({
        title: 'Implement Secrets Management',
        priority: 'high',
        description: 'Deploy a secrets management solution and audit existing code for hardcoded secrets',
        timeline: '2-3 weeks',
        resources: 'Secrets management tool, code audit time',
        completed: false
      });
    }

    if (this.answers.contingencyPlan === 'no') {
      this.actionPlan.push({
        title: 'Develop Incident Response Plan',
        priority: 'medium',
        description: 'Create a comprehensive incident response plan including breach procedures',
        timeline: '3-4 weeks',
        resources: 'Security team, legal consultation, documentation time',
        completed: false
      });
    }

    if (this.answers.securityTraining === 'no') {
      this.actionPlan.push({
        title: 'Establish Security Training Program',
        priority: 'low',
        description: 'Implement regular security awareness training for development team',
        timeline: '1-2 months',
        resources: 'Training materials, dedicated training time',
        completed: false
      });
    }
  }

  generateRecommendations(): string[] {
    const recommendations = [];

    // General security recommendations
    recommendations.push('Implement a comprehensive security policy');
    recommendations.push('Conduct regular security audits and assessments');
    recommendations.push('Establish monitoring and alerting systems');
    
    // Specific recommendations based on answers
    if (!this.answers.analysisTools) {
      recommendations.push('Integrate static and dynamic analysis tools into your development workflow');
    }

    if (!this.answers.complianceStandards) {
      recommendations.push('Consider compliance with relevant security standards (ISO 27001, GDPR, etc.)');
    }

    if (!this.answers.securityUpdates || this.answers.securityUpdates.toLowerCase().includes('monthly')) {
      recommendations.push('Increase frequency of security updates to weekly or as needed');
    }

    return recommendations;
  }

  // Export Functions
  exportToPDF(): void {
    if (!this.finalReport) return;

    const doc = new jsPDF.jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text('Security Assessment Report', 20, yPosition);
    yPosition += 20;

    // Project Information
    doc.setFontSize(14);
    doc.text(`Project: ${this.finalReport.projectName}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Assessment Date: ${this.finalReport.assessmentDate.toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Global Risk Score: ${this.finalReport.globalRiskScore}%`, 20, yPosition);
    yPosition += 20;

    // Risk Categories
    doc.text('Risk Categories:', 20, yPosition);
    yPosition += 10;
    this.riskCategories.forEach(category => {
      doc.text(`${category.name}: ${category.score}%`, 30, yPosition);
      yPosition += 8;
    });

    // Action Plan
    yPosition += 10;
    doc.text('Action Plan:', 20, yPosition);
    yPosition += 10;
    this.actionPlan.forEach((action, index) => {
      doc.text(`${index + 1}. ${action.title} (${action.priority} priority)`, 30, yPosition);
      yPosition += 8;
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    doc.save('security-assessment-report.pdf');
  }

  exportToExcel(): void {
    if (!this.finalReport) return;

    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Project Name', this.finalReport.projectName],
      ['Assessment Date', this.finalReport.assessmentDate.toLocaleDateString()],
      ['Global Risk Score', `${this.finalReport.globalRiskScore}%`],
      [''],
      ['Risk Categories', ''],
      ...this.riskCategories.map(cat => [cat.name, `${cat.score}%`])
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Action Plan sheet
    const actionPlanData = [
      ['Title', 'Priority', 'Description', 'Timeline', 'Resources', 'Completed'],
      ...this.actionPlan.map(action => [
        action.title,
        action.priority,
        action.description,
        action.timeline,
        action.resources,
        action.completed ? 'Yes' : 'No'
      ])
    ];
    const actionPlanSheet = XLSX.utils.aoa_to_sheet(actionPlanData);
    XLSX.utils.book_append_sheet(workbook, actionPlanSheet, 'Action Plan');

    // Detailed Assessment sheet
    const assessmentData = [
      ['Question', 'Answer', 'Risk Level'],
      ['Multi-Factor Authentication', this.answers.mfa, this.answers.mfa === 'no' ? 'High' : 'Low'],
      ['Repository Protection', this.answers.gitProtection, this.answers.gitProtection === 'no' ? 'High' : 'Low'],
      ['SCA Tools', this.answers.scaTools, this.answers.scaTools === 'no' ? 'Medium' : 'Low'],
      ['Vulnerability Scans', this.answers.vulnerabilityScans, this.answers.vulnerabilityScans === 'no' ? 'Medium' : 'Low'],
      ['Secrets Management', this.answers.secretsManagement, this.answers.secretsManagement === 'no' ? 'High' : 'Low'],
      ['Incident Response Plan', this.answers.contingencyPlan, this.answers.contingencyPlan === 'no' ? 'Medium' : 'Low']
    ];
    const assessmentSheet = XLSX.utils.aoa_to_sheet(assessmentData);
    XLSX.utils.book_append_sheet(workbook, assessmentSheet, 'Assessment Details');

    XLSX.writeFile(workbook, 'security-assessment.xlsx');
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