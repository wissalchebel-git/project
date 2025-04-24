import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Component({
  selector: 'app-evaluation',
  templateUrl: './evaluation.component.html',
  styleUrls: ['./evaluation.component.scss']
})
export class EvaluationComponent {
  answers: any = {
    projectName: '',
    githubRepo: '',
    githubURL: '',
    gitlabURL: '',
    gitlabToken:'',
    repoURL: '',
    projectObjective: '',
    involvedParties: '',
    email: '',
    mfa: '',
    repoProtection: '',
    securityMeasures: [],
    securityTools: '',
    staticDynamicTools: '',
    automatedTests: '',
    ciCdSecurity: '',
    dependencyManagement: '',
    scaTools: '',
    vulnerabilityScans: '',
    identifiedVulnerabilities: '',
    vulnerabilityHandling: '',
    updateFrequency: '',
    monitoringTools: '',
    secretsManagement: '',
    contingencyPlan: '',
    contingencyDetails: '',
    securityStandards: '',
    riskAssessment: '',
    securityTraining: '',
    trainingFrequency: '',
    userAwareness: ''
  };


  constructor(private http: HttpClient) {}
  
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
  score: number = 0;

  calculateScore() {
    this.score = 0; // Reset score before calculation

    // Basic security practices (Yes = 10 points)
    if (this.answers.mfa === 'yes') this.score += 10;
    if (this.answers.repoProtection === 'yes') this.score += 10;
    if (this.answers.securityMeasures.includes('access_control')) this.score += 5;
    if (this.answers.securityMeasures.includes('data_encryption')) this.score += 5;
    if (this.answers.securityMeasures.includes('regular_audits')) this.score += 5;
    if (this.answers.securityTools) this.score += 10;
    if (this.answers.staticDynamicTools) this.score += 10;
    if (this.answers.automatedTests === 'yes') this.score += 10;
    if (this.answers.ciCdSecurity) this.score += 10;
    if (this.answers.dependencyManagement) this.score += 5;
    if (this.answers.scaTools) this.score += 10;
    if (this.answers.vulnerabilityScans === 'yes') this.score += 10;
    if (this.answers.identifiedVulnerabilities === 'yes') this.score += 5;
    if (this.answers.updateFrequency) this.score += 5;
    if (this.answers.monitoringTools === 'yes') this.score += 10;
    if (this.answers.secretsManagement === 'yes') this.score += 10;
    if (this.answers.contingencyPlan === 'yes') this.score += 10;
    if (this.answers.securityStandards) this.score += 10;
    if (this.answers.riskAssessment === 'yes') this.score += 10;
    if (this.answers.securityTraining === 'yes') this.score += 5;
    if (this.answers.userAwareness) this.score += 5;

    // Normalize score out of 100
    this.score = Math.min(100, this.score);

    alert(`Security Score: ${this.score}/100`);
  }

    
  }

