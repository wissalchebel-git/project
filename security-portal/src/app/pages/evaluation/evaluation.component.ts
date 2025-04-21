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
    gitlabRepo: '',
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

    constructor(private http: HttpClient) {}
  
    cloneGithubRepo() {
      const repoUrl = this.answers.githubURL;
  
      if (!repoUrl) {
        alert("Please enter a GitHub URL.");
        return;
      }
  
      this.http.post<any>('http://localhost:5000/api/git', { repoUrl }).subscribe({
        next: (res) => {
          console.log("✅ Cloning succeeded", res);
          alert("✅ Repository cloned successfully!\n📁 Path: " + res.path);
        },
        error: (err) => {
          console.error("❌ Cloning failed", err);
          alert("❌ Cloning failed: " + (err.error?.error || 'Unknown error'));
        },
      });
    }
  }

